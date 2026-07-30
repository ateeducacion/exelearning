/**
 * Hotspot-action normalization, serialization, validation and scene-reference
 * bookkeeping — the single implementation shared by the editor and the
 * runtime.
 *
 * Unknown action types are represented explicitly ({@link UnsupportedHotspotAction})
 * and serialized back to their original wire form so future content survives a
 * round-trip through this build.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type {
    GoToSceneAction,
    Hotspot,
    HotspotAction,
    ImageAction,
    KnownHotspotActionType,
    LinkAction,
    Scene,
    TextAction,
    ThreeSixtyDocumentV2,
    VideoAction,
} from './types';
import { HOTSPOT_ACTION_TYPES } from './types';
import { isSafeLinkUrl } from './urls';

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

export function isKnownActionType(type: unknown): type is KnownHotspotActionType {
    return typeof type === 'string' && (HOTSPOT_ACTION_TYPES as readonly string[]).includes(type);
}

/** Default (empty) payloads for each supported action type. */
export function createDefaultAction(type: KnownHotspotActionType): HotspotAction {
    switch (type) {
        case 'goToScene':
            return { type: 'goToScene', payload: { sceneId: '' } };
        case 'text':
            return { type: 'text', payload: { html: '' } };
        case 'image':
            return { type: 'image', payload: { src: '', alt: '', caption: '' } };
        case 'video':
            return { type: 'video', payload: { src: '', poster: '' } };
        case 'link':
            return { type: 'link', payload: { url: '', newTab: true } };
    }
}

/**
 * Normalize an unknown persisted `action` value into the discriminated union.
 * A missing action defaults to an empty text action (legacy behaviour); an
 * unknown type is preserved as `unsupported` with its original payload.
 */
export function normalizeAction(raw: unknown): HotspotAction {
    const record = asRecord(raw);
    const type = record.type;
    if (type === undefined && Object.keys(record).length === 0) {
        return createDefaultAction('text');
    }
    if (!isKnownActionType(type)) {
        return {
            type: 'unsupported',
            originalType: asString(type, String(type ?? '')),
            originalPayload: 'payload' in record ? record.payload : undefined,
        };
    }
    const payload = asRecord(record.payload);
    switch (type) {
        case 'goToScene':
            return { type, payload: { sceneId: asString(payload.sceneId) } } satisfies GoToSceneAction;
        case 'text':
            return { type, payload: { html: asString(payload.html) } } satisfies TextAction;
        case 'image':
            return {
                type,
                payload: {
                    src: asString(payload.src),
                    alt: asString(payload.alt),
                    caption: asString(payload.caption),
                },
            } satisfies ImageAction;
        case 'video':
            return {
                type,
                payload: { src: asString(payload.src), poster: asString(payload.poster) },
            } satisfies VideoAction;
        case 'link':
            return {
                type,
                payload: { url: asString(payload.url), newTab: payload.newTab !== false },
            } satisfies LinkAction;
    }
}

/** Persisted wire form of an action (unsupported actions round-trip). */
export function serializeAction(action: HotspotAction): { type: string; payload: unknown } {
    if (action.type === 'unsupported') {
        return { type: action.originalType, payload: action.originalPayload };
    }
    return { type: action.type, payload: action.payload };
}

export interface ActionValidationIssue {
    readonly field: string;
    readonly message: string;
}

export interface ActionValidationContext {
    /** Every scene id in the document. */
    readonly sceneIds: readonly string[];
    /** The scene the hotspot lives in (goToScene should point elsewhere). */
    readonly currentSceneId?: string;
}

/**
 * Explicit, testable validation rules for each action type. Returns an empty
 * array when the action is valid.
 */
export function validateAction(action: HotspotAction, context: ActionValidationContext): ActionValidationIssue[] {
    const issues: ActionValidationIssue[] = [];
    switch (action.type) {
        case 'goToScene': {
            const target = action.payload.sceneId;
            if (!target) {
                issues.push({ field: 'sceneId', message: 'Select a target scene.' });
            } else if (!context.sceneIds.includes(target)) {
                issues.push({ field: 'sceneId', message: 'The target scene no longer exists.' });
            } else if (context.currentSceneId && target === context.currentSceneId) {
                issues.push({ field: 'sceneId', message: 'The target is the scene the hotspot is already in.' });
            }
            break;
        }
        case 'link': {
            if (!action.payload.url) {
                issues.push({ field: 'url', message: 'Enter a URL.' });
            } else if (!isSafeLinkUrl(action.payload.url)) {
                issues.push({ field: 'url', message: 'Only http(s), mailto and tel URLs are supported.' });
            }
            break;
        }
        case 'image': {
            if (!action.payload.src) {
                issues.push({ field: 'src', message: 'Choose an image.' });
            }
            break;
        }
        case 'video': {
            if (!action.payload.src) {
                issues.push({ field: 'src', message: 'Choose a video or paste a video URL.' });
            }
            break;
        }
        case 'text':
        case 'unsupported':
            break;
    }
    return issues;
}

export interface SceneReference {
    readonly sceneId: string;
    readonly hotspotId: string;
}

/** Every goToScene hotspot (in any scene) targeting `sceneId`. */
export function hotspotsReferencingScene(document: ThreeSixtyDocumentV2, sceneId: string): SceneReference[] {
    const references: SceneReference[] = [];
    for (const scene of document.scenes) {
        for (const hotspot of scene.hotspots) {
            if (hotspot.action.type === 'goToScene' && hotspot.action.payload.sceneId === sceneId) {
                references.push({ sceneId: scene.id, hotspotId: hotspot.id });
            }
        }
    }
    return references;
}

function retargetHotspot(hotspot: Hotspot, removedSceneId: string, replacementSceneId: string): Hotspot {
    if (hotspot.action.type !== 'goToScene' || hotspot.action.payload.sceneId !== removedSceneId) {
        return hotspot;
    }
    return { ...hotspot, action: { type: 'goToScene', payload: { sceneId: replacementSceneId } } };
}

/**
 * Deterministic repair after deleting a scene: every goToScene hotspot that
 * pointed at it is retargeted to `replacementSceneId` ('' clears the target,
 * which the editor then flags as needing attention).
 */
export function repairSceneReferences(
    scenes: readonly Scene[],
    removedSceneId: string,
    replacementSceneId = '',
): Scene[] {
    return scenes.map(scene => ({
        ...scene,
        hotspots: scene.hotspots.map(hotspot => retargetHotspot(hotspot, removedSceneId, replacementSceneId)),
    }));
}
