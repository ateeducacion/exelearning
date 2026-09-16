import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAssetSrc } from './assets';

type MutableGlobal = { eXeLearning?: unknown };

afterEach(() => {
    delete (globalThis as MutableGlobal).eXeLearning;
});

function installAssetManager(manager: unknown): void {
    (globalThis as MutableGlobal).eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: manager } } },
    };
}

describe('resolveAssetSrc', () => {
    it('passes non-asset URLs through untouched', () => {
        expect(resolveAssetSrc('https://example.com/p.jpg')).toBe('https://example.com/p.jpg');
        expect(resolveAssetSrc('')).toBe('');
        expect(resolveAssetSrc('relative/p.jpg')).toBe('relative/p.jpg');
    });

    it('returns asset URLs unchanged when no eXeLearning global exists', () => {
        expect(resolveAssetSrc('asset://a.jpg')).toBe('asset://a.jpg');
    });

    it('uses the synchronous resolver when available', () => {
        installAssetManager({ resolveAssetURLSync: (src: string) => `blob:${src}` });
        expect(resolveAssetSrc('asset://a.jpg')).toBe('blob:asset://a.jpg');
    });

    it('falls back to the raw source when the sync resolver returns nothing', () => {
        installAssetManager({ resolveAssetURLSync: () => null });
        expect(resolveAssetSrc('asset://a.jpg')).toBe('asset://a.jpg');
    });

    it('kicks off async resolution but returns the original source', () => {
        const resolveAssetURL = vi.fn().mockReturnValue(Promise.resolve('blob:later'));
        installAssetManager({ resolveAssetURL });
        expect(resolveAssetSrc('asset://a.jpg')).toBe('asset://a.jpg');
        expect(resolveAssetURL).toHaveBeenCalledWith('asset://a.jpg');
    });

    it('survives a throwing async resolver', () => {
        installAssetManager({
            resolveAssetURL: () => {
                throw new Error('nope');
            },
        });
        expect(resolveAssetSrc('asset://a.jpg')).toBe('asset://a.jpg');
    });
});
