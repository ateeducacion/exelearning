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

// Release every viewer's WebGL resources when the page goes away.
if (typeof window !== 'undefined' && !window.__threesixtyCleanupBound) {
    window.__threesixtyCleanupBound = true;
    window.addEventListener('beforeunload', () => {
        runtime.destroyAll();
    });
}
