/**
 * Shared test helpers: deterministic ids, DOM scaffolding, viewer instances and
 * fixture loading.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInstance } from '../runtime/lifecycle';
import type { ViewerInstance, ViewerOptions } from '../runtime/types';
import type { IdFactory, InteractionSettings, Marker, ThreeDViewerDocumentV2 } from '../shared/types';
import { normalizeInteraction, normalizeMarker } from '../shared/schema';
import { hydrateDocument } from '../shared/migration';
import { StubCamera, StubObject3D } from './three-stub';

const testDir = dirname(fileURLToPath(import.meta.url));

/** A counter-based id factory, so every test run produces the same ids. */
export function sequentialIds(): IdFactory {
    let counter = 0;
    return prefix => `${prefix}-${++counter}`;
}

/** Read a JSON fixture from `src/test/fixtures/`. */
export function readFixture(relativePath: string): unknown {
    return JSON.parse(readFileSync(join(testDir, 'fixtures', relativePath), 'utf-8')) as unknown;
}

/** A wrapper element attached to the document, cleaned up by the caller. */
export function createWrapper(id = 'tdv-test'): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'three-d-viewer-wrapper';
    wrapper.id = id;
    wrapper.setAttribute('data-three-d', '');
    document.body.appendChild(wrapper);
    return wrapper;
}

/** Remove every element this suite appended to the document body. */
export function resetDom(): void {
    document.body.innerHTML = '';
}

/** A viewer instance with a stub mesh, camera and canvas, ready for the STL adapter. */
export function createStubInstance(wrapper: HTMLElement, overrides: Partial<ViewerOptions> = {}): ViewerInstance {
    const options: ViewerOptions = {
        src: 'asset://model.stl',
        type: 'stl',
        modelColor: '#888888',
        backgroundColor: '#f5f5f5',
        cameraControls: true,
        autoRotate: false,
        autoRotateSpeed: 30,
        ...overrides,
    };
    const instance = createInstance(wrapper, options);
    const canvas = document.createElement('canvas');
    // happy-dom reports zero-size elements; fake a viewport for the projection.
    Object.defineProperty(canvas, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 100, configurable: true });
    canvas.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            width: 200,
            height: 100,
            right: 200,
            bottom: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    wrapper.appendChild(canvas);
    instance.canvas = canvas;
    instance.mesh = new StubObject3D() as unknown as ThreeObject3D;
    instance.camera = new StubCamera() as unknown as ThreeCamera;
    return instance;
}

/** Build a normalized marker with deterministic ids. */
export function makeMarker(partial: Record<string, unknown>, index = 0, createId: IdFactory = sequentialIds()): Marker {
    return normalizeMarker(partial, index, createId);
}

/** Build normalized interaction settings with deterministic ids. */
export function makeInteraction(
    partial: Record<string, unknown>,
    createId: IdFactory = sequentialIds(),
): InteractionSettings {
    return normalizeInteraction(partial, createId);
}

/** Hydrate a document, failing the test loudly if the input is not valid. */
export function makeDocument(partial: unknown, createId: IdFactory = sequentialIds()): ThreeDViewerDocumentV2 {
    const result = hydrateDocument(partial, createId);
    if (result.status !== 'ok') {
        throw new Error(`Expected a valid document, got: ${result.status}`);
    }
    return result.document;
}

/** Flush pending microtasks (and any zero-delay timers) inside a test. */
export function flush(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}
