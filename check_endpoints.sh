#!/bin/bash
TOKEN="usr_ccbf5e61"
URL="https://drplatform.share.zrok.io"
CLUSTER="test"

ENDPOINTS=(
  "/api/clusters/${CLUSTER}/status"
  "/api/clusters/${CLUSTER}/velero/location"
  "/api/clusters/${CLUSTER}/backups"
  "/api/clusters/${CLUSTER}/metrics"
  "/api/clusters/${CLUSTER}/workloads"
  "/api/clusters/${CLUSTER}/backup-freshness"
  "/api/clusters/${CLUSTER}/restore-readiness"
  "/api/clusters/${CLUSTER}/recommendations"
  "/api/clusters/${CLUSTER}/topology"
  "/api/clusters/${CLUSTER}/rto-history"
  "/api/storage/minio/status"
)

for ep in "${ENDPOINTS[@]}"; do
  STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "${URL}${ep}")
  echo "${ep}: ${STATUS}"
done
