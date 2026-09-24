/**
 * Export bundle entry point. Compiled by scripts/build-idevices.ts into
 * export/three-sixty-viewer.js (a classic-script IIFE). The window global is
 * assigned EXPLICITLY — never rely on the bundler's globalName.
 *
 * three.js and OrbitControls are separate vendored scripts declared in
 * config.xml's <export-js>; the exported page loads them before this bundle,
 * and the runtime only dereferences `THREE` inside renderBehaviour(), so the
 * bundle itself is safe to evaluate in any order.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { createThreeSixtyRuntime } from './runtime';
import type { ThreeSixtyRuntime } from './runtime';

declare global {
    // eslint-disable-next-line no-var
    var $threesixtyviewer: ThreeSixtyRuntime | undefined;
    interface Window {
        __threesixtyCleanupBound?: boolean;
    }
}

const runtime = createThreeSixtyRuntime();
globalThis.$threesixtyviewer = runtime;

/**
 * `pagehide` replaces the former `beforeunload` binding: an unload-family
 * listener makes the page ineligible for the back/forward cache, and this
 * runtime ships inside SCORM packages whose SCORM runtime relies on bfcache
 * staying available. `event.persisted === true` means the page is being frozen
 * and may be restored intact, so its WebGL contexts must survive.
 */
export function bindPageHideCleanup(
    targetRuntime: { destroyAll: () => void },
    target: Window & { __threesixtyCleanupBound?: boolean },
): void {
    if (target.__threesixtyCleanupBound) {
        return;
    }
    target.__threesixtyCleanupBound = true;
    target.addEventListener('pagehide', (event: PageTransitionEvent) => {
        if (event.persisted) {
            return;
        }
        targetRuntime.destroyAll();
    });
}

if (typeof window !== 'undefined') {
    bindPageHideCleanup(runtime, window);
}
