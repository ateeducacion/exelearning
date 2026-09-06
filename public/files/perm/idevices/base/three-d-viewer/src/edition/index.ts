/**
 * Edition entry point. Compiled by `scripts/build-idevices.ts` into
 * `edition/three-d-viewer.js` — a self-contained classic-script IIFE.
 *
 * It publishes two globals:
 *
 *   window.$exeDevice    the JSON-iDevice editor contract the workarea calls
 *   window.eXe3DViewer   the shared viewer runtime the live preview drives
 *
 * Both are ASSIGNED explicitly rather than left to the bundler's `globalName`,
 * so the contract is visible in the source and survives any change of bundling
 * strategy.
 */

import { publishViewerRuntime } from '../runtime/viewer-runtime';
import { createThreeDViewerDevice } from './device';

const device = createThreeDViewerDevice();

// Published idempotently: the first bundle on the page owns the single instance
// registry, any later one reuses it.
publishViewerRuntime();

(globalThis as { $exeDevice?: unknown }).$exeDevice = device;

if (typeof window !== 'undefined') {
    window.$exeDevice = device;
}
