import { getClusterProfile, toRuntimeCluster } from './server/cluster-registry.mjs';
import { runSshCommand } from './server/command-runner.mjs';

async function main() {
  try {
    const profile = await getClusterProfile('cloud-primary');
    const cluster = toRuntimeCluster(profile);

    const cmd = `
curl -sL https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml > /tmp/components.yaml
sed -i 's/- args:/- args:\\n        - --kubelet-insecure-tls/g' /tmp/components.yaml
kubectl apply -f /tmp/components.yaml
`;
    
    const result = await runSshCommand(cluster, cmd);
    console.log("STDOUT:", result.stdout);
    console.log("STDERR:", result.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
