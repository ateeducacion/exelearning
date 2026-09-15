import { describe, it, expect, afterAll } from 'bun:test';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '../..');
const buildScript = path.join(projectRoot, 'packaging/synology/build-spk.sh');
const testOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synology-spk-test-'));

afterAll(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
});

describe('packaging/synology/build-spk.sh', () => {
    it('should default to latest docker tag and package version when version is omitted or latest', () => {
        const result = spawnSync('bash', [buildScript, 'latest', testOutputDir], {
            cwd: projectRoot,
            encoding: 'utf8',
        });
        expect(result.status).toBe(0);

        const spkFiles = fs.readdirSync(testOutputDir).filter((f) => f.endsWith('.spk'));
        expect(spkFiles.length).toBeGreaterThan(0);
        const spkFile = path.join(testOutputDir, spkFiles[0]);

        const composeContent = execSync(
            `tar -xOf "${spkFile}" package.tgz | tar -xzO docker/docker-compose.yml`,
            { encoding: 'utf8' }
        );
        expect(composeContent).toContain('exelearning/exelearning:latest');
    });

    it('should generate a valid SPK archive with version substituted', () => {
        const version = '4.0.4';
        const result = spawnSync('bash', [buildScript, version, testOutputDir], {
            cwd: projectRoot,
            encoding: 'utf8',
        });

        expect(result.status).toBe(0);
        const spkFile = path.join(testOutputDir, `exelearning-${version}.spk`);
        expect(fs.existsSync(spkFile)).toBe(true);

        // Verify tar table of contents and ensure INFO is the first entry
        const tocOutput = execSync(`tar -tf "${spkFile}"`, { encoding: 'utf8' });
        const entries = tocOutput.trim().split('\n');
        expect(entries[0]).toBe('INFO');
        expect(tocOutput).toContain('PACKAGE_ICON.PNG');
        expect(tocOutput).toContain('PACKAGE_ICON_256.PNG');
        expect(tocOutput).toContain('conf/privilege');
        expect(tocOutput).toContain('conf/resource');
        expect(tocOutput).toContain('package.tgz');
        expect(tocOutput).toContain('scripts/start-stop-status');
        expect(tocOutput).toContain('scripts/preinst');
        expect(tocOutput).toContain('scripts/postinst');

        // Verify INFO file contents inside the SPK
        const infoContent = execSync(`tar -xOf "${spkFile}" INFO`, { encoding: 'utf8' });
        expect(infoContent).toContain('package="exelearning"');
        expect(infoContent).toContain('version="4.0.4-0001"');
        expect(infoContent).toContain('os_min_ver="7.0-40000"');
        expect(infoContent).toContain('install_type="system"');
        expect(infoContent).toContain('dsmuidir="ui"');
        expect(infoContent).toContain('dsmappname="SYNO.SDS.eXeLearning"');
        expect(infoContent).toContain('adminport="8085"');

        // Verify docker/docker-compose.yml contents inside package.tgz inside the SPK
        const composeContent = execSync(
            `tar -xOf "${spkFile}" package.tgz | tar -xzO docker/docker-compose.yml`,
            { encoding: 'utf8' }
        );
        expect(composeContent).toContain(`exelearning/exelearning:${version}`);
        expect(composeContent).toContain('exelearning_data:/mnt/data');

        // Verify ui/config inside package.tgz
        const uiConfigContent = execSync(
            `tar -xOf "${spkFile}" package.tgz | tar -xzO ui/config`,
            { encoding: 'utf8' }
        );
        expect(uiConfigContent).toContain('"SYNO.SDS.eXeLearning"');
        expect(uiConfigContent).toContain('"port": "8085"');

        // Verify resource file uses projects schema
        const resourceContent = execSync(`tar -xOf "${spkFile}" conf/resource`, { encoding: 'utf8' });
        expect(resourceContent).toContain('"docker-project"');
        expect(resourceContent).toContain('"projects"');
        expect(resourceContent).toContain('"path": "docker"');
    });

    it('should handle version with leading v prefix (e.g. v4.0.2)', () => {
        const versionInput = 'v4.0.2';
        const expectedVersion = '4.0.2';
        const result = spawnSync('bash', [buildScript, versionInput, testOutputDir], {
            cwd: projectRoot,
            encoding: 'utf8',
        });

        expect(result.status).toBe(0);
        const spkFile = path.join(testOutputDir, `exelearning-${expectedVersion}.spk`);
        expect(fs.existsSync(spkFile)).toBe(true);

        const infoContent = execSync(`tar -xOf "${spkFile}" INFO`, { encoding: 'utf8' });
        expect(infoContent).toContain('version="4.0.2-0001"');

        const composeContent = execSync(
            `tar -xOf "${spkFile}" package.tgz | tar -xzO docker/docker-compose.yml`,
            { encoding: 'utf8' }
        );
        expect(composeContent).toContain('exelearning/exelearning:v4.0.2');
    });
});
