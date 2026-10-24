/** Build the offline Block Programming assets with the existing Bun toolchain. */
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';

const root = resolve(import.meta.dir, '..');
const device = resolve(root, 'public/files/perm/idevices/base/mini-scratch');

/** Keep the published core byte-identical and share one runtime across edition and playback. */
export async function buildMiniScratch(output = device): Promise<number> {
    const result = await Bun.build({
        entrypoints: [resolve(device, 'src/index.ts')],
        target: 'browser',
        format: 'iife',
        minify: true,
        outdir: resolve(output, 'export'),
        naming: 'mini-scratch.js',
        banner:
            '/*! Block Programming - AGPL-3.0-or-later. Source: https://github.com/ateeducacion/exelearning. See MINI-SCRATCH-LICENSE.txt. */\n' +
            'if (!globalThis.$miniscratch) {\n' +
            (await readFile(resolve(root, 'node_modules/blockly/blockly_compressed.js'), 'utf8')) +
            '\n;\n' +
            (await readFile(resolve(root, 'node_modules/blockly/msg/en.js'), 'utf8')) +
            '\n;\n}\n',
    });
    if (!result.success) throw new AggregateError(result.logs, 'Block Programming build failed');
    const edition = await Bun.build({
        entrypoints: [resolve(device, 'src/edition.ts')],
        target: 'browser',
        format: 'iife',
        minify: true,
        outdir: resolve(output, 'edition'),
        naming: 'mini-scratch.js',
    });
    if (!edition.success) throw new AggregateError(edition.logs, 'Block Programming edition build failed');
    await mkdir(resolve(output, 'export/media'), { recursive: true });
    // Sounds and unused image/bitmap blocks are disabled. Keep required UI media local.
    for (const name of [
        'sprites.svg', 'dropdown-arrow.svg', 'delete-icon.svg', 'foldout-icon.svg', 'resize-handle.svg',
        'handclosed.cur', 'handdelete.cur', 'handopen.cur', '1x1.gif',
    ]) {
        await cp(resolve(root, 'node_modules/blockly/media', name), resolve(output, 'export/media', name));
    }
    await cp(resolve(root, 'node_modules/blockly/LICENSE'), resolve(output, 'export/BLOCKLY-LICENSE.txt'));
    await cp(resolve(root, 'LICENSE'), resolve(output, 'export/MINI-SCRATCH-LICENSE.txt'));
    return result.outputs[0].size;
}

/** Compare conventional published UMD and module bundles using the same Bun minifier. */
export async function measurePackaging(output = device) {
    const temporary = await mkdtemp(join(tmpdir(), 'mini-scratch-measure-'));
    const bytes = (data: Uint8Array) => ({ bytes: data.length, gzip: gzipSync(data, { level: 9 }).length });
    try {
        const entry = join(temporary, 'module-core.ts');
        await writeFile(entry, `import * as Blockly from ${JSON.stringify(resolve(root, 'node_modules/blockly/blockly.mjs'))};
import * as English from ${JSON.stringify(resolve(root, 'node_modules/blockly/msg/en.mjs'))};
Blockly.setLocale(English); globalThis.Blockly = Blockly;`);
        const module = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'iife', minify: true });
        const runtime = await Bun.build({ entrypoints: [resolve(device, 'src/index.ts')], target: 'browser', format: 'iife', minify: true });
        if (!module.success || !runtime.success) throw new Error('Packaging comparison failed');
        const core = await readFile(resolve(root, 'node_modules/blockly/blockly_compressed.js'));
        const english = await readFile(resolve(root, 'node_modules/blockly/msg/en.js'));
        const runtimeBytes = new Uint8Array(await runtime.outputs[0].arrayBuffer());
        const bundledModule = Buffer.concat([Buffer.from(await module.outputs[0].arrayBuffer()), runtimeBytes]);
        const files = await readdir(resolve(output, 'export'), { recursive: true, withFileTypes: true });
        const resources: Record<string, { bytes: number; gzip: number }> = {};
        for (const file of files) if (file.isFile()) resources[file.name] = bytes(await readFile(join(file.parentPath, file.name)));
        return {
            blocklyVersion: '13.4.0', core: bytes(core), english: bytes(english), runtime: bytes(runtimeBytes),
            moduleOption: bytes(bundledModule), selectedOption: resources['mini-scratch.js'], resources,
            total: Object.values(resources).reduce((sum, f) => ({ bytes: sum.bytes + f.bytes, gzip: sum.gzip + f.gzip }), { bytes: 0, gzip: 0 }),
        };
    } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (import.meta.main) {
    const size = await buildMiniScratch();
    console.log(process.argv.includes('--measure') ? JSON.stringify(await measurePackaging(), null, 2) : `Block Programming: ${size} bytes (Blockly core, English messages, runtime).`);
}
