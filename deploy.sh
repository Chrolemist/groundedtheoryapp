#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="your-gcp-project-id"
REGION="europe-north1"
SERVICE_NAME="grounded-ai"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

gcloud builds submit --tag "${IMAGE}" .

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --max-instances 1 \
  --session-affinity
