import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getAssetManager,
    isPreviewContext,
    recoverAssetRefFromBlob,
    resolveAssetUrlAsync,
    resolveMediaUrlSync,
    resolveModelSource,
    waitForAssetManager,
} from './asset-resolver';

function installAssetManager(manager: ExeAssetManager | null): void {
    globalThis.eXeLearning = manager ? { app: { project: { assetManager: manager } } } : undefined;
}

afterEach(() => {
    globalThis.eXeLearning = undefined;
    vi.restoreAllMocks();
});

describe('getAssetManager / isPreviewContext', () => {
    it('reads the manager from the project', () => {
        const manager: ExeAssetManager = {};
        installAssetManager(manager);
        expect(getAssetManager()).toBe(manager);
        expect(isPreviewContext()).toBe(true);
    });

    it('falls back to the Yjs bridge', () => {
        const manager: ExeAssetManager = {};
        globalThis.eXeLearning = { app: { project: { _yjsBridge: { assetManager: manager } } } };
        expect(getAssetManager()).toBe(manager);
    });

    it('returns null in an export context', () => {
        installAssetManager(null);
        expect(getAssetManager()).toBeNull();
        expect(isPreviewContext()).toBe(false);
    });
});

describe('resolveModelSource', () => {
    it('returns an empty string for empty or non-string input', async () => {
        await expect(resolveModelSource('')).resolves.toBe('');
        await expect(resolveModelSource(null)).resolves.toBe('');
        await expect(resolveModelSource('   ')).resolves.toBe('');
    });

    it('passes absolute and relative sources straight through', async () => {
        await expect(resolveModelSource('https://example.org/a.glb')).resolves.toBe('https://example.org/a.glb');
        await expect(resolveModelSource(' content/resources/a.stl ')).resolves.toBe('content/resources/a.stl');
    });

    it('resolves asset:// synchronously when the manager has it cached', async () => {
        const manager: ExeAssetManager = { resolveAssetURLSync: () => 'blob:cached' };
        await expect(resolveModelSource('asset://a.glb', manager)).resolves.toBe('blob:cached');
    });

    it('falls back to the async resolver', async () => {
        const manager: ExeAssetManager = {
            resolveAssetURLSync: () => null,
            resolveAssetURL: async () => 'blob:async',
        };
        await expect(resolveModelSource('asset://a.glb', manager)).resolves.toBe('blob:async');
    });

    it('returns an empty string when there is no manager or the manager throws', async () => {
        installAssetManager(null);
        await expect(resolveModelSource('asset://a.glb')).resolves.toBe('');
        const manager: ExeAssetManager = {
            resolveAssetURLSync: () => {
                throw new Error('nope');
            },
        };
        await expect(resolveModelSource('asset://a.glb', manager)).resolves.toBe('');
    });
});

describe('resolveMediaUrlSync', () => {
    it('leaves non-asset URLs alone', () => {
        expect(resolveMediaUrlSync('https://example.org/a.png')).toBe('https://example.org/a.png');
        expect(resolveMediaUrlSync('')).toBe('');
        expect(resolveMediaUrlSync(null)).toBe('');
    });

    it('resolves an asset:// URL through the manager', () => {
        expect(resolveMediaUrlSync('asset://a.png', { resolveAssetURLSync: () => 'blob:x' })).toBe('blob:x');
    });

    it('returns the original when the manager is missing, empty or throwing', () => {
        installAssetManager(null);
        expect(resolveMediaUrlSync('asset://a.png')).toBe('asset://a.png');
        expect(resolveMediaUrlSync('asset://a.png', { resolveAssetURLSync: () => null })).toBe('asset://a.png');
        expect(
            resolveMediaUrlSync('asset://a.png', {
                resolveAssetURLSync: () => {
                    throw new Error('nope');
                },
            }),
        ).toBe('asset://a.png');
    });
});

describe('resolveAssetUrlAsync', () => {
    it('returns null for a non-asset URL', async () => {
        await expect(resolveAssetUrlAsync('https://example.org/a.glb')).resolves.toBeNull();
    });

    it('resolves once the asset becomes available', async () => {
        let calls = 0;
        installAssetManager({
            resolveAssetURLSync: () => (++calls >= 2 ? 'blob:ready' : null),
        });
        await expect(resolveAssetUrlAsync('asset://a.glb', 1000, 1)).resolves.toBe('blob:ready');
    });

    it('gives up at the deadline', async () => {
        installAssetManager({ resolveAssetURLSync: () => null });
        await expect(resolveAssetUrlAsync('asset://a.glb', 5, 1)).resolves.toBeNull();
    });
});

describe('recoverAssetRefFromBlob', () => {
    it('rebuilds `<id>.<ext>` from the reverse blob cache and the metadata', () => {
        const manager: ExeAssetManager = {
            reverseBlobCache: { get: () => 'uuid-1' },
            getAssetMetadata: () => ({ filename: 'Model.GLB' }),
        };
        expect(recoverAssetRefFromBlob('blob:http://x/1', manager)).toBe('uuid-1.glb');
    });

    it('falls back to the bare id when there is no filename extension', () => {
        const manager: ExeAssetManager = {
            reverseBlobCache: { get: () => 'uuid-1' },
            getAssetMetadata: () => ({ filename: 'model' }),
        };
        expect(recoverAssetRefFromBlob('blob:http://x/1', manager)).toBe('uuid-1');
    });

    it('returns an empty string when recovery is impossible', () => {
        expect(recoverAssetRefFromBlob('asset://a.glb', {})).toBe('');
        expect(recoverAssetRefFromBlob(null, {})).toBe('');
        expect(recoverAssetRefFromBlob('blob:http://x/1', { reverseBlobCache: { get: () => null } })).toBe('');
    });
});

describe('waitForAssetManager', () => {
    it('returns the manager as soon as it appears', async () => {
        const manager: ExeAssetManager = {};
        setTimeout(() => installAssetManager(manager), 2);
        await expect(waitForAssetManager(500, 1)).resolves.toBe(manager);
    });

    it('returns null at the deadline', async () => {
        installAssetManager(null);
        await expect(waitForAssetManager(5, 1)).resolves.toBeNull();
    });
});
