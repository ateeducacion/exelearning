/**
 * Lazy loading of the vendored three.js + OrbitControls scripts for the
 * edition preview. The export runtime never needs this (config.xml loads the
 * vendor files before the bundle); the editor loads them on demand the first
 * time a 360° preview renders.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

type LoadCallback = () => void;

let pendingCallbacks: LoadCallback[] | null = null;

/** Candidate base URLs for the vendored files, best first. */
export function vendorBaseCandidates(idevicePath: string): string[] {
    const candidates: string[] = [];
    if (idevicePath) {
        candidates.push(idevicePath.replace(/\/edition\/?$/, '/export/'));
        candidates.push(idevicePath);
    }
    candidates.push('../export/');
    candidates.push('');
    return candidates;
}

function loadScript(url: string, done: (error?: Error) => void): void {
    const existing = document.querySelector(`script[data-three-sixty-src="${url}"]`);
    if (existing) {
        done();
        return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.setAttribute('data-three-sixty-src', url);
    script.onload = () => done();
    script.onerror = () => done(new Error(`failed: ${url}`));
    document.head.appendChild(script);
}

function flushCallbacks(): void {
    const callbacks = pendingCallbacks ?? [];
    pendingCallbacks = null;
    for (const callback of callbacks) {
        try {
            callback();
        } catch {
            // One failing callback must not starve the rest.
        }
    }
}

/**
 * Ensure THREE (+OrbitControls) is available, then invoke `callback`.
 * Concurrent calls coalesce into one load; every callback fires exactly once,
 * even when every candidate URL fails (callers re-check `typeof THREE`).
 */
export function ensureThreeLoaded(idevicePath: string, callback: LoadCallback): void {
    if (typeof window === 'undefined') {
        callback();
        return;
    }
    if (typeof THREE !== 'undefined' && THREE?.OrbitControls) {
        callback();
        return;
    }
    if (pendingCallbacks) {
        pendingCallbacks.push(callback);
        return;
    }
    pendingCallbacks = [callback];
    const candidates = vendorBaseCandidates(idevicePath);

    const tryLoad = (index: number): void => {
        if (index >= candidates.length) {
            flushCallbacks();
            return;
        }
        const prefix = candidates[index] ?? '';
        loadScript(`${prefix}three.min.js`, error => {
            if (error) {
                tryLoad(index + 1);
                return;
            }
            loadScript(`${prefix}OrbitControls.js`, controlsError => {
                if (controlsError) {
                    tryLoad(index + 1);
                    return;
                }
                flushCallbacks();
            });
        });
    };
    tryLoad(0);
}
