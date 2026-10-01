#!/usr/bin/env node
/**
 * Platform-aware standalone build script.
 * Detects the current platform and compiles the appropriate Bun executable(s).
 *
 * - macOS: Builds both arm64 and x64 for universal app support
 * - Windows: Builds x64 .exe only
 * - Linux: Builds x64 only
 */

const { execSync } = require('child_process');
const platform = process.platform;
const requestedTarget = process.argv[2];

console.log(`[build-standalone] Detected platform: ${platform}`);

try {
  if (requestedTarget) {
    const targets = {
      'linux-x64': ['bun-linux-x64', 'dist/exelearning-server-linux'],
      'linux-arm64': ['bun-linux-arm64', 'dist/exelearning-server-linux-arm64'],
      'windows-x64': ['bun-windows-x64', 'dist/exelearning-server.exe'],
      'darwin-x64': ['bun-darwin-x64', 'dist/exelearning-server-x64'],
      'darwin-arm64': ['bun-darwin-arm64', 'dist/exelearning-server-arm64'],
    };
    const target = targets[requestedTarget];
    if (!target) throw new Error(`Unsupported target "${requestedTarget}"`);
    console.log(`[build-standalone] Building explicit target ${requestedTarget}...`);
    const synology = process.argv[3] === '--synology';
    const entrypoint = synology ? 'packaging/synology/entry.ts' : 'src/index.ts';
    const isolation = synology ? '--no-compile-autoload-dotenv --no-compile-autoload-bunfig' : '';
    execSync(`bun build ${entrypoint} ${isolation} --compile --compile-autoload-package-json --target=${target[0]} --outfile ${target[1]}`, { stdio: 'inherit' });
  } else if (platform === 'darwin') {
    // macOS: build both arm64 and x64 for universal app
    console.log('[build-standalone] Building for macOS (arm64 + x64)...');
    execSync(
      'bun build src/index.ts --compile --compile-autoload-package-json --target=bun-darwin-arm64 --outfile dist/exelearning-server-arm64',
      { stdio: 'inherit' }
    );
    execSync(
      'bun build src/index.ts --compile --compile-autoload-package-json --target=bun-darwin-x64 --outfile dist/exelearning-server-x64',
      { stdio: 'inherit' }
    );
    console.log('[build-standalone] macOS builds complete.');
  } else if (platform === 'win32') {
    // Windows: build x64 only
    console.log('[build-standalone] Building for Windows (x64)...');
    execSync(
      'bun build src/index.ts --compile --compile-autoload-package-json --target=bun-windows-x64 --outfile dist/exelearning-server.exe',
      { stdio: 'inherit' }
    );
    console.log('[build-standalone] Windows build complete.');
  } else {
    // Linux and others: build x64 only
    console.log('[build-standalone] Building for Linux (x64)...');
    execSync(
      'bun build src/index.ts --compile --compile-autoload-package-json --target=bun-linux-x64 --outfile dist/exelearning-server-linux',
      { stdio: 'inherit' }
    );
    console.log('[build-standalone] Linux build complete.');
  }
} catch (error) {
  console.error('[build-standalone] Build failed:', error.message);
  process.exit(1);
}
