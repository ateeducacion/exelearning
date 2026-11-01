/**
 * Lazy loading of the `<model-viewer>` custom element (the GLB/GLTF path).
 *
 * The element is registered once per page. Both bundles coordinate through
 * `window.$exeLibs.modelViewerPromise`, so an editor preview and an exported
 * viewer on the same document never inject the script twice.
 */

const SCRIPT_MARKER = 'data-threedviewer-lib';

/**
 * How long to wait for the custom element to register before giving up.
 * `customElements.whenDefined()` never settles for an element that fails to
 * load, and an unresolved promise here would also block the STL render path,
 * which does not need model-viewer at all.
 */
const DEFINITION_TIMEOUT_MS = 15000;

function libs(): Record<string, unknown> {
    globalThis.$exeLibs = globalThis.$exeLibs ?? {};
    return globalThis.$exeLibs;
}

/** True once the custom element is defined. */
export function isModelViewerDefined(): boolean {
    return Boolean(globalThis.customElements?.get?.('model-viewer'));
}

function injectScript(url: string, origin: string): Promise<void> {
    return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = url;
        script.setAttribute(SCRIPT_MARKER, origin);
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => {
            console.error('[3D Viewer] Unable to load the model-viewer library from', url);
            // Resolve rather than reject: callers boot anyway and degrade to the
            // empty state instead of leaving a pending promise behind.
            resolve();
        });
        document.head.appendChild(script);
    });
}

/**
 * Ensure `<model-viewer>` is defined, trying each candidate URL in order.
 * Always resolves — a missing library shows the empty state, never an unhandled
 * rejection in the middle of the workarea.
 */
export async function ensureModelViewerLoaded(candidates: readonly string[], origin: 'edition' | 'export'): Promise<void> {
    if (isModelViewerDefined()) {
        return;
    }
    const shared = libs();
    const pending = shared.modelViewerPromise;
    if (pending instanceof Promise) {
        await pending;
        return;
    }
    const existing = typeof document !== 'undefined' ? document.querySelector(`script[${SCRIPT_MARKER}]`) : null;
    const loading = (async () => {
        if (!existing) {
            for (const url of candidates.filter(Boolean)) {
                if (isModelViewerDefined()) {
                    return;
                }
                await injectScript(url, origin);
                if (isModelViewerDefined()) {
                    return;
                }
            }
        }
        const whenDefined = globalThis.customElements?.whenDefined;
        if (whenDefined) {
            try {
                await Promise.race([
                    whenDefined.call(globalThis.customElements, 'model-viewer'),
                    new Promise(resolve => setTimeout(resolve, DEFINITION_TIMEOUT_MS)),
                ]);
            } catch {
                // Never registered: the caller shows the empty state.
            }
        }
    })();
    shared.modelViewerPromise = loading;
    await loading;
}
