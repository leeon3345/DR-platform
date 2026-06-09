FROM node:22-alpine

ARG TARGETARCH=amd64
ARG KUBECTL_VERSION=v1.30.14
ARG VELERO_VERSION=v1.14.1

USER root
RUN apk add --no-cache ca-certificates curl tar \
  && curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" \
  && chmod +x /usr/local/bin/kubectl \
  && curl -fsSL -o /tmp/velero.tar.gz "https://github.com/vmware-tanzu/velero/releases/download/${VELERO_VERSION}/velero-${VELERO_VERSION}-linux-${TARGETARCH}.tar.gz" \
  && tar -xzf /tmp/velero.tar.gz -C /tmp \
  && mv "/tmp/velero-${VELERO_VERSION}-linux-${TARGETARCH}/velero" /usr/local/bin/velero \
  && chmod +x /usr/local/bin/velero \
  && rm -rf /tmp/velero*

WORKDIR /app
COPY package.json dr-agent.mjs ./

USER node
CMD ["node", "dr-agent.mjs"]
