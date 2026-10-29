/**
 * Generated-bundle contract tests.
 *
 * These run the ACTUAL compiled IIFE bundles (built by
 * scripts/build-idevices.ts) inside the happy-dom window and assert the
 * classic-script contracts eXeLearning depends on. They catch bundling
 * problems — a broken entry point, tree-shaken globals, chunked output,
 * dynamic imports, execution-order assumptions — that source-level imports
 * alone would never detect.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const ideviceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = join(ideviceRoot, '..', '..', '..', '..', '..');
const editionBundle = join(ideviceRoot, 'edition', 'three-sixty-viewer.js');
const exportBundle = join(ideviceRoot, 'export', 'three-sixty-viewer.js');

interface ContractWindow {
    $exeDevice?: {
        i18n?: { name?: string };
        init?: (element: HTMLElement, previousData: unknown, idevicePath?: string) => void;
        save?: () => unknown;
        destroy?: () => void;
        hydrateDocument?: (input: unknown) => { status: string };
    };
    $threesixtyviewer?: {
        cssClass?: string;
        SCHEMA_VERSION?: number;
        renderView?: (data: unknown, accesibility: unknown, template: unknown) => string;
        renderBehaviour?: (data: unknown, accesibility?: unknown) => void;
        init?: () => void;
        renderOne?: unknown;
        extractState?: unknown;
        normalize?: (input: unknown) => Record<string, unknown>;
        hydrateDocument?: (input: unknown) => { status: string };
        destroyAll?: () => void;
    };
    _?: (text: string) => string;
}

function runBundle(path: string): void {
    const code = readFileSync(path, 'utf-8');
    // Evaluate as a classic script: an IIFE with no imports/exports.
    new Function(code)();
}

function contractWindow(): ContractWindow {
    return window as unknown as ContractWindow;
}

beforeAll(() => {
    if (!existsSync(editionBundle) || !existsSync(exportBundle)) {
        execSync('bun scripts/build-idevices.ts --only three-sixty-viewer', { cwd: repoRoot, stdio: 'pipe' });
    }
});

afterEach(() => {
    const w = contractWindow();
    w.$threesixtyviewer?.destroyAll?.();
    delete w.$exeDevice;
    delete w.$threesixtyviewer;
    delete w._;
    document.body.innerHTML = '';
});

describe('generated bundle contract — edition', () => {
    it('is a self-contained classic script (no module syntax, no chunk imports)', () => {
        const code = readFileSync(editionBundle, 'utf-8');
        expect(code).not.toMatch(/^\s*import[\s{]/m);
        expect(code).not.toMatch(/^\s*export[\s{]/m);
        expect(code).not.toContain('require(');
        expect(code).not.toContain('import(');
    });

    it('exposes window.$exeDevice with the JSON-iDevice editor contract', () => {
        runBundle(editionBundle);
        const device = contractWindow().$exeDevice;
        expect(device).toBeTruthy();
        expect(typeof device?.init).toBe('function');
        expect(typeof device?.save).toBe('function');
        expect(typeof device?.destroy).toBe('function');
        expect(typeof device?.i18n?.name).toBe('string');
        expect(typeof device?.hydrateDocument).toBe('function');
    });

    it('re-evaluating the bundle reassigns a fresh $exeDevice (workarea reload contract)', () => {
        runBundle(editionBundle);
        const first = contractWindow().$exeDevice;
        runBundle(editionBundle);
        const second = contractWindow().$exeDevice;
        expect(second).toBeTruthy();
        expect(second).not.toBe(first);
    });

    it('drives a real edit round-trip: init with v1 data, save v2', () => {
        contractWindow()._ = text => text;
        runBundle(editionBundle);
        const device = contractWindow().$exeDevice;
        const host = document.createElement('div');
        host.setAttribute('idevice-id', 'idev-contract');
        document.body.appendChild(host);
        device?.init?.(host, { src: 'asset://p.jpg', alt: 'Legacy', zoomEnabled: false }, '');
        expect(host.querySelector('#threeSixtySceneList')).toBeTruthy();
        const saved = device?.save?.() as {
            version: number;
            ideviceId: string;
            scenes: Array<{ src: string; alt: string }>;
            behaviour: { zoomEnabled: boolean };
        };
        expect(saved.version).toBe(2);
        expect(saved.ideviceId).toBe('idev-contract');
        expect(saved.scenes[0]?.src).toBe('asset://p.jpg');
        expect(saved.scenes[0]?.alt).toBe('Legacy');
        expect(saved.behaviour.zoomEnabled).toBe(false);
        device?.destroy?.();
    });
});

describe('generated bundle contract — export', () => {
    it('is a self-contained classic script (no module syntax, no chunk imports)', () => {
        const code = readFileSync(exportBundle, 'utf-8');
        expect(code).not.toMatch(/^\s*import[\s{]/m);
        expect(code).not.toMatch(/^\s*export[\s{]/m);
        expect(code).not.toContain('require(');
    });

    it('evaluates without THREE being loaded (vendor scripts come separately)', () => {
        expect(typeof (globalThis as { THREE?: unknown }).THREE).toBe('undefined');
        runBundle(exportBundle);
        expect(contractWindow().$threesixtyviewer).toBeTruthy();
    });

    it('exposes window.$threesixtyviewer with the JSON-iDevice engine contract', () => {
        runBundle(exportBundle);
        const runtime = contractWindow().$threesixtyviewer;
        expect(runtime?.cssClass).toBe('three-sixty-viewer');
        expect(runtime?.SCHEMA_VERSION).toBe(2);
        expect(typeof runtime?.renderView).toBe('function');
        expect(typeof runtime?.renderBehaviour).toBe('function');
        expect(typeof runtime?.init).toBe('function');
        expect(typeof runtime?.renderOne).toBe('function');
        expect(typeof runtime?.extractState).toBe('function');
        expect(typeof runtime?.destroyAll).toBe('function');
    });

    it('renders the view and migrates v1 data through the real bundle', () => {
        runBundle(exportBundle);
        const runtime = contractWindow().$threesixtyviewer;
        const html = runtime?.renderView?.(
            { src: 'asset://p.jpg', alt: 'From v1' },
            null,
            '<article>{content}</article>',
        );
        expect(html).toContain('aria-label="From v1"');
        const normalized = runtime?.normalize?.({ src: 'asset://p.jpg', alt: 'From v1' }) as {
            version: number;
            scenes: Array<{ src: string }>;
        };
        expect(normalized.version).toBe(2);
        expect(normalized.scenes[0]?.src).toBe('asset://p.jpg');
        expect(runtime?.hydrateDocument?.({ version: 3 }).status).toBe('unsupported-version');
    });
});
