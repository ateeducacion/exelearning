import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindPageHideCleanup } from './index';

beforeEach(() => {
    window.__threesixtyCleanupBound = false;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('bindPageHideCleanup', () => {
    it('binds a single pagehide listener that destroys on a real teardown', () => {
        const destroyAll = vi.fn();
        const addEventListener = vi.spyOn(window, 'addEventListener');

        bindPageHideCleanup({ destroyAll }, window);
        bindPageHideCleanup({ destroyAll }, window);

        const bindings = addEventListener.mock.calls.filter(call => call[0] === 'pagehide');
        expect(bindings).toHaveLength(1);

        const handler = bindings[0][1] as (event: Event) => void;
        const freeze = new Event('pagehide');
        Object.defineProperty(freeze, 'persisted', { value: true });
        handler(freeze);
        expect(destroyAll).not.toHaveBeenCalled();

        const teardown = new Event('pagehide');
        Object.defineProperty(teardown, 'persisted', { value: false });
        handler(teardown);
        expect(destroyAll).toHaveBeenCalledTimes(1);
    });
});
