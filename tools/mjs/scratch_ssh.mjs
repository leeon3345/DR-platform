import { getClusterProfile, toRuntimeCluster } from './server/cluster-registry.mjs';
import { runSshCommand } from './server/command-runner.mjs';

async function main() {
  try {
    const profile = await getClusterProfile('edge-recovery');
    const cluster = toRuntimeCluster(profile);
    const result = await runSshCommand(cluster, 'ps -p 6185 -o cmd=');
    console.log("STDOUT:", result.stdout);
    console.log("STDERR:", result.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
