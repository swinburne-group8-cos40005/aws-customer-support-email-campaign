# Infrastructure — CloudFormation Templates

Templates implement ADR-0004 (CloudFormation YAML, five stacks named `csep-<concern>`, cross-referenced via `Fn::ImportValue`). DB access follows ADR-0005 (RDS Proxy + `pg`) and the issue #22 credential consensus (D1: IAM token auth Lambda → Proxy; D2: Secrets Manager credential Proxy → Aurora; D3: plain `.env` for local dev).

## Stack status

| Template | Stack | Contents | Status |
| :--- | :--- | :--- | :--- |
| `auth.yaml` | `csep-auth` | Cognito user pool + hosted UI domain + web app client (PKCE, revocation) | **this PR (draft for review)** |
| `data.yaml` | `csep-data` | Aurora Serverless v2 cluster, RDS Proxy, Secrets Manager master credential | **this PR (draft for review)** |
| `api.yaml` | `csep-api` | HTTP API, JWT authorizer, campaign Lambdas, `rds-db:connect` roles | **this PR (draft for review)** |
| `messaging.yaml` | `csep-messaging` | SQS + DLQ, SNS, SES event destinations, EventBridge Scheduler | pending (issues #6, #7, #10) |
| `observability.yaml` | `csep-observability` | CloudWatch alarms + dashboards | pending (issue #14) |

## Deploy order

```
csep-auth  →  csep-data  →  csep-api        (csep-api imports the csep-data DB exports
                                             and the csep-auth user pool/issuer exports)
```

### 0. csep-auth

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

The hosted-UI domain prefix `csep-<account-id>-<env>` is globally unique — no collision with other Cognito domains. The `UserPoolId` and `UserPoolClientId` outputs are passed to `csep-api` at deploy time (step 2), and the hosted-UI domain goes to the frontend (#9) for login/logout redirects.

`csep-auth` has no dependency on `csep-data`, but `csep-api` needs its user pool ID and app client ID, so practical order: **auth → data → api**.

### 1. csep-data

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

### 2. csep-api

```sh
# Package the backend bundle first (built dist uploaded to S3), then:
aws cloudformation deploy \
  --stack-name csep-api \
  --template-file infra/api.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    EnvironmentName=dev \
    ArtifactBucket=<bucket> \
    ArtifactKey=<key> \
    SubnetIds=<subnet-a>,<subnet-b> \
    VpcId=<vpc-id>
```

`csep-api` resolves everything cross-stack itself: `csep-auth-UserPoolClientId` and `csep-auth-CognitoIssuer` for the JWT authorizer, `csep-data-DBProxyEndpoint` and `csep-data-DBProxyArn` for the DB access path — the Lambda gets connection coordinates only, never a password (issue #22, D1).

## Design notes

- **IAM auth at the Proxy (`IAMAuth: REQUIRED`, `RequireTLS: true`):** every client must present an IAM token (~15-minute validity, SigV4-signed by the Lambda role). This is the issue #22 consensus; it means the connect layer in the backend must generate a token per connection and set `ssl: 'require'` in the `pg` config. Local dev is unaffected — plain `DATABASE_URL` to local Postgres (D3).
- **Master credential managed by Secrets Manager (`ManageMasterUserPassword: true`):** the Aurora master password is never echoed or printed; the Proxy reads it through `csep-proxy-role-*`. DB users keep standard password auth — no `rds_iam` conversion needed (issue #22, D2).
- **Deletion protection:** default `false` so a broken demo stack can be torn down cleanly (ADR-0004 cost control). Set `true` on any stack the graded demo depends on.
- **Cluster ingress is Proxy-only** (security-group-to-security-group). Proxy ingress is currently VPC-CIDR-wide so schema bootstrap and tooling can reach it; tightening it to the Lambda SG is a hardening follow-up.

## Open operational detail (for issue #22 follow-up)

Schema bootstrap: `db/schema.sql` cannot be applied *through* the Proxy with password auth (IAM-only by design). Options to settle: (a) apply it once from inside the VPC (temporary bastion / SSM session host) using the master credential, or (b) a small migration Lambda in the VPC using the same IAM path as the app. Not blocking template review.
