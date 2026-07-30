/**
 * Editor orchestration: builds the form from the typed state, wires the scene
 * list, active-scene fields, hotspot list, placement mode, asset picking and
 * live preview, and owns the cleanup of all of it. One Editor instance per
 * init(); re-initializing destroys the previous instance completely.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { IdGenerator } from '../shared/ids';
import { createIdGenerator } from '../shared/ids';
import type { ThreeSixtyDocumentV2 } from '../shared/types';
import { createDisposerBag } from '../viewer/lifecycle';
import type { FrameScheduler } from '../viewer/lifecycle';
import { createAssetPicker, readFileAsDataUrl } from './asset-picker';
import { formHtml } from './form';
import { renderHotspotList, wireHotspotList } from './hotspot-list';
import { createPlacementController } from './hotspot-placement';
import type { PlacementController } from './hotspot-placement';
import { tr as defaultTr } from './i18n';
import type { Translate } from './i18n';
import { createPreviewController } from './preview';
import type { PlacementPosition, PreviewController } from './preview';
import { removeSceneConfirmation, renderSceneList, wireSceneList } from './scene-list';
import { refreshActiveSceneInputs, refreshImageLabel, wireActiveSceneFields, wireBehaviourFields } from './scene-editor';
import { createEditorState } from './state';
import type { EditorState } from './state';

export interface EditorDeps {
    readonly translate?: Translate;
    readonly ids?: IdGenerator;
    readonly confirm?: (message: string) => boolean;
    readonly scheduler?: FrameScheduler;
    readonly loadThree?: (idevicePath: string, callback: () => void) => void;
    readonly reducedMotion?: boolean;
}

export interface Editor {
    readonly state: EditorState;
    /** Normalized persisted document, or false when validation fails. */
    save: () => Record<string, unknown> | false;
    destroy: () => void;
}

export function createEditor(
    body: HTMLElement,
    document360: ThreeSixtyDocumentV2,
    idevicePath: string,
    deps: EditorDeps = {},
): Editor {
    const tr = deps.translate ?? defaultTr;
    const ids = deps.ids ?? createIdGenerator();
    const confirm = deps.confirm ?? (message => (typeof window !== 'undefined' ? window.confirm(message) : true));
    const state = createEditorState(document360, ids);
    const disposers = createDisposerBag();
    let placement: PlacementController;
    let preview: PreviewController;

    const query = <T extends HTMLElement>(selector: string): T | null => body.querySelector<T>(selector);

    const announce = (message: string): void => {
        const status = query('#threeSixtyStatus');
        if (status) status.textContent = message;
    };

    const refreshSceneList = (): void => {
        const list = query('#threeSixtySceneList');
        if (list) renderSceneList(list, state, tr);
    };
    const refreshHotspotList = (): void => {
        const list = query('#threeSixtyHotspotList');
        if (list) renderHotspotList(list, state, tr);
        preview.refreshHotspots();
    };

    const selectHotspot = (index: number): void => {
        state.selectedHotspotIndex = index;
        refreshHotspotList();
        const row = query(`#threeSixtyHotspotList .three-sixty-hotspot-item[data-hotspot-index="${index}"]`);
        if (row && typeof row.scrollIntoView === 'function') {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('is-highlighted');
            setTimeout(() => row.classList.remove('is-highlighted'), 1200);
        }
    };

    const addHotspotAt = (position: PlacementPosition): void => {
        const scene = state.activeScene();
        state.addHotspot(position, `${tr('Hotspot')} ${scene.hotspots.length + 1}`);
        refreshHotspotList();
        preview.refresh();
    };

    const assetPicker = createAssetPicker(() => query<HTMLInputElement>('#threeSixtyImageFile'));

    const buildForm = (): void => {
        body.innerHTML = formHtml(state, tr);

        placement?.dispose();
        placement = createPlacementController(
            {
                button: () => query('#threeSixtyPlaceHotspot'),
                stage: () => query('#threeSixtyPreview'),
                hint: () => query('#threeSixtyPlacementHint'),
                announce,
            },
            {
                started: tr('Placement mode on: click the preview to place the hotspot. Press Escape to cancel.'),
                cancelled: tr('Placement cancelled.'),
                placed: tr('Hotspot placed.'),
            },
        );

        wireSceneList(query('#threeSixtySceneList') as HTMLElement, {
            onSelect: index => {
                if (!state.setActiveScene(index)) return;
                refreshActiveSceneInputs(body, state, tr);
                refreshSceneList();
                refreshHotspotList();
                preview.refresh();
            },
            onSetStart: index => {
                const scene = state.doc.scenes[index];
                if (!scene) return;
                state.setStartScene(scene.id);
                refreshSceneList();
            },
            onDuplicate: index => {
                state.duplicateScene(index, tr('copy'));
                refreshSceneList();
            },
            onRemove: index => {
                if (!confirm(removeSceneConfirmation(state, index, tr))) return;
                state.removeScene(index);
                refreshActiveSceneInputs(body, state, tr);
                refreshSceneList();
                refreshHotspotList();
                preview.refresh();
                announce(tr('Scene removed.'));
            },
        });

        wireActiveSceneFields(body, state, {
            onChanged: () => {
                refreshImageLabel(body, state, tr);
                preview.refresh();
            },
            onTitleChanged: () => refreshSceneList(),
            onProjectionChanged: () => {
                preview.destroy();
                buildForm();
                preview = buildPreview();
                preview.refresh();
            },
            onPickImage: () =>
                assetPicker.pick('image', assetUrl => {
                    state.activeScene().src = assetUrl;
                    refreshImageLabel(body, state, tr);
                    preview.refresh();
                }),
            onImageFile: file =>
                readFileAsDataUrl(file, dataUrl => {
                    state.activeScene().src = dataUrl;
                    refreshImageLabel(body, state, tr);
                    preview.refresh();
                }),
        });

        wireBehaviourFields(body, state, () => preview.refresh());

        query('#threeSixtyAddScene')?.addEventListener('click', () => {
            state.addScene(`${tr('Scene')} ${state.doc.scenes.length + 1}`);
            state.setActiveScene(state.doc.scenes.length - 1);
            refreshActiveSceneInputs(body, state, tr);
            refreshSceneList();
            refreshHotspotList();
            preview.refresh();
            announce(tr('Scene added.'));
        });

        query('#threeSixtyAddHotspot')?.addEventListener('click', () => {
            if (state.activeScene().projection === 'flat') {
                addHotspotAt({ x: 50, y: 50 });
            } else {
                addHotspotAt(preview.getCameraYawPitch());
            }
            announce(tr('Hotspot added.'));
        });
        query('#threeSixtyPlaceHotspot')?.addEventListener('click', () => placement.toggle());

        wireHotspotList(query('#threeSixtyHotspotList') as HTMLElement, state, {
            onChanged: () => preview.refresh(),
            onStructureChanged: () => {
                refreshHotspotList();
                preview.refresh();
            },
            onSelect: index => selectHotspot(index),
            onPickMedia: (index, kind) =>
                assetPicker.pick(kind, assetUrl => {
                    const hotspot = state.hotspotAt(index);
                    if (!hotspot) return;
                    if (hotspot.action.type === 'image' || hotspot.action.type === 'video') {
                        hotspot.action.payload.src = assetUrl;
                        refreshHotspotList();
                    }
                }),
        });

        refreshSceneList();
        const list = query('#threeSixtyHotspotList');
        if (list) renderHotspotList(list, state, tr);
    };

    const buildPreview = (): PreviewController =>
        createPreviewController({
            stage: () => query('#threeSixtyPreview'),
            message: () => query('#threeSixtyPreviewMessage'),
            state,
            tr,
            idevicePath,
            isPlacing: () => placement.active,
            onPlace: position => {
                addHotspotAt(position);
                placement.complete();
            },
            onHotspotMoved: () => refreshHotspotList(),
            onHotspotSelected: index => selectHotspot(index),
            ...(deps.scheduler ? { scheduler: deps.scheduler } : {}),
            ...(deps.loadThree ? { loadThree: deps.loadThree } : {}),
            ...(deps.reducedMotion !== undefined ? { reducedMotion: deps.reducedMotion } : {}),
        });

    buildForm();
    preview = buildPreview();
    preview.refresh();

    disposers.add(() => placement.dispose());
    disposers.add(() => preview.destroy());

    return {
        state,

        save() {
            const alt = query<HTMLInputElement>('#threeSixtyAlt');
            if (alt) state.activeScene().alt = String(alt.value ?? '');
            const issues = state.saveIssues();
            if (issues.length > 0) {
                announce(issues.map(issue => issue.message).join(' '));
                return false;
            }
            const serialized = state.serialize();
            const id = body.getAttribute('idevice-id') || body.getAttribute('data-idevice-id');
            if (id) serialized.ideviceId = id;
            announce(tr('Saved.'));
            return serialized;
        },

        destroy() {
            disposers.dispose();
        },
    };
}
