import { getClusterProfile, toRuntimeCluster } from './server/cluster-registry.mjs';
import { runSshCommand } from './server/command-runner.mjs';

async function main() {
  try {
    const profile = await getClusterProfile('cloud-primary');
    const cluster = toRuntimeCluster(profile);

    const result = await runSshCommand(cluster, 'kubectl top pods -A');
    console.log("STDOUT:", result.stdout);
    console.log("STDERR:", result.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
