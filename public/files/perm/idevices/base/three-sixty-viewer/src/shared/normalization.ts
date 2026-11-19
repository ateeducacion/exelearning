/**
 * v2 document normalization — the single implementation shared by the editor
 * and the export runtime (the two used to carry mirrored copies of this
 * logic; see the mirrored `normalize`/`_normalize*` helpers in the pre-
 * TypeScript edition/export bundles).
 *
 * All functions are pure: they never mutate their input and are idempotent —
 * `normalizeDocument(normalizeDocument(x)) === normalizeDocument(x)` (deep
 * equality).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { clamp, toFiniteNumber } from './geometry';
import { normalizeAction } from './hotspot-actions';
import type { IdGenerator } from './ids';
import { createIdGenerator } from './ids';
import type {
    Hotspot,
    InitialView,
    LabelPosition,
    RenderQuality,
    Scene,
    ThreeSixtyDocumentV2,
    ViewerBehaviour,
} from './types';
import { LABEL_POSITION_VALUES, RENDER_QUALITY_VALUES, SCHEMA_VERSION } from './types';

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

export function createDefaultInitialView(): InitialView {
    return { yaw: 0, pitch: 0, fov: 75 };
}

export function createDefaultBehaviour(): ViewerBehaviour {
    return {
        autorotate: { enabled: false, speed: 1 },
        zoomEnabled: true,
        fullscreenEnabled: true,
        showNavControls: true,
        renderQuality: 'high',
        showLabels: true,
        labelPosition: 'right',
        imageAdjustments: { brightness: 1, contrast: 1, saturation: 1 },
    };
}

export function createDefaultScene(id: string): Scene {
    return {
        id,
        title: '',
        src: '',
        alt: '',
        description: '',
        projection: 'equirectangular',
        initialView: createDefaultInitialView(),
        hotspots: [],
    };
}

export function createDefaultHotspot(id: string): Hotspot {
    return {
        id,
        label: '',
        icon: 'circle',
        yaw: 0,
        pitch: 0,
        x: 50,
        y: 50,
        action: { type: 'text', payload: { html: '' } },
    };
}

export function normalizeInitialView(raw: unknown): InitialView {
    const record = asRecord(raw);
    return {
        yaw: clamp(toFiniteNumber(record.yaw, 0), -180, 180),
        pitch: clamp(toFiniteNumber(record.pitch, 0), -90, 90),
        fov: clamp(toFiniteNumber(record.fov, 75), 30, 120),
    };
}

export function normalizeHotspot(raw: unknown, ids: IdGenerator): Hotspot {
    const record = asRecord(raw);
    const id = asString(record.id) || ids.hotspot();
    return {
        id,
        label: asString(record.label),
        icon: asString(record.icon, 'circle') || 'circle',
        yaw: clamp(toFiniteNumber(record.yaw, 0), -180, 180),
        pitch: clamp(toFiniteNumber(record.pitch, 0), -90, 90),
        x: clamp(toFiniteNumber(record.x, 50), 0, 100),
        y: clamp(toFiniteNumber(record.y, 50), 0, 100),
        action: normalizeAction(record.action),
    };
}

export function normalizeScene(raw: unknown, index: number, ids: IdGenerator): Scene {
    const record = asRecord(raw);
    const fallbackId = `scene-${index + 1}`;
    const hotspotsRaw = Array.isArray(record.hotspots) ? record.hotspots : [];
    return {
        id: asString(record.id) || fallbackId,
        title: asString(record.title),
        src: asString(record.src),
        alt: asString(record.alt),
        description: asString(record.description),
        projection: record.projection === 'flat' ? 'flat' : 'equirectangular',
        initialView: normalizeInitialView(record.initialView),
        hotspots: hotspotsRaw.map(hotspot => normalizeHotspot(hotspot, ids)),
    };
}

export function normalizeBehaviour(raw: unknown): ViewerBehaviour {
    const record = asRecord(raw);
    const autorotate = asRecord(record.autorotate);
    const adjustments = asRecord(record.imageAdjustments);
    const renderQuality = (RENDER_QUALITY_VALUES as readonly unknown[]).includes(record.renderQuality)
        ? (record.renderQuality as RenderQuality)
        : 'high';
    const labelPosition = (LABEL_POSITION_VALUES as readonly unknown[]).includes(record.labelPosition)
        ? (record.labelPosition as LabelPosition)
        : 'right';
    return {
        autorotate: {
            enabled: Boolean(autorotate.enabled),
            speed: clamp(toFiniteNumber(autorotate.speed, 1), 0, 10),
        },
        zoomEnabled: record.zoomEnabled !== false,
        fullscreenEnabled: record.fullscreenEnabled !== false,
        showNavControls: record.showNavControls !== false,
        renderQuality,
        showLabels: record.showLabels !== false,
        labelPosition,
        imageAdjustments: {
            brightness: clamp(toFiniteNumber(adjustments.brightness, 1), 0.1, 3),
            contrast: clamp(toFiniteNumber(adjustments.contrast, 1), 0.1, 3),
            saturation: clamp(toFiniteNumber(adjustments.saturation, 1), 0, 3),
        },
    };
}

/** startSceneId must point at an existing scene; falls back to the first. */
export function resolveStartSceneId(requested: unknown, scenes: readonly Scene[]): string {
    if (scenes.length === 0) return '';
    if (typeof requested === 'string' && requested && scenes.some(scene => scene.id === requested)) {
        return requested;
    }
    return scenes[0]?.id ?? '';
}

export function findSceneById(document: ThreeSixtyDocumentV2, sceneId: string): Scene | null {
    return document.scenes.find(scene => scene.id === sceneId) ?? null;
}

export function getStartScene(document: ThreeSixtyDocumentV2): Scene | null {
    if (document.scenes.length === 0) return null;
    return findSceneById(document, document.startSceneId) ?? document.scenes[0] ?? null;
}

export interface NormalizeDocumentInput {
    readonly ideviceId?: unknown;
    readonly startSceneId?: unknown;
    readonly scenes?: unknown;
    readonly behaviour?: unknown;
}

/**
 * Build a fully normalized v2 document from loosely-shaped parts. A document
 * always has at least one scene.
 */
export function normalizeDocument(raw: NormalizeDocumentInput, ids: IdGenerator = createIdGenerator()): ThreeSixtyDocumentV2 {
    const scenesRaw = Array.isArray(raw.scenes) ? raw.scenes : [];
    const scenes =
        scenesRaw.length > 0
            ? scenesRaw.map((scene, index) => normalizeScene(scene, index, ids))
            : [createDefaultScene('scene-1')];
    return {
        version: SCHEMA_VERSION,
        ideviceId: asString(raw.ideviceId),
        startSceneId: resolveStartSceneId(raw.startSceneId, scenes),
        scenes,
        behaviour: normalizeBehaviour(raw.behaviour),
    };
}
