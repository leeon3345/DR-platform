#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-diagnose}"

: "${USER_CLUSTER_ID:=my-cluster}"
: "${EDGE_CLUSTER_ID:=edge-recovery}"
: "${USER_AGENT_NAMESPACE:=dr-agent}"
: "${EDGE_AGENT_NAMESPACE:=dr-agent}"
: "${RELEASE_NAME:=dr-agent}"
: "${CHART_REPO_NAME:=dr-platform}"
: "${CHART_VERSION:=0.1.13}"
: "${IMAGE_REPOSITORY:=ttl.sh/dr-platform-agent}"
: "${IMAGE_TAG:=24h}"
: "${USER_SSH_TARGET:=}"
: "${EDGE_SSH_TARGET:=leeon@127.0.0.1}"
: "${EDGE_SSH_PORT:=2223}"
: "${REMOTE_KUBECTL:=kubectl}"
: "${EDGE_KUBECTL:=sudo k3s kubectl}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 2
  fi
}

ssh_user() {
  require_env USER_SSH_TARGET
  ssh "${USER_SSH_TARGET}" "$@"
}

ssh_edge() {
  ssh -p "${EDGE_SSH_PORT}" "${EDGE_SSH_TARGET}" "$@"
}

diagnose_user_agent() {
  require_env USER_SSH_TARGET
  ssh_user "${REMOTE_KUBECTL} get deploy,pod -n ${USER_AGENT_NAMESPACE} -o wide || true"
  ssh_user "${REMOTE_KUBECTL} get deploy -n ${USER_AGENT_NAMESPACE} -o jsonpath='{range .items[*]}{.metadata.name}{\" CLUSTER_ID=\"}{range .spec.template.spec.containers[*].env[?(@.name==\"CLUSTER_ID\")]}{.value}{end}{\" IMAGE=\"}{range .spec.template.spec.containers[*]}{.image}{end}{\"\\n\"}{end}' || true"
}

diagnose_edge_agent() {
  ssh_edge "${EDGE_KUBECTL} get deploy,pod -n ${EDGE_AGENT_NAMESPACE} -o wide || true"
  ssh_edge "${EDGE_KUBECTL} get deploy -n ${EDGE_AGENT_NAMESPACE} -o jsonpath='{range .items[*]}{.metadata.name}{\" CLUSTER_ID=\"}{range .spec.template.spec.containers[*].env[?(@.name==\"CLUSTER_ID\")]}{.value}{end}{\" IMAGE=\"}{range .spec.template.spec.containers[*]}{.image}{end}{\"\\n\"}{end}' || true"
}

build_and_push_agent_image() {
  docker build -t "${IMAGE_REPOSITORY}:${IMAGE_TAG}" ./agent
  docker push "${IMAGE_REPOSITORY}:${IMAGE_TAG}"
}

inject_user_agent_source() {
  require_env USER_SSH_TARGET

  ssh_user "mkdir -p /tmp/dr-agent-repair"
  ssh "${USER_SSH_TARGET}" "cat > /tmp/dr-agent-repair/dr-agent.mjs" < agent/dr-agent.mjs
  ssh_user "${REMOTE_KUBECTL} create namespace ${USER_AGENT_NAMESPACE} --dry-run=client -o yaml | ${REMOTE_KUBECTL} apply -f -"
  ssh_user "${REMOTE_KUBECTL} create configmap dr-agent-source \
    -n ${USER_AGENT_NAMESPACE} \
    --from-file=dr-agent.mjs=/tmp/dr-agent-repair/dr-agent.mjs \
    --dry-run=client -o yaml | ${REMOTE_KUBECTL} apply -f -"
  ssh_user "${REMOTE_KUBECTL} patch deployment ${RELEASE_NAME} \
    -n ${USER_AGENT_NAMESPACE} \
    --type=strategic \
    -p '{\"spec\":{\"template\":{\"spec\":{\"volumes\":[{\"name\":\"dr-agent-source\",\"configMap\":{\"name\":\"dr-agent-source\"}}],\"containers\":[{\"name\":\"dr-agent\",\"volumeMounts\":[{\"name\":\"dr-agent-source\",\"mountPath\":\"/app/dr-agent.mjs\",\"subPath\":\"dr-agent.mjs\",\"readOnly\":true}]}]}}}}'"
  ssh_user "${REMOTE_KUBECTL} rollout restart deployment/${RELEASE_NAME} -n ${USER_AGENT_NAMESPACE}"
  ssh_user "${REMOTE_KUBECTL} rollout status deployment/${RELEASE_NAME} -n ${USER_AGENT_NAMESPACE} --timeout=120s"
}

upgrade_user_agent() {
  require_env USER_SSH_TARGET
  require_env PLATFORM_URL
  require_env AGENT_TOKEN

  ssh_user "helm repo add ${CHART_REPO_NAME} ${PLATFORM_URL}/api/download 2>/dev/null || true"
  ssh_user "helm repo update ${CHART_REPO_NAME}"
  ssh_user "helm upgrade --install ${RELEASE_NAME} ${CHART_REPO_NAME}/dr-agent \
    --version ${CHART_VERSION} \
    --namespace ${USER_AGENT_NAMESPACE} \
    --create-namespace \
    --set agent.platformUrl=${PLATFORM_URL} \
    --set agent.clusterId=${USER_CLUSTER_ID} \
    --set agent.token=${AGENT_TOKEN} \
    --set image.repository=${IMAGE_REPOSITORY} \
    --set image.tag=${IMAGE_TAG} \
    --set image.pullPolicy=Always"
  ssh_user "${REMOTE_KUBECTL} rollout restart deployment/${RELEASE_NAME} -n ${USER_AGENT_NAMESPACE}"
  ssh_user "${REMOTE_KUBECTL} rollout status deployment/${RELEASE_NAME} -n ${USER_AGENT_NAMESPACE} --timeout=120s"
}

restore_edge_agent_identity() {
  require_env PLATFORM_URL
  require_env AGENT_TOKEN

  ssh_edge "helm repo add ${CHART_REPO_NAME} ${PLATFORM_URL}/api/download 2>/dev/null || true"
  ssh_edge "helm repo update ${CHART_REPO_NAME}"
  ssh_edge "helm upgrade --install ${RELEASE_NAME} ${CHART_REPO_NAME}/dr-agent \
    --version ${CHART_VERSION} \
    --namespace ${EDGE_AGENT_NAMESPACE} \
    --create-namespace \
    --set agent.platformUrl=${PLATFORM_URL} \
    --set agent.clusterId=${EDGE_CLUSTER_ID} \
    --set agent.token=${AGENT_TOKEN} \
    --set image.repository=${IMAGE_REPOSITORY} \
    --set image.tag=${IMAGE_TAG} \
    --set image.pullPolicy=Always"
  ssh_edge "${EDGE_KUBECTL} rollout restart deployment/${RELEASE_NAME} -n ${EDGE_AGENT_NAMESPACE}"
  ssh_edge "${EDGE_KUBECTL} rollout status deployment/${RELEASE_NAME} -n ${EDGE_AGENT_NAMESPACE} --timeout=120s"
}

disable_edge_rogue_agent() {
  ssh_edge "helm uninstall ${RELEASE_NAME} -n ${EDGE_AGENT_NAMESPACE} 2>/dev/null || true"
  ssh_edge "${EDGE_KUBECTL} delete deployment ${RELEASE_NAME} -n ${EDGE_AGENT_NAMESPACE} --ignore-not-found=true"
}

case "${MODE}" in
  diagnose)
    diagnose_user_agent
    diagnose_edge_agent
    ;;
  build-image)
    build_and_push_agent_image
    ;;
  inject-user-source)
    inject_user_agent_source
    ;;
  upgrade-user)
    upgrade_user_agent
    ;;
  restore-edge)
    restore_edge_agent_identity
    ;;
  disable-edge-agent)
    disable_edge_rogue_agent
    ;;
  repair-all)
    build_and_push_agent_image
    upgrade_user_agent
    disable_edge_rogue_agent
    ;;
  *)
    cat >&2 <<USAGE
Usage: $0 [diagnose|build-image|inject-user-source|upgrade-user|restore-edge|disable-edge-agent|repair-all]

Required for user VM modes:
  USER_SSH_TARGET, PLATFORM_URL, AGENT_TOKEN

Useful overrides:
  USER_CLUSTER_ID=${USER_CLUSTER_ID}
  EDGE_CLUSTER_ID=${EDGE_CLUSTER_ID}
  IMAGE_REPOSITORY=${IMAGE_REPOSITORY}
  IMAGE_TAG=${IMAGE_TAG}
  EDGE_SSH_TARGET=${EDGE_SSH_TARGET}
  EDGE_SSH_PORT=${EDGE_SSH_PORT}
USAGE
    exit 2
    ;;
esac
