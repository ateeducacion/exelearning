/**
 * The editor's single typed source of truth. Every mutation goes through this
 * store; the form, lists and preview all derive from it. Nothing here touches
 * the DOM, so the whole editing model is unit-testable headlessly.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { clamp, toFiniteNumber } from '../shared/geometry';
import {
    createDefaultAction,
    hotspotsReferencingScene,
    repairSceneReferences,
    validateAction,
} from '../shared/hotspot-actions';
import type { ActionValidationIssue, SceneReference } from '../shared/hotspot-actions';
import type { IdGenerator } from '../shared/ids';
import { createIdGenerator } from '../shared/ids';
import { createDefaultHotspot, createDefaultScene, normalizeDocument, resolveStartSceneId } from '../shared/normalization';
import { serializeDocument } from '../shared/schema';
import type { Hotspot, KnownHotspotActionType, Scene, ThreeSixtyDocumentV2, ViewerBehaviour } from '../shared/types';

/** Deeply-mutable working copies of the (readonly) document types. */
type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };
export type MutableScene = DeepMutable<Scene>;
export type MutableHotspot = DeepMutable<Hotspot>;
export type MutableBehaviour = DeepMutable<ViewerBehaviour>;
export type MutableDocument = DeepMutable<ThreeSixtyDocumentV2>;

function toMutable(document360: ThreeSixtyDocumentV2): MutableDocument {
    return JSON.parse(JSON.stringify(document360)) as MutableDocument;
}

export interface EditorState {
    readonly doc: MutableDocument;
    /** The scene currently being edited (always valid). */
    activeSceneIndex: number;
    /** The hotspot row currently selected in the list, or -1. */
    selectedHotspotIndex: number;
    /**
     * When set, the list renders an inline delete-confirmation for that
     * hotspot index instead of the normal row (Interactive Video pattern).
     */
    confirmDeleteHotspotIndex: number | null;

    activeScene(): MutableScene;
    sceneIds(): string[];

    addScene(title: string): MutableScene;
    duplicateScene(index: number, copySuffix: string): MutableScene | null;
    /** goToScene hotspots (anywhere) that reference the scene at `index`. */
    referencesToScene(index: number): SceneReference[];
    /** Remove a scene, deterministically clearing references to it. */
    removeScene(index: number): MutableScene | null;
    setStartScene(sceneId: string): void;
    setActiveScene(index: number): boolean;

    addHotspot(position: { yaw: number; pitch: number } | { x: number; y: number }, label: string): MutableHotspot;
    removeHotspot(index: number): MutableHotspot | null;
    hotspotAt(index: number): MutableHotspot | null;
    setHotspotActionType(index: number, type: KnownHotspotActionType): void;
    /** Validation issues for one hotspot's action in the current document. */
    hotspotIssues(index: number): ActionValidationIssue[];

    /** Issues that make the document unsaveable (empty = saveable). */
    saveIssues(): ActionValidationIssue[];
    /** Normalized persisted wire form of the current document. */
    serialize(): Record<string, unknown>;
}

export function createEditorState(document360: ThreeSixtyDocumentV2, ids: IdGenerator = createIdGenerator()): EditorState {
    const doc = toMutable(document360);
    if (doc.scenes.length === 0) {
        doc.scenes.push(createDefaultScene('scene-1') as MutableScene);
        doc.startSceneId = 'scene-1';
    }

    const state: EditorState = {
        doc,
        activeSceneIndex: 0,
        selectedHotspotIndex: -1,
        confirmDeleteHotspotIndex: null,

        activeScene() {
            const index = clamp(this.activeSceneIndex, 0, this.doc.scenes.length - 1);
            return this.doc.scenes[index] as MutableScene;
        },

        sceneIds() {
            return this.doc.scenes.map(scene => scene.id);
        },

        addScene(title) {
            const scene = createDefaultScene(ids.scene()) as MutableScene;
            scene.title = title;
            this.doc.scenes.push(scene);
            return scene;
        },

        duplicateScene(index, copySuffix) {
            const source = this.doc.scenes[index];
            if (!source) return null;
            const copy = JSON.parse(JSON.stringify(source)) as MutableScene;
            copy.id = ids.scene();
            copy.title = source.title ? `${source.title} (${copySuffix})` : '';
            for (const hotspot of copy.hotspots) {
                hotspot.id = ids.hotspot();
            }
            this.doc.scenes.splice(index + 1, 0, copy);
            return copy;
        },

        referencesToScene(index) {
            const scene = this.doc.scenes[index];
            if (!scene) return [];
            return hotspotsReferencingScene(this.doc as ThreeSixtyDocumentV2, scene.id);
        },

        removeScene(index) {
            const removed = this.doc.scenes[index];
            if (!removed) return null;
            this.doc.scenes.splice(index, 1);
            if (this.doc.scenes.length === 0) {
                this.doc.scenes.push(createDefaultScene('scene-1') as MutableScene);
            }
            this.doc.scenes = repairSceneReferences(
                this.doc.scenes as Scene[],
                removed.id,
            ) as unknown as MutableScene[];
            this.doc.startSceneId = resolveStartSceneId(this.doc.startSceneId, this.doc.scenes as Scene[]);
            this.activeSceneIndex = clamp(this.activeSceneIndex, 0, this.doc.scenes.length - 1);
            this.selectedHotspotIndex = -1;
            this.confirmDeleteHotspotIndex = null;
            return removed;
        },

        setStartScene(sceneId) {
            this.doc.startSceneId = resolveStartSceneId(sceneId, this.doc.scenes as Scene[]);
        },

        setActiveScene(index) {
            if (index < 0 || index >= this.doc.scenes.length) return false;
            this.activeSceneIndex = index;
            this.selectedHotspotIndex = -1;
            this.confirmDeleteHotspotIndex = null;
            return true;
        },

        addHotspot(position, label) {
            const scene = this.activeScene();
            const hotspot = createDefaultHotspot(ids.hotspot()) as MutableHotspot;
            hotspot.label = label;
            if ('yaw' in position) {
                hotspot.yaw = clamp(toFiniteNumber(position.yaw, 0), -180, 180);
                hotspot.pitch = clamp(toFiniteNumber(position.pitch, 0), -90, 90);
            } else {
                hotspot.x = clamp(toFiniteNumber(position.x, 50), 0, 100);
                hotspot.y = clamp(toFiniteNumber(position.y, 50), 0, 100);
            }
            scene.hotspots.push(hotspot);
            this.selectedHotspotIndex = scene.hotspots.length - 1;
            this.confirmDeleteHotspotIndex = null;
            return hotspot;
        },

        removeHotspot(index) {
            const scene = this.activeScene();
            const removed = scene.hotspots[index] ?? null;
            if (removed) {
                scene.hotspots.splice(index, 1);
                this.confirmDeleteHotspotIndex = null;
                if (this.selectedHotspotIndex === index) {
                    this.selectedHotspotIndex = -1;
                } else if (this.selectedHotspotIndex > index) {
                    this.selectedHotspotIndex -= 1;
                }
            }
            return removed;
        },

        hotspotAt(index) {
            return this.activeScene().hotspots[index] ?? null;
        },

        setHotspotActionType(index, type) {
            const hotspot = this.hotspotAt(index);
            if (!hotspot) return;
            hotspot.action = createDefaultAction(type) as MutableHotspot['action'];
        },

        hotspotIssues(index) {
            const hotspot = this.hotspotAt(index);
            if (!hotspot) return [];
            return validateAction(hotspot.action, {
                sceneIds: this.sceneIds(),
                currentSceneId: this.activeScene().id,
            });
        },

        saveIssues() {
            const issues: ActionValidationIssue[] = [];
            const sceneIds = this.sceneIds();
            for (const scene of this.doc.scenes) {
                for (const hotspot of scene.hotspots) {
                    // Only rules that would corrupt or endanger the exported
                    // content block saving; incomplete-but-harmless payloads
                    // (an empty text, an unchosen image) stay editable later.
                    if (hotspot.action.type === 'link' && hotspot.action.payload.url) {
                        issues.push(
                            ...validateAction(hotspot.action, { sceneIds, currentSceneId: scene.id }).map(issue => ({
                                ...issue,
                                message: `${scene.title || scene.id}: ${issue.message}`,
                            })),
                        );
                    }
                }
            }
            return issues;
        },

        serialize() {
            return serializeDocument(normalizeDocument(this.doc, ids));
        },
    };
    return state;
}
