#!/usr/bin/env bash
# Grants public read access to a GCS bucket via IAM (UBLA-compatible).
# Usage: ./src/scripts/setup-gcs-bucket-public-read.sh your-bucket-name

set -euo pipefail

BUCKET_NAME="${1:-}"

if [[ -z "${BUCKET_NAME}" ]]; then
  echo "Usage: $0 <bucket-name>"
  echo "Example: $0 crmapplications"
  exit 1
fi

echo "Enabling Uniform Bucket-Level Access on gs://${BUCKET_NAME}..."
gsutil uniformbucketlevelaccess set on "gs://${BUCKET_NAME}"

echo "Granting Storage Object Viewer to allUsers on gs://${BUCKET_NAME}..."
gsutil iam ch "allUsers:objectViewer" "gs://${BUCKET_NAME}"

echo "Verifying IAM policy..."
gsutil iam get "gs://${BUCKET_NAME}" | grep -E "allUsers|objectViewer" || true

echo "Done. Bucket gs://${BUCKET_NAME} is configured for UBLA with public read via IAM."
