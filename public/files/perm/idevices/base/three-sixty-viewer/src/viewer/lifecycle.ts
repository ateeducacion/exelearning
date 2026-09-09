/**
 * Runtime lifecycle helpers: render loops, disposer bags, capability and
 * reduced-motion checks. Timers are injectable so tests run without a real
 * requestAnimationFrame.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface FrameScheduler {
    readonly request: (callback: () => void) => number;
    readonly cancel: (handle: number) => void;
}

/** requestAnimationFrame when available, 16 ms timeouts otherwise. */
export function defaultFrameScheduler(): FrameScheduler {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        return {
            request: callback => window.requestAnimationFrame(callback),
            cancel: handle => window.cancelAnimationFrame(handle),
        };
    }
    return {
        request: callback => setTimeout(callback, 16) as unknown as number,
        cancel: handle => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>),
    };
}

export interface RenderLoop {
    start: () => void;
    stop: () => void;
    readonly running: boolean;
}

/** A stoppable per-frame loop; `tick` runs once per scheduled frame. */
export function createRenderLoop(tick: () => void, scheduler: FrameScheduler = defaultFrameScheduler()): RenderLoop {
    let handle: number | null = null;
    let running = false;
    const frame = (): void => {
        if (!running) return;
        tick();
        if (running) {
            handle = scheduler.request(frame);
        }
    };
    return {
        get running() {
            return running;
        },
        start() {
            if (running) return;
            running = true;
            handle = scheduler.request(frame);
        },
        stop() {
            running = false;
            if (handle !== null) {
                scheduler.cancel(handle);
                handle = null;
            }
        },
    };
}

/** Collects cleanup callbacks; disposing runs them once, ignoring failures. */
export interface DisposerBag {
    add: (dispose: () => void) => void;
    dispose: () => void;
    readonly disposed: boolean;
}

export function createDisposerBag(): DisposerBag {
    const disposers: Array<() => void> = [];
    let disposed = false;
    return {
        get disposed() {
            return disposed;
        },
        add(dispose) {
            if (disposed) {
                dispose();
                return;
            }
            disposers.push(dispose);
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            // LIFO, so later resources release before what they depend on.
            for (let i = disposers.length - 1; i >= 0; i--) {
                try {
                    disposers[i]?.();
                } catch {
                    // A failing disposer must not stop the others.
                }
            }
            disposers.length = 0;
        },
    };
}

/** WebGL availability check (used to decide between viewer and fallback). */
export function hasWebGL(create: (canvas: HTMLCanvasElement) => unknown = probeContext): boolean {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(create(canvas));
    } catch {
        return false;
    }
}

function probeContext(canvas: HTMLCanvasElement): unknown {
    return canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
}

/** Honour the user's reduced-motion preference (disables autorotation). */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}
