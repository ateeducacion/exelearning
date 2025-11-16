const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const localBin = path.join(process.cwd(), 'node_modules', '.bin');
const electronBin = path.join(localBin, isWin ? 'electron.cmd' : 'electron');

const cmd = fs.existsSync(electronBin) ? electronBin : isWin ? 'electron.cmd' : 'electron';
const args = ['.'];

const env = {
  ...process.env,
  EXELEARNING_DEBUG_MODE: process.env.EXELEARNING_DEBUG_MODE || '1',
};

const child = spawn(cmd, args, {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
  shell: false,
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
