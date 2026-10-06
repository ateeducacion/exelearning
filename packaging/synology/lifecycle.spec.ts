import { afterAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'synology-lifecycle-'));
const env = { ...process.env, SYNOPKG_PKGVAR: join(root, 'persistent'), SYNOPKG_PKGDEST: join(root, 'target') };
const scripts = join(import.meta.dir, 'scripts');
const run = (script: string, ...args: string[]) => spawnSync('sh', [join(scripts, script), ...args], { env });
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('DSM package lifecycle', () => {
    it('preserves database, project files and private installation secrets across upgrades', () => {
        expect(run('postinst').status).toBe(0);
        const config = join(env.SYNOPKG_PKGVAR, 'config/runtime.env');
        const original = readFileSync(config, 'utf8');
        expect(statSync(config).mode & 0o777).toBe(0o600);
        const jwt = original.match(/^JWT_SECRET=(.+)$/m)?.[1];
        const sso = original.match(/^SYNOLOGY_SSO_SECRET=(.+)$/m)?.[1];
        expect(jwt).toMatch(/^[a-f0-9]{96}$/);
        expect(sso).toMatch(/^[a-f0-9]{96}$/);
        expect(jwt).not.toBe(sso);
        const database = join(env.SYNOPKG_PKGVAR, 'data/exelearning.db');
        const project = join(env.SYNOPKG_PKGVAR, 'files/project.elpx');
        writeFileSync(database, 'existing database');
        writeFileSync(project, 'existing project');
        writeFileSync(config, `${original}CUSTOM_SETTING=preserved\n`);
        chmodSync(config, 0o644);
        expect(run('postupgrade').status).toBe(0);
        expect(readFileSync(config, 'utf8')).toBe(`${original}CUSTOM_SETTING=preserved\n`);
        expect(statSync(config).mode & 0o777).toBe(0o600);
        expect(readFileSync(database, 'utf8')).toBe('existing database');
        expect(readFileSync(project, 'utf8')).toBe('existing project');
    });

    it('rejects malformed, stale and unrelated PID files without killing another process', () => {
        mkdirSync(join(env.SYNOPKG_PKGVAR, 'run'), { recursive: true });
        const pidFile = join(env.SYNOPKG_PKGVAR, 'run/exelearning.pid');
        for (const pid of ['', '0', '1', '-1', 'bad', '999999999', `${process.pid}`]) {
            writeFileSync(pidFile, pid);
            expect(run('start-stop-status', 'status').status).toBe(3);
            writeFileSync(pidFile, pid);
            expect(run('start-stop-status', 'stop').status).toBe(0);
            expect(process.kill(process.pid, 0)).toBe(true);
        }
        expect(run('start-stop-status', 'invalid').status).toBe(2);
    });

    it('starts with the release version format required by versioned asset routes', () => {
        const app = join(env.SYNOPKG_PKGDEST, 'app');
        mkdirSync(app, { recursive: true });
        writeFileSync(join(app, 'VERSION'), '4.1.0-beta.1\n');
        writeFileSync(
            join(app, 'exelearning-server'),
            '#!/bin/sh\nprintf "%s" "$APP_VERSION" > "$FILES_DIR/runtime-version"\nexec sleep 60\n',
            { mode: 0o755 },
        );
        const result = run('start-stop-status', 'start');
        if (process.getuid?.() === 0) {
            expect(result.status).toBe(1);
            expect(result.stderr.toString()).toContain('Refusing to run eXeLearning as root');
            return;
        }
        const pid = Number(readFileSync(join(env.SYNOPKG_PKGVAR, 'run/exelearning.pid'), 'utf8'));
        try {
            expect(result.status).toBe(0);
            expect(readFileSync(join(env.SYNOPKG_PKGVAR, 'files/runtime-version'), 'utf8')).toBe('v4.1.0-beta.1');
        } finally {
            process.kill(pid, 'SIGTERM');
        }
    });
});
