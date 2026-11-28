#!/usr/bin/env bash
# Deploy the Week 10 csep-* stacks to the dev environment, in order.
#
# Usage:
#   VPC_ID=vpc-... SUBNET_IDS=subnet-a,subnet-b ./infra/deploy-dev.sh
#   FRONTEND_ORIGIN=https://dev.example.com VPC_ID=... ./infra/deploy-dev.sh
#
# Optional inputs unlock the stacks that are not needed for the API pass:
#   ARTIFACT_KEY=api.zip                     csep-api
#   DISPATCHER_ARTIFACT_KEY=dispatcher.zip   csep-dispatcher (#26; required for API)
#   EVENT_HANDLER_ARTIFACT_KEY=events.zip    csep-feedback (#26)
#   SNS_TOPIC_ARN=arn:aws:sns:...            csep-feedback (#29 publishes here)
#   API_ID=abc123 MANAGER_EMAIL=ops@example  csep-observability (#27/#28)
#
# Stacks whose inputs are missing are skipped with a message, so the script
# is safe to run before every bundle is built. CloudFormation deploys are
# idempotent: re-running applies only the difference.
#
# No console changes (ADR-0004 drift policy). The schema bootstrap is NOT
# performed here: it needs the temporary SSM tunnel described in
# infra/README.md, step 2, and is recorded separately in the evidence
# transcript.

set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-1}"
ENV_NAME="${ENVIRONMENT_NAME:-dev}"
TEMPLATE_DIR="$(dirname "$0")"

: "${VPC_ID:?Set VPC_ID (e.g. vpc-0123...)}"
: "${SUBNET_IDS:?Set SUBNET_IDS (two private subnets, comma-separated)}"
: "${FRONTEND_ORIGIN:?Set FRONTEND_ORIGIN (https origin, no trailing slash)}"

CFN_TEMPLATE_BUCKET=""

deploy_stack() {
    local stack="$1"
    shift
    local s3_args=()

    if [ -n "${CFN_TEMPLATE_BUCKET}" ]; then
        s3_args=(--s3-bucket "$CFN_TEMPLATE_BUCKET" --s3-prefix "cfn-templates")
    fi

    echo "── Deploying ${stack} ──"
    aws cloudformation deploy \
        --region "$REGION" \
        --stack-name "$stack" \
        --template-file "$TEMPLATE_DIR/${stack#csep-}.yaml" \
        "${s3_args[@]}" \
        "$@"
    echo "✓ ${stack}"
}

# 1. Artifact bucket — every other stack references it via import, and
#    templates exceeding CloudFormation's 51,200-byte inline limit (e.g.
#    api.yaml) stage through it automatically.
deploy_stack csep-artifact \
    --parameter-overrides "EnvironmentName=${ENV_NAME}"

CFN_TEMPLATE_BUCKET=$(aws cloudformation list-exports \
    --region "$REGION" \
    --query "Exports[?Name=='csep-artifact-CodeBucketName'].Value | [0]" \
    --output text)
if [ "$CFN_TEMPLATE_BUCKET" = "None" ]; then
    CFN_TEMPLATE_BUCKET=""
fi

# 2. Auth — Cognito pool + client; the API's JWT authorizer imports them.
deploy_stack csep-auth \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        "EnvironmentName=${ENV_NAME}" \
        "FrontendOrigin=${FRONTEND_ORIGIN}"

# 3. Data — Aurora Serverless v2 + RDS Proxy.
#    Leave BootstrapSecurityGroupId empty for the normal run; set it only
#    while executing infra/README.md, step 2 (schema bootstrap).
deploy_stack csep-data \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        "EnvironmentName=${ENV_NAME}" \
        "VpcId=${VPC_ID}" \
        "VpcCidrBlock=${VPC_CIDR:-10.0.0.0/16}" \
        "SubnetIds=${SUBNET_IDS}" \
        "MasterDbUsername=${MASTER_DB_USERNAME:-csepadmin}" \
        "DbName=${DB_NAME:-csep}" \
        "DeletionProtection=${DELETION_PROTECTION:-false}" \
        "BootstrapSecurityGroupId=${BOOTSTRAP_SECURITY_GROUP_ID:-}"

# 4. Dispatcher — the send queue, Scheduler and Dispatcher Lambda (#26).
#    Deploy before csep-api because the /send function imports its ARN.
if [ -f "${TEMPLATE_DIR}/dispatcher.yaml" ] && [ -n "${DISPATCHER_ARTIFACT_KEY:-}" ]; then
    deploy_stack csep-dispatcher \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            "EnvironmentName=${ENV_NAME}" \
            "DispatcherArtifactKey=${DISPATCHER_ARTIFACT_KEY}" \
            "SubnetIds=${SUBNET_IDS}" \
            "VpcId=${VPC_ID}"
else
    echo "── Skipping csep-dispatcher (DISPATCHER_ARTIFACT_KEY not set or template missing) ──"
fi

# 5. API — Lambda bundle from the artifact bucket, IAM DB auth.
#    Requires csep-dispatcher to exist because /send invokes its Lambda.
if [ -n "${ARTIFACT_KEY:-}" ] && [ -n "${DISPATCHER_ARTIFACT_KEY:-}" ]; then
    deploy_stack csep-api \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            "EnvironmentName=${ENV_NAME}" \
            "ArtifactKey=${ARTIFACT_KEY}" \
            "SubnetIds=${SUBNET_IDS}" \
            "VpcId=${VPC_ID}" \
            "FrontendOrigin=${FRONTEND_ORIGIN}"
else
    echo "── Skipping csep-api (ARTIFACT_KEY and DISPATCHER_ARTIFACT_KEY required) ──"
fi

# 6. Feedback — the SES event queue and Event Handler (#26). The SNS topic
#    belongs to the email-sending stack (#29) and arrives as an input.
if [ -f "${TEMPLATE_DIR}/feedback.yaml" ] \
    && [ -n "${EVENT_HANDLER_ARTIFACT_KEY:-}" ] \
    && [ -n "${SNS_TOPIC_ARN:-}" ]; then
    deploy_stack csep-feedback \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            "EnvironmentName=${ENV_NAME}" \
            "ArtifactKey=${EVENT_HANDLER_ARTIFACT_KEY}" \
            "SnsTopicArn=${SNS_TOPIC_ARN}" \
            "SubnetIds=${SUBNET_IDS}" \
            "VpcId=${VPC_ID}"
else
    echo "── Skipping csep-feedback (EVENT_HANDLER_ARTIFACT_KEY and SNS_TOPIC_ARN required) ──"
fi

# 7. Observability — log groups, metric filters, alarms and dashboards
#    (#27, #28). ApiId and the manager email identify the alarm targets.
if [ -f "${TEMPLATE_DIR}/observability.yaml" ] \
    && [ -n "${API_ID:-}" ] \
    && [ -n "${MANAGER_EMAIL:-}" ]; then
    deploy_stack csep-observability \
        --parameter-overrides \
            "EnvironmentName=${ENV_NAME}" \
            "ManagerEmail=${MANAGER_EMAIL}" \
            "ApiId=${API_ID}" \
            "MainQueueName=csep-send-queue-${ENV_NAME}" \
            "DeadLetterQueueName=csep-send-dlq-${ENV_NAME}"
else
    echo "── Skipping csep-observability (API_ID and MANAGER_EMAIL required) ──"
fi

echo
echo "Deploy pass complete. Record the results in"
echo "docs/evidence/dev-deploy-$(date +%F).md (template: docs/evidence/template-dev-deploy.md)."
