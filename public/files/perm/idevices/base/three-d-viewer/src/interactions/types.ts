/** Contracts between the interaction controller, its adapters and its hosts. */

import type { InteractionSettings, Marker, MarkerCamera, Vector3 } from '../shared/types';

/** Where an author dropped a marker, as reported by a renderer adapter. */
export interface MarkerPlacement {
    position: Vector3;
    normal: Vector3;
    surface: string;
    camera: MarkerCamera;
}

export interface MarkerRenderOptions {
    showLabels: boolean;
    activeId: string;
}

/**
 * The only thing the controller knows about a renderer.
 *
 * `<model-viewer>` implements it with native declarative hotspots; the STL path
 * implements it with a raycast plus a per-frame DOM overlay. Neither adapter
 * contains dialog, question or navigation logic.
 */
export interface MarkerAdapter {
    enterPlacementMode(onPlaced: (placement: MarkerPlacement) => void): void;
    exitPlacementMode(): void;
    renderMarkers(markers: readonly Marker[], options: MarkerRenderOptions): void;
    setActive(activeId: string): void;
    focusMarker(marker: Marker): void;
    captureCamera(): MarkerCamera;
    /** Re-position the overlay; a no-op where the renderer projects natively. */
    updateOverlay(): void;
    destroy(): void;
}

/** Host callbacks. Every one is optional; the controller degrades without them. */
export interface InteractionHooks {
    /** Translate a learner-facing micro-string. */
    t?: (key: string) => string;
    /** Author placed a marker (edit mode only). */
    onPlaced?: (placement: MarkerPlacement) => void;
    /** A marker was activated by the learner. */
    onActivate?: (markerId: string) => void;
    /** A question was graded — used by SCORM scoring. */
    onQuestionAnswered?: (markerId: string, correct: boolean) => void;
    /** Turn an `asset://` media reference into something the browser can load. */
    resolveMediaUrl?: (url: string) => string;
    /** Sanitize author HTML; defaults to the shared DOM sanitizer. */
    sanitizeHtml?: (html: string) => string;
}

export type InteractionMode = 'view' | 'edit';

/** What the host handles the controller through. */
export interface InteractionController {
    setState(next: InteractionSettings): void;
    render(): void;
    enterPlacementMode(): void;
    exitPlacementMode(): void;
    focusMarker(markerId: string): void;
    captureCamera(): MarkerCamera;
    next(): void;
    previous(): void;
    getActiveId(): string;
    /** Accessible label of a marker, used by adapters when building buttons. */
    markerLabel(marker: Marker, index: number): string;
    destroy(): void;
}

/** How the controller reaches its renderer. */
export interface InteractionHandle {
    wrapper: HTMLElement;
    type: string;
    modelViewer?: ModelViewerElement | null;
    instance?: unknown;
}
