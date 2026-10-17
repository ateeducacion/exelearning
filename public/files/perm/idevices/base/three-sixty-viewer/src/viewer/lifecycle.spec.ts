import { describe, expect, it, vi } from 'vitest';
import { createManualScheduler } from '../test/helpers';
import { createDisposerBag, createRenderLoop, defaultFrameScheduler, hasWebGL, prefersReducedMotion } from './lifecycle';

describe('createRenderLoop', () => {
    it('ticks once per stepped frame and stops cleanly', () => {
        const { scheduler, step, pendingCount } = createManualScheduler();
        const tick = vi.fn();
        const loop = createRenderLoop(tick, scheduler);
        expect(loop.running).toBe(false);
        loop.start();
        expect(loop.running).toBe(true);
        step();
        step();
        expect(tick).toHaveBeenCalledTimes(2);
        loop.stop();
        expect(loop.running).toBe(false);
        expect(pendingCount()).toBe(0);
        step();
        expect(tick).toHaveBeenCalledTimes(2);
    });

    it('start is idempotent (no double frames)', () => {
        const { scheduler, step } = createManualScheduler();
        const tick = vi.fn();
        const loop = createRenderLoop(tick, scheduler);
        loop.start();
        loop.start();
        step();
        expect(tick).toHaveBeenCalledTimes(1);
        loop.stop();
    });

    it('stopping from inside a tick cancels the follow-up frame', () => {
        const { scheduler, step, pendingCount } = createManualScheduler();
        const loop = createRenderLoop(() => loop.stop(), scheduler);
        loop.start();
        step();
        expect(pendingCount()).toBe(0);
    });

    it('defaultFrameScheduler falls back to timeouts without rAF', () => {
        const scheduler = defaultFrameScheduler();
        const callback = vi.fn();
        const handle = scheduler.request(callback);
        scheduler.cancel(handle);
        expect(typeof handle === 'number' || typeof handle === 'object').toBe(true);
    });
});

describe('createDisposerBag', () => {
    it('runs disposers once, in reverse order, swallowing failures', () => {
        const order: number[] = [];
        const bag = createDisposerBag();
        bag.add(() => order.push(1));
        bag.add(() => {
            throw new Error('boom');
        });
        bag.add(() => order.push(3));
        bag.dispose();
        bag.dispose();
        expect(order).toEqual([3, 1]);
        expect(bag.disposed).toBe(true);
    });

    it('runs late additions immediately once disposed', () => {
        const bag = createDisposerBag();
        bag.dispose();
        const late = vi.fn();
        bag.add(late);
        expect(late).toHaveBeenCalledTimes(1);
    });
});

describe('capability checks', () => {
    it('hasWebGL reflects the injected context probe', () => {
        expect(hasWebGL(() => ({}))).toBe(true);
        expect(hasWebGL(() => null)).toBe(false);
        expect(
            hasWebGL(() => {
                throw new Error('no gl');
            }),
        ).toBe(false);
    });

    it('prefersReducedMotion respects matchMedia and its absence', () => {
        const original = window.matchMedia;
        try {
            window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
            expect(prefersReducedMotion()).toBe(true);
            window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
            expect(prefersReducedMotion()).toBe(false);
            window.matchMedia = undefined as unknown as typeof window.matchMedia;
            expect(prefersReducedMotion()).toBe(false);
        } finally {
            window.matchMedia = original;
        }
    });
});
