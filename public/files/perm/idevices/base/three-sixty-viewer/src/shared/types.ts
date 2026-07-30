/**
 * Typed document model for the 360° Viewer iDevice.
 *
 * Two persisted formats exist and BOTH must keep working:
 *  - v1: the original single-image shape (top-level src/alt/initialView…).
 *    It is never written any more, but existing content still carries it.
 *  - v2: the virtual-tour shape (`version: 2`, `scenes[]`, `behaviour`).
 *
 * In memory the editor and the runtime work on a normalized
 * {@link ThreeSixtyDocumentV2}; hotspot actions are a discriminated union so
 * every consumer switch-checks exhaustively. Unknown/future action types are
 * kept as {@link UnsupportedHotspotAction} with their original payload so that
 * opening and saving a document never destroys data this build does not
 * understand.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export const SCHEMA_VERSION = 2;

export const PROJECTION_VALUES = ['equirectangular', 'flat'] as const;
export type Projection = (typeof PROJECTION_VALUES)[number];

export const RENDER_QUALITY_VALUES = ['low', 'medium', 'high'] as const;
export type RenderQuality = (typeof RENDER_QUALITY_VALUES)[number];

export const LABEL_POSITION_VALUES = ['right', 'left', 'top', 'bottom'] as const;
export type LabelPosition = (typeof LABEL_POSITION_VALUES)[number];

export const HOTSPOT_ACTION_TYPES = ['goToScene', 'text', 'image', 'video', 'link'] as const;
export type KnownHotspotActionType = (typeof HOTSPOT_ACTION_TYPES)[number];

export interface InitialView {
    /** Degrees, -180…180. */
    readonly yaw: number;
    /** Degrees, -90…90. */
    readonly pitch: number;
    /** Degrees, 30…120. */
    readonly fov: number;
}

export interface AutorotateSettings {
    readonly enabled: boolean;
    /** 0…10. */
    readonly speed: number;
}

export interface ImageAdjustments {
    /** 0.1…3. */
    readonly brightness: number;
    /** 0.1…3. */
    readonly contrast: number;
    /** 0…3. */
    readonly saturation: number;
}

export interface ViewerBehaviour {
    readonly autorotate: AutorotateSettings;
    readonly zoomEnabled: boolean;
    readonly fullscreenEnabled: boolean;
    readonly showNavControls: boolean;
    readonly renderQuality: RenderQuality;
    readonly showLabels: boolean;
    readonly labelPosition: LabelPosition;
    readonly imageAdjustments: ImageAdjustments;
}

export interface GoToSceneAction {
    readonly type: 'goToScene';
    readonly payload: {
        readonly sceneId: string;
    };
}

export interface TextAction {
    readonly type: 'text';
    readonly payload: {
        readonly html: string;
    };
}

export interface ImageAction {
    readonly type: 'image';
    readonly payload: {
        readonly src: string;
        readonly alt: string;
        readonly caption: string;
    };
}

export interface VideoAction {
    readonly type: 'video';
    readonly payload: {
        readonly src: string;
        readonly poster: string;
    };
}

export interface LinkAction {
    readonly type: 'link';
    readonly payload: {
        readonly url: string;
        readonly newTab: boolean;
    };
}

/**
 * A hotspot action this build does not understand (authored by a future
 * version). The original wire type and payload are preserved verbatim so
 * saving the document round-trips them unchanged.
 */
export interface UnsupportedHotspotAction {
    readonly type: 'unsupported';
    readonly originalType: string;
    readonly originalPayload: unknown;
}

export type HotspotAction = GoToSceneAction | TextAction | ImageAction | VideoAction | LinkAction | UnsupportedHotspotAction;

export interface Hotspot {
    readonly id: string;
    readonly label: string;
    readonly icon: string;
    /** Equirectangular position (degrees). */
    readonly yaw: number;
    readonly pitch: number;
    /** Flat position (percent of the displayed image, 0…100). */
    readonly x: number;
    readonly y: number;
    readonly action: HotspotAction;
}

export interface Scene {
    readonly id: string;
    readonly title: string;
    readonly src: string;
    readonly alt: string;
    readonly description: string;
    readonly projection: Projection;
    readonly initialView: InitialView;
    readonly hotspots: readonly Hotspot[];
}

/** The legacy single-image shape (never written any more, still readable). */
export interface ThreeSixtyDocumentV1 {
    version?: 1;
    ideviceId?: string;
    src?: string;
    alt?: string;
    initialView?: Partial<InitialView>;
    autorotate?: Partial<AutorotateSettings>;
    zoomEnabled?: boolean;
    fullscreenEnabled?: boolean;
    showNavControls?: boolean;
}

/** The current persisted and in-memory shape. */
export interface ThreeSixtyDocumentV2 {
    readonly version: typeof SCHEMA_VERSION;
    readonly ideviceId: string;
    readonly startSceneId: string;
    readonly scenes: readonly Scene[];
    readonly behaviour: ViewerBehaviour;
}

/**
 * Result of hydrating unknown persisted input into a v2 document.
 *
 * - `ok`: a fully normalized document; `migrated` is true when the input was
 *   a v1 single-image document lifted into a one-scene tour.
 * - `unsupported-version`: `version > 2`. The original payload is kept intact
 *   so callers can refuse to edit without destroying the content.
 * - `invalid`: the input could not be interpreted at all (bad JSON, wrong
 *   primitive). The original input is preserved for diagnostics.
 */
export type HydrationResult =
    | {
          readonly status: 'ok';
          readonly document: ThreeSixtyDocumentV2;
          readonly migrated: boolean;
      }
    | {
          readonly status: 'unsupported-version';
          readonly version: number;
          readonly original: unknown;
      }
    | {
          readonly status: 'invalid';
          readonly reason: string;
          readonly original: unknown;
      };
