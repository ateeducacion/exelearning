import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, resetDom } from '../test/helpers';
import { hasWebGL, resetWebGLProbe, revealFallback } from './fallback';

beforeEach(resetWebGLProbe);

afterEach(() => {
    globalThis.__tdvForceWebGL = undefined;
    resetWebGLProbe();
    resetDom();
    vi.restoreAllMocks();
});

describe('hasWebGL', () => {
    it('honours the deterministic test override in both directions', () => {
        globalThis.__tdvForceWebGL = false;
        expect(hasWebGL()).toBe(false);
        globalThis.__tdvForceWebGL = true;
        expect(hasWebGL()).toBe(true);
    });

    it('probes a canvas context and memoizes the answer', () => {
        const getContext = vi.fn(() => ({}) as unknown as RenderingContext);
        vi.spyOn(document, 'createElement').mockImplementation(() => ({ getContext }) as unknown as HTMLCanvasElement);
        expect(hasWebGL()).toBe(true);
        expect(hasWebGL()).toBe(true);
        // Memoized: the probe runs once even across repeated calls.
        expect(getContext).toHaveBeenCalledTimes(1);
    });

    it('falls back to experimental-webgl before giving up', () => {
        const getContext = vi.fn((name: string) => (name === 'experimental-webgl' ? ({} as RenderingContext) : null));
        vi.spyOn(document, 'createElement').mockImplementation(() => ({ getContext }) as unknown as HTMLCanvasElement);
        expect(hasWebGL()).toBe(true);
        expect(getContext).toHaveBeenCalledTimes(2);
    });

    it('reports false when no context can be created', () => {
        vi.spyOn(document, 'createElement').mockImplementation(
            () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
        );
        expect(hasWebGL()).toBe(false);
    });

    it('reports false when probing throws', () => {
        vi.spyOn(document, 'createElement').mockImplementation(() => {
            throw new Error('no canvas');
        });
        expect(hasWebGL()).toBe(false);
    });
});

describe('revealFallback', () => {
    it('shows and hides the static marker list', () => {
        const wrapper = createWrapper();
        wrapper.innerHTML = '<ul class="tdv-fallback" hidden></ul>';
        revealFallback(wrapper, true);
        expect(wrapper.querySelector<HTMLElement>('.tdv-fallback')?.hidden).toBe(false);
        revealFallback(wrapper, false);
        expect(wrapper.querySelector<HTMLElement>('.tdv-fallback')?.hidden).toBe(true);
    });

    it('is a no-op without a wrapper or without a list', () => {
        expect(() => revealFallback(null, true)).not.toThrow();
        expect(() => revealFallback(createWrapper(), true)).not.toThrow();
    });
});
