# Evidence template: dev deployment

Copy this file to `docs/evidence/dev-deploy-<YYYY-MM-DD>.md`, fill in every
field with real command output, and link it from the issue (#33).
Do not leave placeholders in the committed copy — an evidence record with
`<TBD>` in it counts as missing evidence.

## Environment

| Field | Value |
| :--- | :--- |
| Date (Vietnam time) | `<YYYY-MM-DD HH:mm>` |
| AWS account | `<account-id>` |
| Region | `<aws-region>` |
| Deploying identity | `<arn:aws:iam::...:user/...>` |
| Script | `infra/deploy-dev.sh` @ commit `<sha>` |

## Stack status after deploy

Paste the output of:

```sh
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `csep-`)].{Name:StackName,Status:StackStatus,Updated:LastUpdatedTime}' \
  --output table
```

```text
<output>
```

## Schema bootstrap

Paste the applied-file confirmation from `infra/README.md` step 2, then the
row-count sanity query:

```sql
SELECT 'customers' AS table_name, COUNT(*) FROM customers
UNION ALL SELECT 'segments', COUNT(*) FROM segments
UNION ALL SELECT 'templates', COUNT(*) FROM templates
UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL SELECT 'email_logs', COUNT(*) FROM email_logs;
```

```text
<output>
```

## Cross-stack wiring

| Check | Command | Result |
| :--- | :--- | :--- |
| Exports resolve | `aws cloudformation list-exports --query 'Exports[?starts_with(Name, \`csep-\`)].Name'` | `<output>` |
| Lambda reaches Proxy | invoke `GET <ApiEndpoint>/health` (or the next available route); expected status `<status>` | `<output>` |
| Queue + DLQ exports (once messaging lands) | `aws sqs get-queue-attributes --queue-url <url> --attribute-names QueueArn` | `<output>` |

## Notes

- Deviations from `infra/README.md` (if any), with reasoning:
  `<none, or explanation>`
- Temporary bootstrap resources removed (instance terminated, security group
  deleted, `BootstrapSecurityGroupId=` cleared): `<yes/no + evidence>`
