import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDom } from '../test/helpers';
import { ensureModelViewerLoaded, isModelViewerDefined } from './model-viewer-loader';

/**
 * `customElements.define` cannot be undone, so the tests drive the loader
 * through a stubbed registry rather than the real one.
 */
function stubRegistry(defined: boolean, whenDefined?: () => Promise<unknown>): void {
    vi.stubGlobal('customElements', {
        get: () => (defined ? class {} : undefined),
        define: () => {},
        whenDefined: whenDefined ?? (() => Promise.resolve()),
    });
}

beforeEach(() => {
    globalThis.$exeLibs = undefined;
    document.head.innerHTML = '';
});

afterEach(() => {
    globalThis.$exeLibs = undefined;
    document.head.innerHTML = '';
    vi.unstubAllGlobals();
    resetDom();
    vi.restoreAllMocks();
});

describe('isModelViewerDefined', () => {
    it('reflects the custom-element registry', () => {
        stubRegistry(true);
        expect(isModelViewerDefined()).toBe(true);
        stubRegistry(false);
        expect(isModelViewerDefined()).toBe(false);
    });
});

describe('ensureModelViewerLoaded', () => {
    it('returns immediately when the element is already defined', async () => {
        stubRegistry(true);
        await ensureModelViewerLoaded(['a.js'], 'export');
        expect(document.head.querySelectorAll('script')).toHaveLength(0);
    });

    it('injects the script and marks its origin', async () => {
        stubRegistry(false);
        const promise = ensureModelViewerLoaded(['lib.js'], 'edition');
        const script = document.head.querySelector('script');
        expect(script?.getAttribute('src')).toBe('lib.js');
        expect(script?.getAttribute('data-threedviewer-lib')).toBe('edition');
        script?.dispatchEvent(new Event('load'));
        await promise;
    });

    it('tries the next candidate when one fails, and skips falsy entries', async () => {
        stubRegistry(false);
        const promise = ensureModelViewerLoaded(['first.js', '', 'second.js'], 'export');
        const first = document.head.querySelector('script');
        first?.dispatchEvent(new Event('error'));
        await Promise.resolve();
        await Promise.resolve();
        const scripts = document.head.querySelectorAll('script');
        expect(scripts).toHaveLength(2);
        scripts[1]?.dispatchEvent(new Event('load'));
        await promise;
    });

    it('stops injecting once the element registers', async () => {
        let defined = false;
        vi.stubGlobal('customElements', {
            get: () => (defined ? class {} : undefined),
            whenDefined: () => Promise.resolve(),
        });
        const promise = ensureModelViewerLoaded(['first.js', 'second.js'], 'export');
        defined = true;
        document.head.querySelector('script')?.dispatchEvent(new Event('load'));
        await promise;
        expect(document.head.querySelectorAll('script')).toHaveLength(1);
    });

    it('waits for an in-flight load started by the other bundle', async () => {
        stubRegistry(false);
        let resolveShared: () => void = () => {};
        globalThis.$exeLibs = {
            modelViewerPromise: new Promise<void>(resolve => {
                resolveShared = resolve;
            }),
        };
        let settled = false;
        const promise = ensureModelViewerLoaded(['lib.js'], 'export').then(() => {
            settled = true;
        });
        expect(document.head.querySelectorAll('script')).toHaveLength(0);
        resolveShared();
        await promise;
        expect(settled).toBe(true);
    });

    it('does not inject a second script when one is already on the page', async () => {
        stubRegistry(false);
        const existing = document.createElement('script');
        existing.setAttribute('data-threedviewer-lib', 'edition');
        document.head.appendChild(existing);
        await ensureModelViewerLoaded(['lib.js'], 'export');
        expect(document.head.querySelectorAll('script')).toHaveLength(1);
    });

    it('gives up after the definition timeout instead of hanging forever', async () => {
        vi.useFakeTimers();
        try {
            // A library that never registers would leave `whenDefined` pending,
            // which must not block the STL path that needs no model-viewer.
            stubRegistry(false, () => new Promise(() => {}));
            let settled = false;
            const promise = ensureModelViewerLoaded([], 'export').then(() => {
                settled = true;
            });
            await vi.advanceTimersByTimeAsync(15000);
            await promise;
            expect(settled).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('survives a rejecting whenDefined', async () => {
        stubRegistry(false, () => Promise.reject(new Error('nope')));
        await expect(ensureModelViewerLoaded([], 'export')).resolves.toBeUndefined();
    });

    it('logs when a candidate fails to load', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        stubRegistry(false);
        const promise = ensureModelViewerLoaded(['broken.js'], 'export');
        document.head.querySelector('script')?.dispatchEvent(new Event('error'));
        await promise;
        expect(error).toHaveBeenCalled();
    });
});
