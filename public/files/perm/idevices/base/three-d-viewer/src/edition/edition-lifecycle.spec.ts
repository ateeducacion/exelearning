import { describe, expect, it, vi } from 'vitest';
import { resolveEditionLifecycle } from './edition-lifecycle';

describe('resolveEditionLifecycle', () => {
    it('returns the lifecycle the workarea published', () => {
        const published = resolveEditionLifecycle(undefined);
        expect(resolveEditionLifecycle(published)).toBe(published);
    });

    it('falls back to plain platform behaviour when there is none', async () => {
        vi.useFakeTimers();
        try {
            const lifecycle = resolveEditionLifecycle(undefined);
            expect(lifecycle.isActive()).toBe(true);
            expect(() => lifecycle.own(() => {})()).not.toThrow();

            const handler = vi.fn();
            const target = new EventTarget();
            lifecycle.addEventListener(target, 'ping', handler);
            target.dispatchEvent(new Event('ping'));
            expect(handler).toHaveBeenCalledTimes(1);

            const timer = vi.fn();
            lifecycle.setTimeout(timer, 10);
            const waited = vi.fn();
            void lifecycle.delay(10).then(waited);
            await vi.advanceTimersByTimeAsync(10);
            expect(timer).toHaveBeenCalledTimes(1);
            expect(waited).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});
