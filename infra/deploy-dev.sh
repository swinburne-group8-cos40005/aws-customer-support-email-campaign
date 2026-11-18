#!/usr/bin/env bash
# Deploy the Week 10 csep-* stacks to the dev environment, in order.
#
# Usage:
#   VPC_ID=vpc-... SUBNET_IDS=subnet-a,subnet-b ./infra/deploy-dev.sh
#   FRONTEND_ORIGIN=https://dev.example.com VPC_ID=... ./infra/deploy-dev.sh
#
# Deploys every template that exists in infra/ and skips the rest with a
# message (messaging.yaml and observability.yaml land with their own
# checkpoints). CloudFormation deploys are idempotent: re-running applies
# only the difference.
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

deploy_stack() {
    local stack="$1"
    shift

    echo "── Deploying ${stack} ──"
    aws cloudformation deploy \
        --region "$REGION" \
        --stack-name "$stack" \
        --template-file "$TEMPLATE_DIR/${stack#csep-}.yaml" \
        "$@"
    echo "✓ ${stack}"
}

# 1. Artifact bucket — every other stack references it via import.
deploy_stack csep-artifact \
    --parameter-overrides "EnvironmentName=${ENV_NAME}"

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
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        "EnvironmentName=${ENV_NAME}" \
        "VpcId=${VPC_ID}" \
        "VpcCidrBlock=${VPC_CIDR:-10.0.0.0/16}" \
        "SubnetIds=${SUBNET_IDS}" \
        "MasterDbUsername=${MASTER_DB_USERNAME:-csepadmin}" \
        "DbName=${DB_NAME:-csep}" \
        "DeletionProtection=${DELETION_PROTECTION:-false}" \
        "BootstrapSecurityGroupId=${BOOTSTRAP_SECURITY_GROUP_ID:-}"

# 4. API — Lambda bundle from the artifact bucket, IAM DB auth.
#    Requires ARTIFACT_KEY (the packaged bundle uploaded by the backend
#    build); see backend/README.md for packaging.
if [ -n "${ARTIFACT_KEY:-}" ]; then
    deploy_stack csep-api \
        --capabilities CAPABILITY_IAM \
        --parameter-overrides \
            "EnvironmentName=${ENV_NAME}" \
            "ArtifactKey=${ARTIFACT_KEY}" \
            "SubnetIds=${SUBNET_IDS}" \
            "VpcId=${VPC_ID}" \
            "FrontendOrigin=${FRONTEND_ORIGIN}"
else
    echo "── Skipping csep-api (ARTIFACT_KEY not set) ──"
fi

# 5. Messaging + observability — templates arrive with the #26 / #27
#    checkpoints; deploy them automatically once they exist.
for stack in csep-messaging csep-observability; do
    template="${TEMPLATE_DIR}/${stack#csep-}.yaml"
    if [ -f "$template" ]; then
        deploy_stack "$stack" \
            --capabilities CAPABILITY_IAM \
            --parameter-overrides "EnvironmentName=${ENV_NAME}"
    else
        echo "── Skipping ${stack} (${template} not present yet) ──"
    fi
done

echo
echo "Deploy pass complete. Record the results in"
echo "docs/evidence/dev-deploy-$(date +%F).md (template: docs/evidence/template-dev-deploy.md)."
