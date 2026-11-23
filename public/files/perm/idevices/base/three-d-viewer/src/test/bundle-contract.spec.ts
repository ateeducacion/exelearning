/**
 * Generated-bundle contract tests.
 *
 * These evaluate the ACTUAL compiled IIFEs (built by
 * `scripts/build-idevices.ts`) inside the happy-dom window and assert the
 * classic-script contracts eXeLearning depends on. They catch bundling problems
 * — a broken entry point, a tree-shaken global, a chunked output — that
 * source-level imports would never detect.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const ideviceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = join(ideviceRoot, '..', '..', '..', '..', '..');
const editionBundle = join(ideviceRoot, 'edition', 'three-d-viewer.js');
const exportBundle = join(ideviceRoot, 'export', 'three-d-viewer.js');

interface ContractWindow {
    $exeDevice?: { i18n?: { name?: string }; init?: unknown; save?: unknown; handleMarkerPlaced?: unknown };
    $threedviewer?: { renderView?: unknown; renderBehaviour?: unknown; init?: unknown; resolveBootConfig?: unknown };
    ThreeDViewerExportObject?: new () => { init(node: unknown): boolean; toJSON(): unknown };
    eXe3DViewer?: { init?: unknown; destroy?: unknown; createInteractionLayer?: unknown; getInstance?: unknown };
}

function runBundle(path: string): void {
    // Evaluate as a classic script: an IIFE with no imports and no exports.
    new Function(readFileSync(path, 'utf-8'))();
}

function contractWindow(): ContractWindow {
    return window as unknown as ContractWindow;
}

beforeAll(() => {
    // happy-dom never upgrades the real <model-viewer> (it needs WebGL), so
    // register a stand-in and let the bundles resolve their loader immediately.
    if (!customElements.get('model-viewer')) {
        customElements.define('model-viewer', class extends HTMLElement {});
    }
    if (!existsSync(editionBundle) || !existsSync(exportBundle)) {
        execSync('bun scripts/build-idevices.ts --only three-d-viewer', { cwd: repoRoot, stdio: 'pipe' });
    }
});

afterEach(() => {
    const contract = contractWindow();
    delete contract.$exeDevice;
    delete contract.$threedviewer;
    delete contract.ThreeDViewerExportObject;
    delete contract.eXe3DViewer;
});

describe.each([
    ['edition', editionBundle],
    ['export', exportBundle],
])('generated bundle shape — %s', (_name, bundle) => {
    it('is a self-contained classic script (no module syntax, no chunk imports)', () => {
        const code = readFileSync(bundle, 'utf-8');
        expect(code).not.toMatch(/^\s*import[\s{]/m);
        expect(code).not.toMatch(/^\s*export[\s{]/m);
        expect(code).not.toContain('require(');
        expect(code.trimStart().startsWith('(() => {')).toBe(true);
    });

    it('links a source map rather than inlining one', () => {
        const code = readFileSync(bundle, 'utf-8');
        expect(code).toContain('sourceMappingURL=three-d-viewer.js.map');
        expect(code).not.toContain('sourceMappingURL=data:');
        expect(existsSync(`${bundle}.map`)).toBe(true);
    });
});

describe('generated bundle contract — edition', () => {
    it('exposes window.$exeDevice with the JSON-iDevice editor contract', () => {
        runBundle(editionBundle);
        const device = contractWindow().$exeDevice;
        expect(device).toBeTruthy();
        expect(typeof device?.init).toBe('function');
        expect(typeof device?.save).toBe('function');
        expect(typeof device?.handleMarkerPlaced).toBe('function');
        expect(typeof device?.i18n?.name).toBe('string');
    });

    it('publishes the shared viewer runtime its live preview drives', () => {
        runBundle(editionBundle);
        const runtime = contractWindow().eXe3DViewer;
        expect(typeof runtime?.init).toBe('function');
        expect(typeof runtime?.destroy).toBe('function');
        expect(typeof runtime?.getInstance).toBe('function');
        expect(typeof runtime?.createInteractionLayer).toBe('function');
    });

    it('renders its editor into a host element', async () => {
        runBundle(editionBundle);
        const device = contractWindow().$exeDevice as {
            init: (element: HTMLElement, data?: unknown) => Promise<void>;
        };
        const host = document.createElement('div');
        document.body.appendChild(host);
        try {
            await device.init(host, { schemaVersion: 2, src: 'content/resources/a.glb' });
            expect(host.querySelector('#threeDViewerEditor')).not.toBeNull();
            expect(host.querySelector<HTMLInputElement>('#threeD3DModelFile')?.value).toBe('content/resources/a.glb');
        } finally {
            document.body.removeChild(host);
        }
    });
});

describe('generated bundle contract — export', () => {
    it('exposes window.$threedviewer with the learner-runtime contract', () => {
        runBundle(exportBundle);
        const runtime = contractWindow().$threedviewer;
        expect(runtime).toBeTruthy();
        expect(typeof runtime?.renderView).toBe('function');
        expect(typeof runtime?.renderBehaviour).toBe('function');
        expect(typeof runtime?.resolveBootConfig).toBe('function');
        expect(typeof runtime?.init).toBe('function');
    });

    it('exposes window.ThreeDViewerExportObject and window.eXe3DViewer', () => {
        runBundle(exportBundle);
        const contract = contractWindow();
        expect(typeof contract.ThreeDViewerExportObject).toBe('function');
        const helper = new (
            contract.ThreeDViewerExportObject as new () => {
                init(node: unknown): boolean;
                toJSON(): unknown;
            }
        )();
        expect(helper.init(null)).toBe(true);
        expect(helper.toJSON()).toEqual({});
        expect(typeof contract.eXe3DViewer?.createInteractionLayer).toBe('function');
    });

    it('renders a schema-v2 document end to end through the compiled bundle', () => {
        runBundle(exportBundle);
        const runtime = contractWindow().$threedviewer as {
            renderView: (data: unknown, accessibility?: unknown, template?: string) => string;
            renderBehaviour: (data: unknown, accessibility?: unknown, ideviceId?: string) => boolean;
        };
        const document_ = {
            schemaVersion: 2,
            src: 'content/resources/cube.glb',
            alt: 'Cube',
            interaction: {
                enabled: true,
                guidedMode: true,
                markers: [
                    {
                        id: 'marker-1',
                        label: 'Summit',
                        anchor: { position: { x: 0, y: 1, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
                        action: { type: 'information', payload: { html: '<p>Top</p>' } },
                    },
                ],
            },
            scorm: { mode: 1, weighted: 100, saveButtonText: '' },
        };

        const html = runtime.renderView({ ...document_, ideviceId: 'bundle-smoke' }, undefined, '{content}');
        expect(html).toContain('three-d-viewer-wrapper');
        expect(html).toContain('data-model-src="content/resources/cube.glb"');
        expect(html).toContain('tdv-interaction-data');
        expect(html).toContain('tdv-fallback');
        expect(html).toContain('Summit');

        const host = document.createElement('div');
        host.innerHTML = html;
        document.body.appendChild(host);
        try {
            expect(runtime.renderBehaviour(document_, undefined, 'bundle-smoke')).toBe(true);
        } finally {
            document.body.removeChild(host);
        }
    });

    it('never leaks a blob: URL from marker media into the rendered markup', () => {
        runBundle(exportBundle);
        const runtime = contractWindow().$threedviewer as {
            renderView: (data: unknown, accessibility?: unknown, template?: string) => string;
        };
        const html = runtime.renderView(
            {
                schemaVersion: 2,
                src: 'content/resources/cube.glb',
                interaction: {
                    enabled: true,
                    markers: [{ id: 'm1', action: { type: 'image', payload: { src: 'blob:http://x/1' } } }],
                },
            },
            undefined,
            '{content}',
        );
        expect(html).not.toContain('blob:');
    });
});

describe('generated bundles side by side', () => {
    it('share one viewer runtime instead of replacing each other', () => {
        runBundle(exportBundle);
        const first = contractWindow().eXe3DViewer;
        runBundle(editionBundle);
        expect(contractWindow().eXe3DViewer).toBe(first);
    });
});
