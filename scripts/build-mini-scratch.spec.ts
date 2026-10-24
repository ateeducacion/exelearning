import { describe, it, expect } from 'bun:test';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildMiniScratch, measurePackaging } from './build-mini-scratch';

describe('Block Programming offline asset build', () => {
    it('measures both packaging options and all incremental offline resources', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'mini-scratch-measure-test-'));
        try {
            await buildMiniScratch(dir);
            for (const name of ['mini-scratch.css', 'mini-scratch.html']) {
                await cp(join('public/files/perm/idevices/base/mini-scratch/export', name), join(dir, 'export', name));
            }
            const measured = await measurePackaging(dir);
            expect(measured.selectedOption.gzip).toBeLessThan(measured.moduleOption.gzip);
            expect(measured.total.gzip).toBeLessThan(300 * 1024);
            expect(measured.resources['BLOCKLY-LICENSE.txt']).toBeDefined();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
    it('ships the published core and license without language generators or teacher UI', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'mini-scratch-build-'));
        try {
            const size = await buildMiniScratch(dir);
            const script = await readFile(join(dir, 'export/mini-scratch.js'));
            const core = await readFile('node_modules/blockly/blockly_compressed.js');
            expect(script.includes(core)).toBe(true);
            expect(script.toString()).not.toContain('Load example (replaces this form)');
            expect(script.toString()).not.toContain('javascriptGenerator');
            expect(await readFile(join(dir, 'export/MINI-SCRATCH-LICENSE.txt'), 'utf8')).toBe(await readFile('LICENSE', 'utf8'));
            expect(script.length).toBe(size);
            expect(gzipSync(script).length).toBeLessThan(300 * 1024);
            expect(await readFile(join(dir, 'export/BLOCKLY-LICENSE.txt'), 'utf8')).toBe(
                await readFile('node_modules/blockly/LICENSE', 'utf8'),
            );
            expect(await readFile(join(dir, 'export/media/sprites.svg'), 'utf8')).toBe(
                await readFile('node_modules/blockly/media/sprites.svg', 'utf8'),
            );
            expect((await readFile(join(dir, 'edition/mini-scratch.js'), 'utf8')).includes('Load example')).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
