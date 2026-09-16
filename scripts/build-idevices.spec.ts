import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { discoverTsIdevices, IDEVICES_BASE, resolveEntries } from './build-idevices';

function makeIdevice(base: string, name: string, files: Record<string, string>): string {
    const dir = join(base, name);
    for (const [path, content] of Object.entries(files)) {
        const full = join(dir, path);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, content);
    }
    return dir;
}

describe('discoverTsIdevices', () => {
    it('finds the real TypeScript iDevices of the repo', () => {
        const names = discoverTsIdevices().map(i => i.name);
        expect(names).toContain('three-d-viewer');
        expect(names).toContain('slide');
        // Classic-script iDevices without src/ are not build candidates.
        expect(names).not.toContain('text');
        expect(names).not.toContain('trueorfalse');
    });

    it('honours the --only filter and skips src-less directories', () => {
        const only = discoverTsIdevices(IDEVICES_BASE, ['slide']);
        expect(only.map(i => i.name)).toEqual(['slide']);
        expect(discoverTsIdevices(IDEVICES_BASE, ['no-such-idevice'])).toEqual([]);
    });

    it('records the per-iDevice tsconfig when one exists', () => {
        const byName = new Map(discoverTsIdevices().map(i => [i.name, i]));
        expect(byName.get('three-d-viewer')?.tsconfig).toContain('tsconfig.json');
        expect(byName.get('slide')?.tsconfig).toBeNull();
    });
});

describe('resolveEntries', () => {
    it('builds edition and export by convention from src/<surface>/index.ts', () => {
        const base = mkdtempSync(join(tmpdir(), 'idevice-build-'));
        try {
            const dir = makeIdevice(base, 'demo', {
                'src/edition/index.ts': '',
                'src/export/index.ts': '',
            });
            const entries = resolveEntries('demo', dir);
            expect(entries.map(e => e.label)).toEqual(['demo/edition', 'demo/export']);
            expect(entries[0]).toMatchObject({
                naming: '[dir]/demo.[ext]',
                minify: false,
                sourcemap: 'linked',
                externals: {},
            });
            expect(entries[0]?.outdir.endsWith('/edition')).toBe(true);
        } finally {
            rmSync(base, { recursive: true, force: true });
        }
    });

    it('only emits the surfaces that exist', () => {
        const base = mkdtempSync(join(tmpdir(), 'idevice-build-'));
        try {
            const dir = makeIdevice(base, 'demo', { 'src/edition/index.ts': '' });
            expect(resolveEntries('demo', dir).map(e => e.label)).toEqual(['demo/edition']);
        } finally {
            rmSync(base, { recursive: true, force: true });
        }
    });

    it('lets a build.config.json replace the convention (the slide shape)', () => {
        const base = mkdtempSync(join(tmpdir(), 'idevice-build-'));
        try {
            const dir = makeIdevice(base, 'demo', {
                'src/index.ts': '',
                'build.config.json': JSON.stringify({
                    entries: [
                        {
                            entry: 'src/index.ts',
                            outdir: 'edition',
                            naming: '[dir]/demo.bundle.[ext]',
                            globalName: '__demoInit',
                            minify: true,
                            sourcemap: 'none',
                            externals: {
                                fabric: 'fabric',
                                dompurify: { global: 'DOMPurify', default: true },
                            },
                        },
                    ],
                }),
            });
            const [entry] = resolveEntries('demo', dir);
            expect(entry).toMatchObject({
                naming: '[dir]/demo.bundle.[ext]',
                globalName: '__demoInit',
                minify: true,
                sourcemap: 'none',
                externals: {
                    fabric: { global: 'fabric', default: false },
                    dompurify: { global: 'DOMPurify', default: true },
                },
            });
        } finally {
            rmSync(base, { recursive: true, force: true });
        }
    });

    it('rejects manifest entries without entry/outdir', () => {
        const base = mkdtempSync(join(tmpdir(), 'idevice-build-'));
        try {
            const dir = makeIdevice(base, 'demo', {
                'src/index.ts': '',
                'build.config.json': JSON.stringify({ entries: [{ outdir: 'edition' }] }),
            });
            expect(() => resolveEntries('demo', dir)).toThrow(/entry/);
        } finally {
            rmSync(base, { recursive: true, force: true });
        }
    });

    it('matches the repo state: slide via manifest, three-d-viewer via convention', () => {
        const slide = resolveEntries('slide', join(IDEVICES_BASE, 'slide'));
        expect(slide).toHaveLength(1);
        expect(slide[0]).toMatchObject({
            naming: '[dir]/slide-editor.bundle.[ext]',
            globalName: '__slideEditorInit',
            minify: true,
        });
        const viewer = resolveEntries('three-d-viewer', join(IDEVICES_BASE, 'three-d-viewer'));
        expect(viewer.map(e => e.label)).toEqual(['three-d-viewer/edition', 'three-d-viewer/export']);
    });
});

describe('maintained iDevice sources', () => {
    // A `.gitignore` rule meant for a generated directory can silently match a
    // source directory of the same name at any depth (an unanchored `runtime/`
    // swallowed `three-d-viewer/src/runtime/`). Nothing else catches that: the
    // working tree still builds, only the commit is incomplete.
    it('are never matched by a gitignore rule', () => {
        const sources = discoverTsIdevices().flatMap(idevice =>
            Array.from(new Bun.Glob('src/**/*.ts').scanSync({ cwd: idevice.dir }), file => join(idevice.dir, file)),
        );
        expect(sources.length).toBeGreaterThan(0);

        // --no-index tests the ignore rules themselves. Without it git skips
        // paths already in the index, so a rule that would drop a *new* source
        // file goes unnoticed once someone has force-added the existing ones.
        const check = Bun.spawnSync(['git', 'check-ignore', '--no-index', '--stdin'], {
            cwd: resolve(import.meta.dir, '..'),
            stdin: Buffer.from(`${sources.join('\n')}\n`),
        });

        expect(check.stdout.toString().trim()).toBe('');
    });
});
