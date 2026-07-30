/**
 * The accessible text fallback.
 *
 * Exported pages ship a static, escaped `<ul class="tdv-fallback" hidden>`
 * listing every marker. It is revealed whenever the interactive overlay cannot
 * render — no WebGL, a failed STL boot, or no usable adapter — so marker content
 * is never lost to a rendering problem.
 */

/** Memoized WebGL probe result; `null` until first asked. */
let webglAvailable: boolean | null = null;

/** Reset the memoized probe (tests only). */
export function resetWebGLProbe(): void {
    webglAvailable = null;
}

/**
 * Whether this page can create a WebGL context.
 *
 * `window.__tdvForceWebGL` overrides the probe, which is what makes the
 * fallback behaviour deterministic under happy-dom (no WebGL) and Playwright.
 */
export function hasWebGL(): boolean {
    if (typeof globalThis.__tdvForceWebGL === 'boolean') {
        return globalThis.__tdvForceWebGL;
    }
    if (webglAvailable !== null) {
        return webglAvailable;
    }
    try {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            webglAvailable = true;
            return webglAvailable;
        }
        const canvas = document.createElement('canvas');
        webglAvailable = Boolean(
            canvas.getContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
        );
    } catch {
        webglAvailable = false;
    }
    return webglAvailable;
}

/** Show or hide the static marker list inside a wrapper. */
export function revealFallback(wrapper: HTMLElement | null, show: boolean): void {
    const list = wrapper?.querySelector<HTMLElement>('.tdv-fallback');
    if (list) {
        list.hidden = !show;
    }
}
