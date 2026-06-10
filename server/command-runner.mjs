import { spawn } from 'node:child_process';
import { commandDefaults } from './lab-config.mjs';

const REDACTION_PATTERNS = [
  /aws_secret_access_key\s*=\s*[^\s]+/gi,
  /aws_access_key_id\s*=\s*[^\s]+/gi,
  /password[ \t]*[:=][ \t]*(?![{\[])[^\r\n]*/gi,
  /secret[ \t]*[:=][ \t]*(?![{\[])[^\r\n]*/gi,
];

export class ApiCommandError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ApiCommandError';
    this.details = details;
  }
}

export function sanitizeOutput(value) {
  const text = String(value || '');
  return REDACTION_PATTERNS.reduce(
    (output, pattern) => output.replace(pattern, (match) => `${match.split(/[=:]/)[0]}=***`),
    text,
  ).trim();
}

export async function runSshCommand(cluster, remoteCommand, options = {}) {
  const timeoutMs = options.timeoutMs || commandDefaults.timeoutMs;
  const usePassword = Boolean(process.env.DR_SSH_PASSWORD);
  const sshArgs = [
    '-o',
    'ConnectTimeout=5',
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'UserKnownHostsFile=/dev/null',
    '-p',
    String(cluster.ssh.port),
    `${cluster.ssh.user}@${cluster.ssh.host}`,
    remoteCommand,
  ];

  if (!usePassword) {
    sshArgs.unshift('-o', 'BatchMode=yes');
  }

  const command = usePassword ? 'expect' : 'ssh';
  const args = usePassword ? ['-c', buildExpectScript(cluster, remoteCommand, timeoutMs)] : sshArgs;
  const env = usePassword
    ? {
        ...process.env,
        SSHPASS: process.env.DR_SSH_PASSWORD,
      }
    : process.env;

  return runCommand(command, args, {
    env,
    timeoutMs,
    label: `${cluster.id}:${remoteCommand}`,
  });
}

export function runCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || commandDefaults.timeoutMs;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env || process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new ApiCommandError(`Failed to start ${command}`, {
        command,
        args: safeArgs(args),
        label: options.label,
        stderr: sanitizeOutput(error.message),
      }));
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const cleanStdout = sanitizeOutput(stdout);
      const cleanStderr = sanitizeOutput(stderr);

      if (timedOut) {
        reject(new ApiCommandError('Command timed out', {
          command,
          args: safeArgs(args),
          label: options.label,
          timeoutMs,
          timedOut: true,
          stderr: cleanStderr,
        }));
        return;
      }

      if (exitCode !== 0) {
        reject(new ApiCommandError('Command failed', {
          command,
          args: safeArgs(args),
          label: options.label,
          exitCode,
          stderr: cleanStderr,
        }));
        return;
      }

      resolve({
        stdout: cleanStdout,
        stderr: cleanStderr,
      });
    });
  });
}

export function parseJsonCommand(stdout, label) {
  try {
    return JSON.parse(extractJson(stdout));
  } catch (error) {
    throw new ApiCommandError('Command returned invalid JSON', {
      label,
      stderr: sanitizeOutput(error.message),
    });
  }
}

function buildExpectScript(cluster, remoteCommand, timeoutMs) {
  const timeoutSeconds = Math.ceil(timeoutMs / 1000);
  const encodedRemoteCommand = Buffer.from(remoteCommand).toString('base64');

  return `
set timeout ${timeoutSeconds}
set password $env(DR_SSH_PASSWORD)
set remoteCommand [binary decode base64 {${encodedRemoteCommand}}]
spawn -noecho ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${cluster.ssh.port} ${cluster.ssh.user}@${cluster.ssh.host} -- $remoteCommand
expect {
  -re "(?i)password.*:" {
    send "$password\\r"
    exp_continue
  }
  eof {}
  timeout {
    exit 124
  }
}
catch wait result
exit [lindex $result 3]
`;
}

function extractJson(output) {
  const text = String(output || '').trim();
  const firstObject = text.indexOf('{');
  const firstArray = text.indexOf('[');

  if (firstObject === -1 && firstArray === -1) {
    return text;
  }

  const start = firstObject === -1 ? firstArray : firstObject;
  const endObject = text.lastIndexOf('}');
  const endArray = text.lastIndexOf(']');
  const end = start === firstObject ? endObject : endArray;

  return end > start ? text.slice(start, end + 1) : text;
}

function safeArgs(args) {
  return args.map((arg) => {
    const value = String(arg);
    if (/secret|password|credential|token/i.test(value)) {
      return '***';
    }
    return value;
  });
}
