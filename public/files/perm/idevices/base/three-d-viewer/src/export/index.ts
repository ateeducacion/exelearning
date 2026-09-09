/**
 * Export entry point. Compiled by `scripts/build-idevices.ts` into
 * `export/three-d-viewer.js` — a self-contained classic-script IIFE.
 *
 * It publishes three globals the engine and the existing tests rely on:
 *
 *   window.$threedviewer            the render/boot contract
 *   window.ThreeDViewerExportObject the serialization helper class
 *   window.eXe3DViewer              the shared viewer runtime
 *
 * The globals are ASSIGNED explicitly rather than left to the bundler's
 * `globalName`, so the contract is visible in the source and survives any
 * change of bundling strategy.
 */

import { publishViewerRuntime } from '../runtime/viewer-runtime';
import { createExportRuntime, ThreeDViewerExportObject } from './runtime';

const runtime = createExportRuntime();

// The shared viewer runtime is published idempotently: the first bundle on the
// page owns the single instance registry, any later one reuses it.
publishViewerRuntime();

(globalThis as { $threedviewer?: unknown }).$threedviewer = runtime;
(globalThis as { ThreeDViewerExportObject?: unknown }).ThreeDViewerExportObject = ThreeDViewerExportObject;

if (typeof window !== 'undefined') {
    window.$threedviewer = runtime;
    window.ThreeDViewerExportObject = ThreeDViewerExportObject;
}
