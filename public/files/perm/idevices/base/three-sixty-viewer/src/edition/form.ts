/**
 * Pure HTML builders for the editor form. Everything derives from the typed
 * editor state; no listeners are attached here. Control ids and classes are
 * part of the editor's public surface (CSS + Playwright) and must not change.
 *
 * Layout mirrors the Interactive Video authoring surface: section heads with
 * live counts → edit stage (preview) → add bar → single-editor accordion list
 * → behaviour controls. Colour is never the sole cue.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { escapeAttr, escapeHtml, truncateLabel } from '../shared/html';
import type { Translate } from './i18n';
import type { EditorState } from './state';

export function formHtml(state: EditorState, tr: Translate): string {
    const scene = state.activeScene();
    const behaviour = state.doc.behaviour;
    const isFlat = scene.projection === 'flat';
    // The "Initial view" controls (yaw/pitch/fov) only make sense on a 360°
    // panorama; a flat photo is shown undistorted with no camera to aim.
    const initialViewFieldset = isFlat
        ? ''
        : `
            <fieldset class="exe-fieldset three-sixty-initial-view">
                <legend>${tr('Initial view')}</legend>
                <div class="property-row">
                    <label for="threeSixtyYaw">${tr('Yaw')} (-180…180):</label>
                    <input type="number" id="threeSixtyYaw" class="form-control" min="-180" max="180" step="1" value="${scene.initialView.yaw}" />
                    <label for="threeSixtyPitch">${tr('Pitch')} (-90…90):</label>
                    <input type="number" id="threeSixtyPitch" class="form-control" min="-90" max="90" step="1" value="${scene.initialView.pitch}" />
                    <label for="threeSixtyFov">${tr('Field of view')} (30…120):</label>
                    <input type="number" id="threeSixtyFov" class="form-control" min="30" max="120" step="1" value="${scene.initialView.fov}" />
                </div>
            </fieldset>`;

    const hotspotHint = isFlat
        ? tr('Click the image to place a hotspot, or drag an existing hotspot to move it.')
        : tr('Click the panorama to place a hotspot, or drag an existing hotspot to move it.');

    return `
        <div class="three-sixty-viewer-form">
            <p class="exe-block-info">${tr('Add equirectangular 360° images (2:1 aspect), or uncheck “360° panorama image” to use a regular flat photo. The viewer uses WebGL for 360° scenes.')}</p>
            <div id="threeSixtyStatus" class="visually-hidden" role="status" aria-live="polite"></div>

            <fieldset class="exe-fieldset three-sixty-scenes">
                <legend>
                    <span class="three-sixty-section-title">${tr('Scenes')}</span>
                    <span id="threeSixtyScenesCount" class="three-sixty-fieldset-count"></span>
                </legend>
                <div id="threeSixtySceneList" class="three-sixty-scene-list" role="list"></div>
                <div class="three-sixty-add-bar" role="group" aria-label="${escapeAttr(tr('Add scene'))}">
                    <button type="button" id="threeSixtyAddScene" class="btn btn-primary">+ ${tr('Add scene')}</button>
                </div>
            </fieldset>

            <fieldset class="exe-fieldset three-sixty-active-scene">
                <legend id="threeSixtyActiveSceneLegend">${tr('Active scene')}</legend>
                <div class="property-row">
                    <label for="threeSixtySceneTitle" class="form-label">${tr('Title')}:</label>
                    <input type="text" id="threeSixtySceneTitle" class="form-control" value="${escapeAttr(scene.title)}" />
                </div>
                <div class="property-row">
                    <label for="threeSixtyImageButton" class="form-label">${tr('Panorama image')}:</label>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <button type="button" id="threeSixtyImageButton" class="btn btn-secondary">${tr('Choose image…')}</button>
                        <span id="threeSixtyImageName" class="small text-muted">${scene.src ? escapeHtml(truncateLabel(scene.src)) : tr('No image selected')}</span>
                        <button type="button" id="threeSixtyImageClear" class="btn btn-link p-0" ${scene.src ? '' : 'hidden'}>${tr('Clear')}</button>
                    </div>
                    <input type="file" id="threeSixtyImageFile" accept="image/*" style="display:none" />
                </div>
                <div class="property-row">
                    <label class="toggle-label">
                        <input type="checkbox" id="threeSixtyIsPanorama" ${isFlat ? '' : 'checked'} />
                        ${tr('360° panorama image')}
                    </label>
                    <span class="small text-muted">${tr('Uncheck for a regular flat photo (no 360° effect).')}</span>
                </div>
                <div class="property-row">
                    <label for="threeSixtyAlt" class="form-label">${tr('Alternative text')}:</label>
                    <input type="text" id="threeSixtyAlt" class="form-control" value="${escapeAttr(scene.alt)}" />
                </div>
                <div class="property-row">
                    <label for="threeSixtySceneDescription" class="form-label">${tr('Description')}:</label>
                    <textarea id="threeSixtySceneDescription" class="form-control" rows="2">${escapeHtml(scene.description)}</textarea>
                </div>
                ${initialViewFieldset}
            </fieldset>

            <div class="three-sixty-edit-stage">
                <div class="three-sixty-edit-stage-main">
                    <div class="three-sixty-viewer-preview">
                        <div id="threeSixtyPreview" class="three-sixty-preview-stage" aria-label="${escapeAttr(tr('Preview'))}"></div>
                        <p id="threeSixtyPreviewMessage" class="text-muted small">${tr('Select an image to see a live preview.')}</p>
                    </div>
                </div>
            </div>

            <fieldset class="exe-fieldset three-sixty-hotspots">
                <legend>
                    <span class="three-sixty-section-title">${tr('Hotspots')}</span>
                    <span id="threeSixtyHotspotsCount" class="three-sixty-fieldset-count"></span>
                </legend>
                <p class="three-sixty-hint small">${hotspotHint}</p>
                <div class="three-sixty-add-bar" role="group" aria-label="${escapeAttr(tr('Add hotspot'))}">
                    <button type="button" id="threeSixtyPlaceHotspot" class="btn btn-primary" aria-pressed="false">+ ${tr('Place hotspot by clicking')}</button>
                    <button type="button" id="threeSixtyAddHotspot" class="btn btn-secondary">+ ${tr('Add at current view')}</button>
                </div>
                <p id="threeSixtyPlacementHint" class="three-sixty-placement-hint small" hidden>${tr('Click the preview to place the hotspot; press Escape to cancel.')}</p>
                <div id="threeSixtyEditorLive" class="visually-hidden" role="status" aria-live="polite"></div>
                <div id="threeSixtyHotspotList" class="three-sixty-hotspot-list" role="list"></div>
            </fieldset>

            <fieldset class="exe-fieldset three-sixty-controls">
                <legend>${tr('Controls')}</legend>
                <div class="property-row">
                    <label class="toggle-label">
                        <input type="checkbox" id="threeSixtyAutorotate" ${behaviour.autorotate.enabled ? 'checked' : ''} />
                        ${tr('Auto-rotate')}
                    </label>
                    <label for="threeSixtyAutorotateSpeed">${tr('Speed')} (0…10):</label>
                    <input type="number" id="threeSixtyAutorotateSpeed" class="form-control" min="0" max="10" step="0.1" value="${behaviour.autorotate.speed}" />
                </div>
                <div class="property-row">
                    <label class="toggle-label">
                        <input type="checkbox" id="threeSixtyZoom" ${behaviour.zoomEnabled ? 'checked' : ''} />
                        ${tr('Allow zoom')}
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" id="threeSixtyFullscreen" ${behaviour.fullscreenEnabled ? 'checked' : ''} />
                        ${tr('Show fullscreen button')}
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" id="threeSixtyShowLabels" ${behaviour.showLabels ? 'checked' : ''} />
                        ${tr('Show hotspot labels')}
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" id="threeSixtyNavControls" ${behaviour.showNavControls ? 'checked' : ''} />
                        ${tr('Show navigation arrows')}
                    </label>
                </div>
            </fieldset>
        </div>
    `;
}

/**
 * Message shown INSTEAD of the form when the stored document comes from a
 * newer schema version. Saving passes the original payload through untouched.
 */
export function unsupportedVersionHtml(version: number, tr: Translate): string {
    return `
        <div class="three-sixty-viewer-form three-sixty-viewer-unsupported">
            <p class="exe-block-info" role="alert">
                ${escapeHtml(
                    tr('This 360° content was created with a newer version of eXeLearning (format version %s). It cannot be edited here, but its data is preserved: saving keeps it unchanged.').replace(
                        '%s',
                        String(version),
                    ),
                )}
            </p>
        </div>
    `;
}
