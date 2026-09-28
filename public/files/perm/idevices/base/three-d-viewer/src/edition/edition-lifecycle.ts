/**
 * The lifecycle an edition runs under.
 *
 * In the workarea `IdeviceNode` hands every edition an `EditionLifecycle` on
 * `$exeDevice.$lifecycle`. Outside it (a test harness, a standalone page)
 * nothing will ever close the edition, so the fallback behaves exactly like
 * the platform: always active, listeners and timers left to the page.
 */
export function resolveEditionLifecycle(lifecycle: ExeEditionLifecycle | undefined): ExeEditionLifecycle {
    return (
        lifecycle ?? {
            isActive: () => true,
            own: () => () => undefined,
            addEventListener: (target, type, handler) => target.addEventListener(type, handler),
            setTimeout: (callback, delay) => setTimeout(callback, delay),
            delay: ms => new Promise(resolve => setTimeout(resolve, ms)),
        }
    );
}
