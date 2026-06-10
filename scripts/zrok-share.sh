#!/usr/bin/env bash
set -euo pipefail

API_TARGET="${DR_API_TARGET:-http://localhost:3001}"
DASHBOARD_TARGET="${DR_DASHBOARD_TARGET:-http://localhost:5173}"
API_RESERVED_TOKEN="${ZROK_API_RESERVED_TOKEN:-}"
DASHBOARD_RESERVED_TOKEN="${ZROK_DASHBOARD_RESERVED_TOKEN:-}"
API_SHARE_NAME="${ZROK_API_SHARE_NAME:-}"
DASHBOARD_SHARE_NAME="${ZROK_DASHBOARD_SHARE_NAME:-}"

share_public() {
  local label="$1"
  local target="$2"

  echo "Starting ${label} zrok share for ${target}"
  zrok share public "${target}" --headless &
}

share_reserved() {
  local label="$1"
  local token="$2"

  echo "Starting reserved ${label} zrok share"
  zrok share reserved "${token}" --headless &
}

reserve_named_share() {
  local label="$1"
  local target="$2"
  local name="$3"

  echo "Reserving ${label} zrok share '${name}' for ${target}"
  zrok reserve public "${target}" --backend-mode web --unique-name "${name}" || true
  share_reserved "${label}" "${name}"
}

if [[ -n "${API_RESERVED_TOKEN}" ]]; then
  share_reserved "API" "${API_RESERVED_TOKEN}"
elif [[ -n "${API_SHARE_NAME}" ]]; then
  reserve_named_share "API" "${API_TARGET}" "${API_SHARE_NAME}"
else
  share_public "API" "${API_TARGET}"
fi

if [[ -n "${DASHBOARD_RESERVED_TOKEN}" ]]; then
  share_reserved "dashboard" "${DASHBOARD_RESERVED_TOKEN}"
elif [[ -n "${DASHBOARD_SHARE_NAME}" ]]; then
  reserve_named_share "dashboard" "${DASHBOARD_TARGET}" "${DASHBOARD_SHARE_NAME}"
else
  share_public "dashboard" "${DASHBOARD_TARGET}"
fi

echo
echo "zrok shares are starting."
echo "Use ZROK_*_SHARE_NAME or ZROK_*_RESERVED_TOKEN for stable URLs."
echo "Without those values, copy the temporary public URLs printed by zrok."
wait
