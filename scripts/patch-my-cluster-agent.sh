#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"

: "${USER_SSH_TARGET:?Set USER_SSH_TARGET, for example leeon@127.0.0.1}"
: "${USER_SSH_PORT:=}"
: "${KUBECTL:=kubectl}"
: "${AGENT_NAMESPACE:=dr-agent}"
: "${AGENT_DEPLOYMENT:=dr-agent}"
: "${AGENT_CONTAINER:=dr-agent}"
: "${AGENT_SOURCE:=agent/dr-agent.mjs}"
: "${VELERO_NAMESPACE:=velero}"
: "${BSL_NAME:=default}"
: "${BSL_PREFIX:=my-cluster/}"

ssh_base() {
  if [[ -n "${USER_SSH_PORT}" ]]; then
    ssh -p "${USER_SSH_PORT}" "${USER_SSH_TARGET}" "$@"
  else
    ssh "${USER_SSH_TARGET}" "$@"
  fi
}

patch_velero_prefix() {
  ssh_base "${KUBECTL} -n ${VELERO_NAMESPACE} patch backupstoragelocation.velero.io ${BSL_NAME} \
    --type=merge \
    -p '{\"spec\":{\"objectStorage\":{\"prefix\":\"${BSL_PREFIX}\"}}}'"

  ssh_base "${KUBECTL} -n ${VELERO_NAMESPACE} get backupstoragelocation.velero.io ${BSL_NAME} \
    -o jsonpath='{.spec.objectStorage.bucket}{\" prefix=\"}{.spec.objectStorage.prefix}{\"\\n\"}'"
}

inject_agent_source() {
  if [[ ! -f "${AGENT_SOURCE}" ]]; then
    echo "Agent source not found: ${AGENT_SOURCE}" >&2
    exit 2
  fi

  ssh_base "mkdir -p /tmp/dr-agent-repair"
  ssh_base "cat > /tmp/dr-agent-repair/dr-agent.mjs" < "${AGENT_SOURCE}"

  ssh_base "${KUBECTL} create namespace ${AGENT_NAMESPACE} --dry-run=client -o yaml | ${KUBECTL} apply -f -"
  ssh_base "${KUBECTL} -n ${AGENT_NAMESPACE} create configmap dr-agent-source \
    --from-file=dr-agent.mjs=/tmp/dr-agent-repair/dr-agent.mjs \
    --dry-run=client -o yaml | ${KUBECTL} apply -f -"

  ssh_base "${KUBECTL} -n ${AGENT_NAMESPACE} patch deployment ${AGENT_DEPLOYMENT} \
    --type=strategic \
    -p '{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"dr-platform/source-injected-at\":\"'\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"'\"}},\"spec\":{\"volumes\":[{\"name\":\"dr-agent-source\",\"configMap\":{\"name\":\"dr-agent-source\"}}],\"containers\":[{\"name\":\"${AGENT_CONTAINER}\",\"volumeMounts\":[{\"name\":\"dr-agent-source\",\"mountPath\":\"/app/dr-agent.mjs\",\"subPath\":\"dr-agent.mjs\",\"readOnly\":true}]}]}}}}'"

  ssh_base "${KUBECTL} -n ${AGENT_NAMESPACE} rollout status deployment/${AGENT_DEPLOYMENT} --timeout=120s"
  ssh_base "${KUBECTL} -n ${AGENT_NAMESPACE} get deploy ${AGENT_DEPLOYMENT} \
    -o jsonpath='{.spec.template.spec.containers[0].image}{\" mounted=\"}{.spec.template.spec.containers[0].volumeMounts[?(@.mountPath==\"/app/dr-agent.mjs\")].name}{\"\\n\"}'"
}

case "${MODE}" in
  prefix)
    patch_velero_prefix
    ;;
  agent)
    inject_agent_source
    ;;
  all)
    patch_velero_prefix
    inject_agent_source
    ;;
  *)
    cat >&2 <<USAGE
Usage: USER_SSH_TARGET=<user@host> [USER_SSH_PORT=2224] $0 [prefix|agent|all]

Environment overrides:
  KUBECTL=${KUBECTL}
  AGENT_NAMESPACE=${AGENT_NAMESPACE}
  AGENT_DEPLOYMENT=${AGENT_DEPLOYMENT}
  AGENT_CONTAINER=${AGENT_CONTAINER}
  VELERO_NAMESPACE=${VELERO_NAMESPACE}
  BSL_NAME=${BSL_NAME}
  BSL_PREFIX=${BSL_PREFIX}
USAGE
    exit 2
    ;;
esac
