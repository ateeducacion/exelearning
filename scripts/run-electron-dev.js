const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';
const args = ['electron', '.'];
const env = {
  ...process.env,
  EXELEARNING_DEBUG_MODE: process.env.EXELEARNING_DEBUG_MODE || '1',
};

const child = spawn(cmd, args, {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
});

child.on('error', (err) => {
  console.error('Failed to launch Electron:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
