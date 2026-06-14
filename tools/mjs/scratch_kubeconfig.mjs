import fs from 'node:fs';
import { getClusterProfile, toRuntimeCluster } from './server/cluster-registry.mjs';
import { runSshCommand } from './server/command-runner.mjs';

async function main() {
  try {
    const profile = await getClusterProfile('cloud-primary');
    const cluster = toRuntimeCluster(profile);

    const result = await runSshCommand(cluster, 'cat ~/.kube/config');
    const kubeconfig = result.stdout.replace(/server: https:\/\/.*?:6443/, 'server: https://127.0.0.1:6443');
    fs.writeFileSync('kubeconfig-cloud-primary', kubeconfig);
    console.log("Kubeconfig saved to kubeconfig-cloud-primary");
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
