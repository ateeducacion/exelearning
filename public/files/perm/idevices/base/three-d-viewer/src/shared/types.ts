/**
 * The canonical 3D Viewer document model (schema v2) and every type derived
 * from it. This module is the single source of truth for both the edition and
 * the export bundle — neither one re-declares the shape.
 */

/** The only schema version this iDevice writes. */
export const SCHEMA_VERSION = 2 as const;

/** Model formats the viewer can detect from a file extension. */
export type ModelType = 'stl' | 'glb' | 'gltf' | 'obj' | 'fbx' | 'unknown';

/** Icons an author can pick for a marker. */
export const MARKER_ICONS = ['circle', 'pin', 'info', 'question', 'star'] as const;
export type MarkerIcon = (typeof MARKER_ICONS)[number];

/** Marker action discriminators, in authoring order. */
export const MARKER_ACTION_TYPES = ['information', 'image', 'video', 'link', 'question'] as const;
export type MarkerActionType = (typeof MARKER_ACTION_TYPES)[number];

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Where a marker sits on the model, in renderer-independent terms: a point and
 * a surface normal in the model's own (normalized, centered) space. Adapters
 * translate this into `<model-viewer>` hotspot attributes or Three.js world
 * coordinates; the controller never sees renderer specifics.
 */
export interface MarkerAnchor {
    position: Vector3;
    normal: Vector3;
    /** Best-effort surface hint for `<model-viewer>`; empty when unknown. */
    surface: string;
}

/** An opaque, adapter-defined camera view captured for a marker. */
export interface MarkerCamera {
    orbit: string;
    target: string;
    fieldOfView: string;
}

export interface QuestionOption {
    id: string;
    text: string;
    correct: boolean;
}

export interface SingleChoiceQuestion {
    prompt: string;
    type: 'single-choice';
    options: QuestionOption[];
    feedbackCorrect: string;
    feedbackIncorrect: string;
    /** 0 means unlimited. */
    attemptsAllowed: number;
}

export interface InformationPayload {
    html: string;
}

export interface ImagePayload {
    src: string;
    alt: string;
    caption: string;
}

export interface VideoPayload {
    src: string;
    poster: string;
}

export interface LinkPayload {
    url: string;
    newTab: boolean;
}

interface BaseMarkerAction<TType extends MarkerActionType, TPayload> {
    type: TType;
    payload: TPayload;
}

export type MarkerAction =
    | BaseMarkerAction<'information', InformationPayload>
    | BaseMarkerAction<'image', ImagePayload>
    | BaseMarkerAction<'video', VideoPayload>
    | BaseMarkerAction<'link', LinkPayload>
    | BaseMarkerAction<'question', SingleChoiceQuestion>;

export interface Marker {
    id: string;
    label: string;
    description: string;
    icon: MarkerIcon;
    /** Contiguous 0-based position; normalization re-indexes it. */
    order: number;
    anchor: MarkerAnchor;
    camera: MarkerCamera;
    action: MarkerAction;
}

export interface InteractionSettings {
    enabled: boolean;
    guidedMode: boolean;
    wrapNavigation: boolean;
    showMarkerLabels: boolean;
    /** Empty, or the id of a marker that exists in `markers`. */
    activeMarkerId: string;
    markers: Marker[];
}

export interface AnimationSettings {
    enabled: boolean;
    name: string;
    speed: number;
}

/**
 * SCORM scoring configuration for question markers.
 *
 * `mode` mirrors the shared gamification framework's `isScorm` convention:
 * 0 = off, 1 = save the score automatically, 2 = save through a button.
 */
export interface ScormSettings {
    mode: 0 | 1 | 2;
    weighted: number;
    saveButtonText: string;
}

/** The canonical persisted document. */
export interface ThreeDViewerDocumentV2 {
    schemaVersion: typeof SCHEMA_VERSION;
    src: string;
    alt: string;
    modelColor: string;
    backgroundColor: string;
    cameraControls: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    showNavControls: boolean;
    animation: AnimationSettings;
    interaction: InteractionSettings;
    scorm: ScormSettings;
}

/** The result of turning unknown persisted data into a canonical document. */
export type HydrationResult =
    | { status: 'ok'; document: ThreeDViewerDocumentV2 }
    | { status: 'unsupported-version'; version: number; original: unknown }
    | { status: 'invalid'; reason: string; original: unknown };

/** Everything the viewer needs to render a model, independent of markers. */
export interface ViewerDisplayConfig {
    src: string;
    type: ModelType | '';
    alt: string;
    modelColor: string;
    backgroundColor: string;
    cameraControls: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    showNavControls: boolean;
    animation: AnimationSettings;
}

/** Creates stable marker/option identifiers; injected so tests stay deterministic. */
export type IdFactory = (prefix: string) => string;
