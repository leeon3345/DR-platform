#!/usr/bin/env bash
set -euo pipefail

: "${KUBECTL:=kubectl}"
: "${KUBECONFIG_ARG:=}"
: "${LOCAL_PATH_VERSION:=v0.0.28}"

if [[ -n "${KUBECONFIG_ARG}" ]]; then
  KUBECTL="${KUBECTL} --kubeconfig ${KUBECONFIG_ARG}"
fi

${KUBECTL} apply -f "https://raw.githubusercontent.com/rancher/local-path-provisioner/${LOCAL_PATH_VERSION}/deploy/local-path-storage.yaml"
${KUBECTL} patch storageclass local-path -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
${KUBECTL} get storageclass
${KUBECTL} get pods -n local-path-storage
