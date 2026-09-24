/**
 * Instance construction and teardown.
 *
 * Resource ownership is explicit: whatever `createInstance` and the boot path
 * allocate, `disposeInstance` releases — listeners, animation frames, Three.js
 * geometries/materials/textures, controls, the WebGL renderer, generated object
 * URLs and the interaction layer.
 */

import { detectModelType } from '../shared/model-source';
import type { FrameCallback, ViewerInstance, ViewerOptions } from './types';

export function createInstance(wrapper: HTMLElement, options: ViewerOptions): ViewerInstance {
    return {
        wrapper,
        options,
        type: options.type || detectModelType(options.src),
        modelViewer: null,
        canvas: null,
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        mesh: null,
        geometry: null,
        material: null,
        rafId: null,
        stopped: false,
        listeners: [],
        objectURLs: [],
        onFrame: [],
        interaction: null,
    };
}

/** Add a listener and remember it so `disposeInstance` can remove it. */
export function trackListener(
    instance: ViewerInstance,
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
): void {
    target.addEventListener(type, handler, options);
    instance.listeners.push({ target, type, handler, options });
}

/** Register a per-frame callback exactly once. */
export function addFrameCallback(instance: ViewerInstance, callback: FrameCallback): void {
    if (!instance.onFrame.includes(callback)) {
        instance.onFrame.push(callback);
    }
}

/** Remove a previously registered per-frame callback. */
export function removeFrameCallback(instance: ViewerInstance, callback: FrameCallback): void {
    const index = instance.onFrame.indexOf(callback);
    if (index !== -1) {
        instance.onFrame.splice(index, 1);
    }
}

function isTexture(value: unknown): value is { dispose: () => void } {
    return Boolean(
        value &&
            typeof value === 'object' &&
            (value as { isTexture?: unknown }).isTexture &&
            typeof (value as { dispose?: unknown }).dispose === 'function',
    );
}

/** Dispose every texture-shaped field of a material, then the material itself. */
export function disposeMaterial(material: unknown): void {
    if (!material) {
        return;
    }
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const record = entry as Record<string, unknown>;
        for (const key of Object.keys(record)) {
            const value = record[key];
            if (isTexture(value)) {
                value.dispose();
            }
        }
        const dispose = (entry as { dispose?: unknown }).dispose;
        if (typeof dispose === 'function') {
            dispose.call(entry);
        }
    }
}

/** Traverse an Object3D subtree, disposing each node's geometry and material. */
export function disposeObject3D(object: unknown): void {
    const traverse = (object as { traverse?: unknown } | null)?.traverse;
    if (typeof traverse !== 'function') {
        return;
    }
    (object as ThreeObject3D).traverse(node => {
        if (node?.geometry && typeof node.geometry.dispose === 'function') {
            node.geometry.dispose();
        }
        if (node?.material) {
            disposeMaterial(node.material);
        }
    });
}

function cancelFrame(rafId: number): void {
    if (typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(rafId);
    } else {
        clearTimeout(rafId);
    }
}

/**
 * Release everything an instance owns. Safe to call more than once and safe on
 * a half-booted instance: each step is guarded, because a viewer can be torn
 * down while its STL fetch is still in flight.
 */
export function disposeInstance(instance: ViewerInstance): void {
    instance.stopped = true;

    // The interaction layer goes first: it removes marker overlays, the dialog,
    // its listeners and its per-frame callback before the scene disappears.
    if (instance.interaction) {
        try {
            instance.interaction.destroy();
        } catch {
            // A broken controller must not block the rest of the teardown.
        }
        instance.interaction = null;
    }
    instance.onFrame.length = 0;

    if (instance.rafId !== null) {
        cancelFrame(instance.rafId);
        instance.rafId = null;
    }

    for (const { target, type, handler, options } of instance.listeners) {
        try {
            target.removeEventListener(type, handler, options);
        } catch {
            // Detached nodes can throw; nothing left to remove either way.
        }
    }
    instance.listeners.length = 0;

    try {
        disposeObject3D(instance.scene);
    } catch {
        // Partially built scenes may hold nodes Three.js cannot traverse.
    }
    try {
        disposeMaterial(instance.material);
    } catch {
        // Already-disposed materials throw on a second dispose.
    }
    try {
        instance.geometry?.dispose?.();
    } catch {
        // Same as above.
    }
    try {
        instance.controls?.dispose?.();
    } catch {
        // OrbitControls throws when its DOM element is already gone.
    }
    try {
        instance.renderer?.dispose?.();
    } catch {
        // Losing the WebGL context first makes dispose throw.
    }

    for (const url of instance.objectURLs) {
        try {
            URL.revokeObjectURL(url);
        } catch {
            // Revoking twice is harmless but throws in some engines.
        }
    }
    instance.objectURLs.length = 0;

    // The runtime created this canvas, so the runtime removes it. Leaving it
    // behind would cover the sibling <model-viewer> when the author switches an
    // STL model for a GLB one.
    try {
        instance.canvas?.remove();
    } catch {
        // Already detached.
    }
    instance.canvas = null;

    // The <model-viewer> is NOT ours — the editor and the export markup own it.
    // Un-hide it so the GLB path can take over the wrapper again.
    if (instance.modelViewer) {
        instance.modelViewer.style.display = '';
        instance.modelViewer = null;
    }

    instance.scene = null;
    instance.camera = null;
    instance.renderer = null;
    instance.controls = null;
    instance.mesh = null;
    instance.geometry = null;
    instance.material = null;
}
