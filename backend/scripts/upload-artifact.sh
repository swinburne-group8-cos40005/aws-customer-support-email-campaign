#!/usr/bin/env bash
# Upload a packaged backend Lambda zip bundle to the csep-artifact S3 bucket.
#
# Usage:
#   ./backend/scripts/upload-artifact.sh                  # uploads dist/api.zip -> api/<sha>-<ts>.zip
#   ./backend/scripts/upload-artifact.sh dist/worker.zip worker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGION="${AWS_REGION:-ap-southeast-1}"

ZIP_PATH="${1:-${BACKEND_DIR}/dist/api.zip}"
PREFIX="${2:-api}"

if [ ! -f "$ZIP_PATH" ]; then
    echo "Bundle not found: $ZIP_PATH" >&2
    echo "Run 'npm run package' in backend/ first." >&2
    exit 1
fi

BUCKET_NAME=$(aws cloudformation list-exports \
    --region "$REGION" \
    --query "Exports[?Name=='csep-artifact-CodeBucketName'].Value | [0]" \
    --output text)

if [ -z "$BUCKET_NAME" ] || [ "$BUCKET_NAME" = "None" ]; then
    echo "Export 'csep-artifact-CodeBucketName' not found in region ${REGION}." >&2
    echo "Deploy csep-artifact first (infra/artifact.yaml)." >&2
    exit 1
fi

SHORT_SHA=$(git -C "$BACKEND_DIR" rev-parse --short HEAD 2>/dev/null || echo "local")
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
S3_KEY="${PREFIX}/${SHORT_SHA}-${TIMESTAMP}.zip"

aws s3 cp "$ZIP_PATH" "s3://${BUCKET_NAME}/${S3_KEY}" --region "$REGION"

echo
echo "Uploaded: s3://${BUCKET_NAME}/${S3_KEY}"
echo "ARTIFACT_KEY=${S3_KEY}"
