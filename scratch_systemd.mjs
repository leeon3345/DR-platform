import { getClusterProfile, toRuntimeCluster } from './server/cluster-registry.mjs';
import { runSshCommand } from './server/command-runner.mjs';

async function main() {
  try {
    const profile = await getClusterProfile('edge-recovery');
    const cluster = toRuntimeCluster(profile);

    const cmd = `cat << 'EOF' > /tmp/zrok-minio.service
[Unit]
Description=zrok share for dr-minio
After=network.target

[Service]
Type=simple
User=leeon
ExecStart=/home/leeon/bin/zrok2 share public http://10.0.2.11:30900 --name-selection public:dr-minio --headless
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
echo leeon | sudo -S mv /tmp/zrok-minio.service /etc/systemd/system/zrok-minio.service
echo leeon | sudo -S systemctl daemon-reload
echo leeon | sudo -S systemctl enable --now zrok-minio
systemctl status zrok-minio --no-pager
`;
    
    const result = await runSshCommand(cluster, cmd);
    console.log("STDOUT:", result.stdout);
    console.log("STDERR:", result.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
