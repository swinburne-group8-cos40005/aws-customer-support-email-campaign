# Infrastructure — CloudFormation Templates

Templates implement ADR-0004 (CloudFormation YAML, six stacks named `csep-<concern>`, cross-referenced via `Fn::ImportValue`). DB access follows ADR-0005 (RDS Proxy + `pg`) and issue #22: Lambda IAM authentication as the dedicated `csep_app` user, with that user's generated password held by Secrets Manager for the Proxy.

## Stack status

| Template | Stack | Contents | Status |
| :--- | :--- | :--- | :--- |
| `artifact.yaml` | `csep-artifact` | S3 bucket holding packaged Lambda bundles (versioned, private) | **this PR** |
| `auth.yaml` | `csep-auth` | Cognito user pool + hosted UI domain + web app client (PKCE, revocation) | **this PR (draft for review)** |
| `data.yaml` | `csep-data` | Aurora Serverless v2 cluster and instance, RDS Proxy, managed master and app-user secrets | **this PR (draft for review)** |
| `api.yaml` | `csep-api` | HTTP API, JWT authorizer, campaign Lambdas, scoped `rds-db:connect` role | **this PR (draft for review)** |
| `messaging.yaml` | `csep-messaging` | SQS + DLQ, SNS, SES event destinations, EventBridge Scheduler | pending (issues #6, #7, #10) |
| `observability.yaml` | `csep-observability` | CloudWatch alarms + dashboards | pending (issue #14) |

## Deploy order

```
csep-artifact  →  csep-auth  →  csep-data  →  schema bootstrap  →  csep-api
```

### 0. csep-artifact

```sh
aws cloudformation deploy \
  --stack-name csep-artifact \
  --template-file infra/artifact.yaml \
  --parameter-overrides \
    EnvironmentName=dev
```

`csep-artifact` owns the S3 bucket that stores packaged Lambda bundles. It is deployed first because `csep-api` imports the bucket name rather than receiving it as a deploy parameter. The bucket is disposable: deleting the stack deletes the stored packages, so re-upload a fresh bundle before redeploying `csep-api`. Versioning keeps recent bundles available for rollback; a lifecycle rule expires noncurrent versions after 30 days (ADR-0004 cost control).

### 1. csep-auth

```sh
aws cloudformation deploy \
  --stack-name csep-auth \
  --template-file infra/auth.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    EnvironmentName=dev \
    CallbackUrls=http://localhost:5173 \
    LogoutUrls=http://localhost:5173
```

The hosted-UI domain prefix `csep-<account-id>-<env>` is globally unique. The `UserPoolId`, `UserPoolClientId`, and full hosted-login domain URL are exported for the API and frontend.

### 2. csep-data

```sh
aws cloudformation deploy \
  --stack-name csep-data \
  --template-file infra/data.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    EnvironmentName=dev \
    VpcId=<vpc-id> \
    VpcCidrBlock=<10.x.0.0/16> \
    SubnetIds=<subnet-a>,<subnet-b> \
    DeletionProtection=false
```

`csep-data` creates the `csep_app` secret but not the database role itself. Bootstrap the schema and role before deploying `csep-api`:

1. Create a disposable EC2 instance in a private subnet of the database VPC with SSM Agent and the `AmazonSSMManagedInstanceCore` instance profile. Attach a temporary security group with no inbound rules and the outbound access needed for SSM and PostgreSQL. Do not assign a public IP.
2. Update `csep-data` with `BootstrapSecurityGroupId=<temporary-sg-id>` (and the same values for its other parameters). This temporarily allows that security group to connect directly to Aurora on port 5432:

   ```sh
   aws cloudformation deploy \
     --stack-name csep-data \
     --template-file infra/data.yaml \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       EnvironmentName=dev VpcId=<vpc-id> VpcCidrBlock=<10.x.0.0/16> \
       SubnetIds=<subnet-a>,<subnet-b> MasterDbUsername=csepadmin DbName=csep \
       MinACU=2 MaxACU=8 DeletionProtection=false \
       BootstrapSecurityGroupId=<temporary-sg-id>
   ```
3. Start an SSM remote-host port-forward from your workstation to the cluster writer endpoint:

   ```sh
   WRITER_ENDPOINT=$(aws cloudformation describe-stacks --stack-name csep-data \
     --query "Stacks[0].Outputs[?OutputKey=='ClusterWriterEndpoint'].OutputValue | [0]" --output text)
   aws ssm start-session \
     --target <temporary-instance-id> \
     --document-name AWS-StartPortForwardingSessionToRemoteHost \
     --parameters "{\"host\":[\"$WRITER_ENDPOINT\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"15432\"]}"
   ```

4. In a second local terminal with `psql`, `jq`, and AWS credentials authorized to read the two database secrets, retrieve the outputs from `csep-data`. Keep secret values in shell variables; do not enable shell tracing or print them.

   ```sh
   MASTER_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name csep-data \
     --query "Stacks[0].Outputs[?OutputKey=='DBSecretArn'].OutputValue | [0]" --output text)
   APP_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name csep-data \
     --query "Stacks[0].Outputs[?OutputKey=='DBAppSecretArn'].OutputValue | [0]" --output text)
   MASTER_JSON=$(aws secretsmanager get-secret-value \
     --secret-id "$MASTER_SECRET_ARN" --query SecretString --output text)
   DB_USER=$(printf '%s' "$MASTER_JSON" | jq -r '.username')
   export PGPASSWORD=$(printf '%s' "$MASTER_JSON" | jq -r '.password')
   export CSEP_APP_PASSWORD=$(aws secretsmanager get-secret-value \
     --secret-id "$APP_SECRET_ARN" --query SecretString --output text | jq -r '.password')

   psql "host=127.0.0.1 port=15432 dbname=csep user=$DB_USER sslmode=require" \
     -v ON_ERROR_STOP=1 -f db/schema.sql
   psql "host=127.0.0.1 port=15432 dbname=csep user=$DB_USER sslmode=require" \
     -v ON_ERROR_STOP=1 -f infra/bootstrap-app-user.sql

   unset MASTER_JSON DB_USER PGPASSWORD CSEP_APP_PASSWORD
   ```

   The master secret provides the bootstrap credentials, and the app secret provides the password assigned to `csep_app`. The app role receives CRUD on the campaign/data tables, but only SELECT and INSERT on `audit_logs`; future tables default to SELECT/INSERT and require explicit grants for additional privileges. `db/schema.sql` drops and recreates tables, so apply it only to a new database or after an approved backup.
5. Update `csep-data` with the same parameter values and `BootstrapSecurityGroupId=` to remove the temporary cluster ingress:

   ```sh
   aws cloudformation deploy \
     --stack-name csep-data \
     --template-file infra/data.yaml \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       EnvironmentName=dev VpcId=<vpc-id> VpcCidrBlock=<10.x.0.0/16> \
       SubnetIds=<subnet-a>,<subnet-b> MasterDbUsername=csepadmin DbName=csep \
       MinACU=2 MaxACU=8 DeletionProtection=false BootstrapSecurityGroupId=
   ```

   Stop the SSM session, terminate the EC2 instance, and delete its temporary security group. The Proxy is configured only with the `csep_app` secret; the master secret is not available to the Proxy or API Lambda.

### 3. csep-api

```sh
# Package the backend bundle first (built dist uploaded to the artifact bucket), then:
aws cloudformation deploy \
  --stack-name csep-api \
  --template-file infra/api.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    EnvironmentName=dev \
    ArtifactKey=<key> \
    SubnetIds=<subnet-a>,<subnet-b> \
    VpcId=<vpc-id>
```

`csep-api` imports the Cognito client ID and issuer, the database endpoint, name, and username, and the artifact bucket name from the other stacks. Only the bundle key varies per deploy. Its `rds-db:connect` grant is scoped to the RDS Proxy resource ID and the exact database user `csep_app`; the Lambda has no Secrets Manager permission or database password.

## Design notes

- **IAM auth at the Proxy (`IAMAuth: REQUIRED`, `RequireTLS: true`):** the Lambda signs a short-lived IAM token as `csep_app`; the backend connect layer must generate a token per connection and set `ssl: 'require'` in the `pg` config. Local development remains plain `DATABASE_URL` to local Postgres (D3).
- **Separate managed credentials:** Aurora's generated master secret is only for administrative bootstrap. A distinct generated app-user secret is the only secret exposed to the Proxy. The Lambda role cannot read either secret and cannot connect as master.
- **Temporary bootstrap access:** direct cluster ingress is added only for the supplied SSM host security group and is removed by clearing `BootstrapSecurityGroupId`. No bastion resource or permanent direct-access rule is created.
- **Deletion protection:** default `false` so a broken demo stack can be torn down cleanly (ADR-0004 cost control). Set `true` on any stack the graded demo depends on.
