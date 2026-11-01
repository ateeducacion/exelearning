/** Types for the shared viewer runtime: instances, options and the registry. */

import type { InteractionController } from '../interactions/types';
import type { ModelType } from '../shared/types';

/** Boot options for one viewer instance. */
export interface ViewerOptions {
    src: string;
    type: ModelType | '';
    modelColor: string;
    backgroundColor: string;
    cameraControls: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
}

/** A callback invoked once per animation frame, before the render. */
export type FrameCallback = () => void;

interface TrackedListener {
    target: EventTarget;
    type: string;
    handler: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
}

/**
 * One live viewer bound to a wrapper element.
 *
 * Every field that owns a resource — listeners, animation frames, GPU objects,
 * object URLs, the interaction layer — is tracked here so `destroy()` can
 * release all of it. Nothing about a viewer lives in module scope, which is
 * what keeps several 3D Viewers on one page isolated.
 */
export interface ViewerInstance {
    readonly wrapper: HTMLElement;
    options: ViewerOptions;
    type: ModelType | '';
    modelViewer: ModelViewerElement | null;
    canvas: HTMLCanvasElement | null;
    scene: ThreeObject3D | null;
    camera: ThreeCamera | null;
    renderer: ThreeRenderer | null;
    controls: ThreeOrbitControls | null;
    mesh: ThreeObject3D | null;
    geometry: ThreeGeometry | null;
    material: unknown;
    rafId: number | null;
    stopped: boolean;
    listeners: TrackedListener[];
    objectURLs: string[];
    /**
     * Per-frame callbacks run inside the animation loop. The STL marker adapter
     * registers its reprojection here so markers stay in sync during rotation
     * without opening a second `requestAnimationFrame` loop.
     */
    onFrame: FrameCallback[];
    /** The attached interaction layer, torn down before the scene. */
    interaction: InteractionController | null;
}

/** Narrow lifecycle surface over the wrapper → instance map. */
export interface ViewerRegistry {
    get(wrapper: HTMLElement): ViewerInstance | undefined;
    set(wrapper: HTMLElement, instance: ViewerInstance): void;
    has(wrapper: HTMLElement): boolean;
    destroy(wrapper: HTMLElement): void;
    destroyAll(): void;
    /** Wrappers currently registered, in insertion order. */
    wrappers(): HTMLElement[];
}
