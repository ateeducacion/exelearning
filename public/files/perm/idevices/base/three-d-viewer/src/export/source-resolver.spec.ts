import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveRuntimeSrc } from './source-resolver';

beforeEach(() => {
    globalThis.eXeLearning = undefined;
    document.documentElement.id = '';
});

afterEach(() => {
    globalThis.eXeLearning = undefined;
    document.documentElement.id = '';
});

describe('resolveRuntimeSrc', () => {
    it('returns an empty string for empty input', () => {
        expect(resolveRuntimeSrc('')).toBe('');
        expect(resolveRuntimeSrc(null)).toBe('');
    });

    it('passes absolute and blob URLs through', () => {
        expect(resolveRuntimeSrc('https://example.org/a.glb')).toBe('https://example.org/a.glb');
        expect(resolveRuntimeSrc('blob:http://localhost/1')).toBe('blob:http://localhost/1');
    });

    it('resolves an asset:// handle to a blob URL when AssetManager is live', () => {
        globalThis.eXeLearning = {
            app: { project: { assetManager: { resolveAssetURLSync: () => 'blob:cached' } } },
        };
        expect(resolveRuntimeSrc('asset://a.glb')).toBe('blob:cached');
    });

    it('returns an empty string when AssetManager has not cached the asset yet', () => {
        globalThis.eXeLearning = {
            app: { project: { assetManager: { resolveAssetURLSync: () => null } } },
        };
        // The caller awaits the async resolver rather than requesting a 404.
        expect(resolveRuntimeSrc('asset://a.glb')).toBe('');
    });

    it('maps an asset:// handle onto the packaged resources path in an export', () => {
        document.documentElement.id = 'exe-index';
        expect(resolveRuntimeSrc('asset://uuid.glb')).toBe('content/resources/uuid.glb');
        document.documentElement.id = 'exe-page';
        expect(resolveRuntimeSrc('asset://uuid.glb')).toBe('../content/resources/uuid.glb');
    });

    it('returns an empty string for an asset:// URL with no path', () => {
        expect(resolveRuntimeSrc('asset://')).toBe('');
    });

    it('keeps already-rewritten resource paths RELATIVE', () => {
        // Making them absolute would bypass the preview service worker and 404.
        expect(resolveRuntimeSrc('content/resources/a.stl')).toBe('content/resources/a.stl');
        expect(resolveRuntimeSrc('../content/resources/a.stl')).toBe('../content/resources/a.stl');
    });

    it('resolves session-scoped temporary uploads against the app base', () => {
        globalThis.eXeLearning = { symfony: { baseURL: 'https://host' } };
        expect(resolveRuntimeSrc('files/tmp/2026/07/30/x/a.glb')).toBe('https://host/files/tmp/2026/07/30/x/a.glb');
    });

    it('builds the session path for a plain file-manager reference', () => {
        globalThis.eXeLearning = {
            symfony: { baseURL: 'https://host' },
            app: { project: { odeSession: '20260730abcdef' } },
        };
        expect(resolveRuntimeSrc('file_manager/a.glb')).toBe(
            'https://host/files/tmp/2026/07/30/20260730abcdef/file_manager/a.glb',
        );
    });

    it('falls back to the plain app URL without a session', () => {
        globalThis.eXeLearning = { symfony: { baseURL: 'https://host' } };
        expect(resolveRuntimeSrc('file_manager/a.glb')).toBe('https://host/file_manager/a.glb');
    });

    it('ignores a session id that is too short to carry a date', () => {
        globalThis.eXeLearning = {
            symfony: { baseURL: 'https://host' },
            app: { project: { odeSession: 'short' } },
        };
        expect(resolveRuntimeSrc('file_manager/a.glb')).toBe('https://host/file_manager/a.glb');
    });
});
