/**
 * The editor markup and the typed handle over its elements.
 *
 * The template is a pure function of the translator, and `collectElements`
 * is the only place that knows the DOM ids — everything else works through the
 * returned handle, so a markup change breaks in one place instead of ten.
 */

import { escapeHtml } from '../shared/html';

export type Translate = (text: string) => string;

/** Every element the editor interacts with, resolved once. */
export interface EditorElements {
    root: HTMLElement;
    preview: HTMLElement;
    ariaLive: HTMLElement;
    animationRow: HTMLElement;
    autoRotateSpeedRow: HTMLElement;
    modelColorHint: HTMLElement;
    src: HTMLInputElement;
    alt: HTMLInputElement;
    modelColor: HTMLInputElement;
    backgroundColor: HTMLInputElement;
    cameraControls: HTMLInputElement;
    autoRotate: HTMLInputElement;
    autoRotateSpeed: HTMLInputElement;
    showNavControls: HTMLInputElement;
    animationToggle: HTMLInputElement;
    animationName: HTMLSelectElement;
    animationSpeed: HTMLInputElement;
    interactionsEnable: HTMLInputElement;
    interactionsBody: HTMLElement;
    guidedMode: HTMLInputElement;
    wrapNavigation: HTMLInputElement;
    showMarkerLabels: HTMLInputElement;
    addMarker: HTMLButtonElement;
    placementHint: HTMLElement;
    markerList: HTMLElement;
    markerEditorHost: HTMLElement;
    scormSection: HTMLElement;
    scormHost: HTMLElement;
}

/** Build the editor HTML. */
export function renderEditorMarkup(t: Translate): string {
    const e = (text: string): string => escapeHtml(t(text));
    return `
                <div class="three-d-viewer-editor" id="threeDViewerEditor">
                    <div class="container">
                        <!-- Preview area -->
                        <div class="ratio ratio-16x9 mb-4 viewer-preview-container">
                            <div class="viewer-preview" id="threeDViewerPreview">
                                <div class="viewer-empty" data-empty-state>
                                    <div class="viewer-empty-content">
                                        <svg class="viewer-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                        </svg>
                                        <span>${e('Select a 3D model to preview')}</span>
                                    </div>
                                </div>
                                <button type="button" class="three-d-viewer-fullscreen-button" data-fullscreen aria-label="${e('Fullscreen')}" title="${e('Fullscreen')}">⛶</button>
                                <div class="three-d-viewer-nav" role="group" aria-label="${e('Rotate model')}">
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-left" data-nav="left" aria-label="${e('Rotate left')}" title="${e('Rotate left')}">←</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-up" data-nav="up" aria-label="${e('Tilt up')}" title="${e('Tilt up')}">↑</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-down" data-nav="down" aria-label="${e('Tilt down')}" title="${e('Tilt down')}">↓</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-right" data-nav="right" aria-label="${e('Rotate right')}" title="${e('Rotate right')}">→</button>
                                </div>
                            </div>
                        </div>

                        <!-- Model file selector -->
                        <div class="d-flex align-items-center mb-3">
                            <label for="threeD3DModelFile" class="form-label me-2 mb-0 text-nowrap">${e('3D Model')}:</label>
                            <input type="text" class="exe-file-picker form-control" id="threeD3DModelFile" readonly placeholder="${e('Select a GLB, GLTF or STL file')}" />
                        </div>
                        <p class="form-text text-muted mb-4">${e('Supported formats')}: GLB, GLTF, STL</p>

                        <!-- Alt text -->
                        <div class="mb-4">
                            <label for="threeDAlt" class="form-label">${e('Alternative text')}:</label>
                            <input type="text" class="form-control" id="threeDAlt" maxlength="180" placeholder="${e('Describe the 3D model for accessibility')}" />
                            <p class="form-text text-muted">${e('Describe the 3D model for screen readers and accessibility')}</p>
                        </div>

                        <!-- Display options -->
                        <fieldset class="mb-4">
                            <legend class="h6 mb-3">${e('Display Options')}</legend>

                            <div class="row align-items-center mb-3">
                                <label for="threeDBackground" class="col-auto col-form-label">${e('Background color')}:</label>
                                <div class="col-auto">
                                    <input type="color" class="form-control form-control-color" id="threeDBackground" title="${e('Choose background color')}" />
                                </div>
                            </div>

                            <div class="row align-items-center mb-3">
                                <label for="threeDModelColor" class="col-auto col-form-label">${e('STL model color')}:</label>
                                <div class="col-auto">
                                    <input type="color" class="form-control form-control-color" id="threeDModelColor" title="${e('Choose STL model color')}" value="#888888" />
                                </div>
                                <div class="col form-text text-muted mb-0" id="threeDModelColorHint">${e('Only used for STL files; ignored for GLB/GLTF (materials come from the model).')}</div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDCameraControls" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDCameraControls" class="toggle-label">${e('Enable camera controls')}</label>
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDAutoRotate" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDAutoRotate" class="toggle-label">${e('Auto-rotate model')}</label>
                                </div>
                                <div class="d-flex align-items-center gap-2" id="threeDAutoRotateSpeedRow">
                                    <label for="threeDAutoRotateSpeed" class="form-label mb-0 text-nowrap">${e('Speed')}:</label>
                                    <div class="input-group" style="width: 7em;">
                                        <input type="number" class="form-control" id="threeDAutoRotateSpeed" min="1" max="90" step="1" value="30" />
                                        <span class="input-group-text">°/s</span>
                                    </div>
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-1">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDShowNavControls" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDShowNavControls" class="toggle-label">${e('Show navigation controls (fullscreen + arrows)')}</label>
                                </div>
                            </div>
                            <p class="form-text text-muted">${e('Mutually exclusive with auto-rotate.')}</p>
                        </fieldset>

                        <!-- Animation options (shown when the model has animations) -->
                        <fieldset class="mb-3" data-animation-row hidden>
                            <legend class="h6 mb-3">${e('Animation')}</legend>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDAnimationToggle" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDAnimationToggle" class="toggle-label">${e('Play animation')}</label>
                                </div>
                            </div>

                            <div class="row g-3">
                                <div class="col-sm-6">
                                    <label for="threeDAnimationName" class="form-label">${e('Animation')}:</label>
                                    <select class="form-select" id="threeDAnimationName"></select>
                                </div>
                                <div class="col-sm-6">
                                    <label for="threeDAnimationSpeed" class="form-label">${e('Speed')}:</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="threeDAnimationSpeed" min="0.1" max="3" step="0.1" value="1" />
                                        <span class="input-group-text">x</span>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        <!-- Interactions (markers / guided navigation / questions) -->
                        <fieldset class="mb-3 tdv-interactions" data-interactions>
                            <legend class="h6 mb-3">${e('Interactions')}</legend>
                            <div class="toggle-item mb-2">
                                <span class="toggle-control">
                                    <input type="checkbox" id="threeDInteractionsEnable" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label for="threeDInteractionsEnable" class="toggle-label">${e('Enable interactions')}</label>
                            </div>
                            <div id="threeDInteractionsBody" hidden>
                                <div class="toggle-item mb-2">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDGuidedMode" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDGuidedMode" class="toggle-label">${e('Guided navigation (previous / next)')}</label>
                                </div>
                                <div class="toggle-item mb-2">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDWrapNavigation" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDWrapNavigation" class="toggle-label">${e('Wrap around at the ends')}</label>
                                </div>
                                <div class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDShowMarkerLabels" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDShowMarkerLabels" class="toggle-label">${e('Show marker labels')}</label>
                                </div>
                                <button type="button" class="btn btn-secondary btn-sm mb-2" id="threeDAddMarker">${e('Add marker')}</button>
                                <p class="form-text text-muted" id="threeDPlacementHint" hidden>${e('Click on the model to place the marker.')}</p>
                                <ul class="tdv-marker-list list-unstyled mb-0" id="threeDMarkerList"></ul>
                                <div class="tdv-scorm mt-3" id="threeDScormSection" hidden>
                                    <h4 class="h6">${e('Assessment (SCORM)')}</h4>
                                    <div id="threeDScormTab"></div>
                                </div>
                            </div>
                        </fieldset>
                        <div class="tdv-marker-editor-host" id="threeDMarkerEditorHost"></div>
                    </div>
                    <div class="sr-only" id="threeDAnimationLive" aria-live="polite"></div>
                </div>
            `;
}

/**
 * Markup shown instead of the form when the stored document uses a schema this
 * build cannot read. The original data is left untouched so a newer build can
 * still open it.
 */
export function renderUnsupportedVersionMarkup(t: Translate, version: number): string {
    return `
                <div class="three-d-viewer-editor three-d-viewer-editor--unsupported" id="threeDViewerEditor">
                    <div class="container">
                        <div class="alert alert-warning" role="alert" data-unsupported-version="${escapeHtml(String(version))}">
                            <p class="mb-0">${escapeHtml(t('This 3D Viewer was created with a newer version of eXeLearning and cannot be edited here.'))}</p>
                            <p class="mb-0">${escapeHtml(t('Update eXeLearning to edit it. Its content is preserved.'))}</p>
                        </div>
                    </div>
                </div>
            `;
}

function require<T extends Element>(root: HTMLElement, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
        throw new Error(`[3D Viewer] Editor element not found: ${selector}`);
    }
    return element;
}

/** Resolve every editor element from a freshly rendered root. */
export function collectElements(root: HTMLElement): EditorElements {
    return {
        root,
        preview: require<HTMLElement>(root, '#threeDViewerPreview'),
        ariaLive: require<HTMLElement>(root, '#threeDAnimationLive'),
        animationRow: require<HTMLElement>(root, '[data-animation-row]'),
        autoRotateSpeedRow: require<HTMLElement>(root, '#threeDAutoRotateSpeedRow'),
        modelColorHint: require<HTMLElement>(root, '#threeDModelColorHint'),
        src: require<HTMLInputElement>(root, '#threeD3DModelFile'),
        alt: require<HTMLInputElement>(root, '#threeDAlt'),
        modelColor: require<HTMLInputElement>(root, '#threeDModelColor'),
        backgroundColor: require<HTMLInputElement>(root, '#threeDBackground'),
        cameraControls: require<HTMLInputElement>(root, '#threeDCameraControls'),
        autoRotate: require<HTMLInputElement>(root, '#threeDAutoRotate'),
        autoRotateSpeed: require<HTMLInputElement>(root, '#threeDAutoRotateSpeed'),
        showNavControls: require<HTMLInputElement>(root, '#threeDShowNavControls'),
        animationToggle: require<HTMLInputElement>(root, '#threeDAnimationToggle'),
        animationName: require<HTMLSelectElement>(root, '#threeDAnimationName'),
        animationSpeed: require<HTMLInputElement>(root, '#threeDAnimationSpeed'),
        interactionsEnable: require<HTMLInputElement>(root, '#threeDInteractionsEnable'),
        interactionsBody: require<HTMLElement>(root, '#threeDInteractionsBody'),
        guidedMode: require<HTMLInputElement>(root, '#threeDGuidedMode'),
        wrapNavigation: require<HTMLInputElement>(root, '#threeDWrapNavigation'),
        showMarkerLabels: require<HTMLInputElement>(root, '#threeDShowMarkerLabels'),
        addMarker: require<HTMLButtonElement>(root, '#threeDAddMarker'),
        placementHint: require<HTMLElement>(root, '#threeDPlacementHint'),
        markerList: require<HTMLElement>(root, '#threeDMarkerList'),
        markerEditorHost: require<HTMLElement>(root, '#threeDMarkerEditorHost'),
        scormSection: require<HTMLElement>(root, '#threeDScormSection'),
        scormHost: require<HTMLElement>(root, '#threeDScormTab'),
    };
}
