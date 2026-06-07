export const commandDefaults = {
  timeoutMs: Number.parseInt(process.env.DR_COMMAND_TIMEOUT_MS || '12000', 10),
};

export const sshDefaults = {
  user: process.env.DR_SSH_USER || 'leeon',
  host: process.env.DR_SSH_HOST || '127.0.0.1',
};

export const minio = {
  namespace: 'minio',
  serviceName: 'minio',
  expectedApiPort: 9000,
  expectedConsolePort: 9001,
};
