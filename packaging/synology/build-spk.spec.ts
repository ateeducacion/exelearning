import { afterAll, beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '../..');
const buildScript = path.join(projectRoot, 'packaging/synology/build-spk.sh');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synology-spk-test-'));
const binary = path.join(testDir, 'exelearning-server-linux');
setDefaultTimeout(30_000);

const env = { ...process.env, STANDALONE_BINARY: binary, PACKAGE_REVISION: '2', SOURCE_DATE_EPOCH: '1700000000' };

beforeAll(() => {
    // Archive tests use an ELF header fixture; smoke-test.sh executes the real build on Linux.
    fs.writeFileSync(binary, Buffer.from('7f454c4602010100000000000000000002003e00', 'hex'));
    fs.chmodSync(binary, 0o755);
});
afterAll(() => fs.rmSync(testDir, { recursive: true, force: true }));

function build(version = '4.1.0-beta.1') {
    const result = spawnSync('bash', [buildScript, version, testDir], { cwd: projectRoot, env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    return path.join(testDir, `exelearning-${version.replace(/^v/, '')}-2-x86_64.spk`);
}

function tar(...args: string[]): string {
    return execFileSync('tar', args, { encoding: 'utf8' });
}

describe('native Synology SPK builder', () => {
    it('requires an explicit valid release version and revision', () => {
        expect(spawnSync('bash', [buildScript, '', testDir], { env }).status).not.toBe(0);
        expect(spawnSync('bash', [buildScript, 'latest', testDir], { env }).status).not.toBe(0);
        expect(
            spawnSync('bash', [buildScript, '4.0.6', testDir], { env: { ...env, PACKAGE_REVISION: '0' } }).status,
        ).not.toBe(0);
        const invalidBinary = path.join(testDir, 'script');
        fs.writeFileSync(invalidBinary, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        expect(
            spawnSync('bash', [buildScript, '4.0.6', testDir], { env: { ...env, STANDALONE_BINARY: invalidBinary } })
                .status,
        ).not.toBe(0);
    });

    it('builds a versioned x86_64 archive and checksum with native runtime assets', () => {
        const spk = build();
        expect(fs.existsSync(spk)).toBe(true);
        expect(execFileSync('sha256sum', ['--check', `${spk}.sha256`], { cwd: testDir, encoding: 'utf8' })).toContain(
            'OK',
        );
        const entries = tar('-tf', spk).trim().split('\n');
        expect(entries[0]).toBe('INFO');
        for (const entry of [
            'package.tgz',
            'conf/resource',
            'conf/nginx.conf',
            'scripts/start-stop-status',
            'scripts/preupgrade',
            'scripts/postupgrade',
            'scripts/preuninst',
            'scripts/postuninst',
            'WIZARD_UIFILES/install_uifile',
        ]) {
            expect(entries).toContain(entry);
        }
        const info = tar('-xOf', spk, 'INFO');
        expect(info).toContain('version="4.1.0.1.1-2"');
        expect(info).toContain('app_version="4.1.0-beta.1"');
        expect(info).toContain('install_type="volume"');
        expect(info).toContain('arch="x86_64"');
        expect(info).toMatch(/extractsize="[1-9][0-9]*"/);
        const payload = execFileSync('bash', ['-c', `tar -xOf "${spk}" package.tgz | tar -tzf -`], {
            encoding: 'utf8',
        });
        expect(payload).toContain('./app/exelearning-server');
        expect(payload).toContain('./ui/auth.cgi');
        expect(payload).toContain('./ui/auth.js');
        expect(payload).toContain('./app/public/');
        expect(payload).toContain('./app/views/');
        expect(payload).toContain('./app/translations/');
        expect(payload).toContain('./app/synology/nginx.conf');
        expect(payload).toContain('./app/node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css');
        const resource = JSON.parse(tar('-xOf', spk, 'conf/resource'));
        expect(resource['port-config']).toBeUndefined();
        expect(resource['usr-local-linker']).toBeUndefined();
        for (const config of resource['web-config']['nginx-static-config'].enable) {
            expect(payload.split('\n')).toContain(`./${config.relpath}`);
        }
        expect(`${entries.join('\n')}\n${payload}`).not.toMatch(/docker-compose|docker-project|container.manager/i);
        expect(payload).not.toMatch(/\.(test|spec)\.js$|\.map$/m);
        const mode = execFileSync(
            'bash',
            ['-c', `tar -xOf "${spk}" package.tgz | tar -tvzf - ./app/exelearning-server`],
            { encoding: 'utf8' },
        );
        expect(mode).toMatch(/^-rwxr-xr-x/);
    });

    it('packages loopback configuration, websocket proxying, persistent paths, and a real service status check', () => {
        const spk = path.join(testDir, 'exelearning-4.1.0-beta.1-2-x86_64.spk');
        const nginx = tar('-xOf', spk, 'conf/nginx.conf');
        expect(nginx).toContain('127.0.0.1:8085');
        expect(nginx).toContain('location ^~ /exelearning/');
        expect(nginx).toContain('proxy_set_header Upgrade $http_upgrade');
        expect(nginx).toContain('client_max_body_size 2g');
        const postinst = tar('-xOf', spk, 'scripts/postinst');
        expect(postinst).toContain('SYNOPKG_PKGVAR/data/exelearning.db');
        expect(postinst).toContain('APP_AUTH_METHODS=synology');
        expect(postinst).toContain('APP_HOST=127.0.0.1');
        const service = tar('-xOf', spk, 'scripts/start-stop-status');
        expect(service).toContain('kill -0');
        expect(service).toContain('kill -TERM');
    });
});
