/**
 * Static markup generation for the exported page.
 *
 * Everything here is a pure string builder: the same input always produces the
 * same HTML, which is what makes `renderView` testable without a DOM.
 *
 * Two deliberate choices carry over from the interaction design:
 *
 *  - The `<model-viewer>` element ships WITHOUT a `src`. The runtime sets it at
 *    boot from `data-model-src`, so an STL never reaches model-viewer's GLB
 *    loader and no `blob:` URL is ever persisted into the saved HTML.
 *  - Interaction state travels as an escaped JSON `<script>` block rather than
 *    flat attributes, because markers are a nested, variable-length array. The
 *    global export rewriter still finds `asset://` inside it.
 */

import { DEFAULT_BACKGROUND_COLOR, DEFAULT_MODEL_COLOR } from '../shared/colors';
import { escapeHtml, escapeJsonForScript, stripHtmlToText } from '../shared/html';
import { detectModelType } from '../shared/model-source';
import type { InteractionSettings, Marker, ScormSettings, ViewerDisplayConfig } from '../shared/types';
import { safeUrl } from '../shared/urls';
import { buildRuntimeI18n, translate, translateContent } from './i18n';

/** The `<model-viewer>` element, without `src` (see the module note). */
export function buildModelMarkup(config: ViewerDisplayConfig): string {
    const attributes: Array<[string, string]> = [
        ['shadow-intensity', '1'],
        ['tone-mapping', 'pbr-neutral'],
        ['reveal', 'auto'],
        ['style', `background-color: ${config.backgroundColor || DEFAULT_BACKGROUND_COLOR};`],
    ];
    if (config.alt) {
        attributes.push(['alt', config.alt], ['aria-label', config.alt]);
    }
    if (config.cameraControls) {
        attributes.push(['camera-controls', '']);
    }
    if (config.autoRotate) {
        attributes.push(['auto-rotate', ''], ['rotation-per-second', `${config.autoRotateSpeed || 30}deg`]);
    }
    const rendered = attributes
        .map(([name, value]) => (value === '' ? name : `${name}="${escapeHtml(value)}"`))
        .join(' ');
    return `<model-viewer ${rendered}></model-viewer>`;
}

/**
 * The flat `data-*` attributes the runtime boots from.
 *
 * `data-model-src` carries the canonical `asset://` URL, which the export
 * pipeline rewrites to `content/resources/...`. `data-model-asset-ref` carries
 * the same reference without the scheme so the rewriter leaves it alone; that
 * is what lets a live AssetManager recover the original handle after the
 * rewrite.
 */
export function buildWrapperAttributes(config: ViewerDisplayConfig, assetRef = ''): string {
    const parts: string[] = [];
    const push = (name: string, value: string | number): void => {
        parts.push(`${name}="${escapeHtml(String(value))}"`);
    };
    const src = config.src;
    const type = config.type || (src ? detectModelType(src) : '');
    if (src) {
        push('data-model-src', src);
    }
    if (assetRef) {
        push('data-model-asset-ref', assetRef);
    }
    if (type && type !== 'unknown') {
        push('data-model-type', type);
    }
    push('data-model-color', config.modelColor || DEFAULT_MODEL_COLOR);
    push('data-background-color', config.backgroundColor || DEFAULT_BACKGROUND_COLOR);
    push('data-camera-controls', config.cameraControls ? 'true' : 'false');
    push('data-auto-rotate', config.autoRotate ? 'true' : 'false');
    push('data-auto-rotate-speed', config.autoRotateSpeed || 30);
    push('data-show-nav-controls', config.showNavControls ? 'true' : 'false');
    push('data-animation-enabled', config.animation.enabled ? 'true' : 'false');
    if (config.animation.name) {
        push('data-animation-name', config.animation.name);
    }
    push('data-animation-speed', config.animation.speed);
    if (config.alt) {
        push('data-alt', config.alt);
    }
    return parts.join(' ');
}

/** The fullscreen button and 4-direction nav pad, when the author enabled them. */
export function buildControlsMarkup(config: ViewerDisplayConfig): string {
    if (!config.showNavControls) {
        return '';
    }
    const fullscreenLabel = escapeHtml(translate('viewer.fullscreen'));
    const directions: Array<[string, string, string]> = [
        ['left', '←', translate('viewer.rotate_left')],
        ['up', '↑', translate('viewer.tilt_up')],
        ['down', '↓', translate('viewer.tilt_down')],
        ['right', '→', translate('viewer.rotate_right')],
    ];
    const buttons = directions
        .map(([key, glyph, label]) => {
            const safeLabel = escapeHtml(label);
            return `<button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-${key}" data-nav="${key}" aria-label="${safeLabel}" title="${safeLabel}">${glyph}</button>`;
        })
        .join('');
    return `
            <button type="button" class="three-d-viewer-fullscreen-button" data-fullscreen aria-label="${fullscreenLabel}" title="${fullscreenLabel}">⛶</button>
            <div class="three-d-viewer-nav" role="group" aria-label="${escapeHtml(translate('viewer.rotate_left'))}">${buttons}</div>
        `;
}

function buildMarkerFallbackItem(marker: Marker, index: number): string {
    const label = marker.label || `${translateContent('Marker')} ${index + 1}`;
    const parts = [`<strong>${index + 1}. ${escapeHtml(label)}</strong>`];
    if (marker.description) {
        parts.push(`<p>${escapeHtml(marker.description)}</p>`);
    }
    const action = marker.action;
    switch (action.type) {
        case 'information': {
            const text = stripHtmlToText(action.payload.html);
            if (text) {
                parts.push(`<p>${escapeHtml(text)}</p>`);
            }
            break;
        }
        case 'image': {
            if (action.payload.alt) {
                parts.push(`<p>${escapeHtml(action.payload.alt)}</p>`);
            }
            if (action.payload.caption) {
                parts.push(`<p>${escapeHtml(action.payload.caption)}</p>`);
            }
            break;
        }
        case 'link': {
            const url = safeUrl(action.payload.url);
            if (url) {
                parts.push(`<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
            }
            break;
        }
        case 'question': {
            if (action.payload.prompt) {
                parts.push(`<p>${escapeHtml(action.payload.prompt)}</p>`);
            }
            const options = action.payload.options.map(option => `<li>${escapeHtml(option.text)}</li>`).join('');
            if (options) {
                parts.push(`<ul>${options}</ul>`);
            }
            break;
        }
        case 'video':
            break;
    }
    return `<li>${parts.join('')}</li>`;
}

/** The static, escaped marker list shown whenever the 3D overlay cannot render. */
export function buildInteractionFallback(interaction: InteractionSettings): string {
    const items = interaction.markers.map(buildMarkerFallbackItem).join('');
    return `<ul class="tdv-fallback" hidden>${items}</ul>`;
}

/**
 * The interaction payload: a JSON data block, the accessible fallback list and
 * the guided-navigation controls. Empty when interactions are disabled.
 */
export function buildInteractionMarkup(interaction: InteractionSettings, scorm: ScormSettings): string {
    if (!interaction.enabled) {
        return '';
    }
    const payload = { ...interaction, i18n: buildRuntimeI18n(), scorm };
    const dataBlock = `<script type="application/json" class="tdv-interaction-data">${escapeJsonForScript(payload)}</${'script'}>`;
    let nav = '';
    if (interaction.guidedMode) {
        nav =
            '<div class="tdv-guided-nav" data-guided hidden>' +
            `<button type="button" class="tdv-nav-prev">${escapeHtml(translateContent('Previous'))}</button>` +
            '<span class="tdv-guided-status" aria-live="polite"></span>' +
            `<button type="button" class="tdv-nav-next">${escapeHtml(translateContent('Next'))}</button>` +
            '</div>';
    }
    return dataBlock + buildInteractionFallback(interaction) + nav;
}

/** Assemble the complete wrapper markup for one iDevice. */
export function buildViewerMarkup(options: {
    viewerId: string;
    config: ViewerDisplayConfig;
    interaction: InteractionSettings;
    scorm: ScormSettings;
    assetRef?: string;
}): string {
    const { viewerId, config, interaction, scorm } = options;
    return `
                <div class="three-d-viewer-wrapper" data-three-d id="${escapeHtml(viewerId)}" ${buildWrapperAttributes(config, options.assetRef ?? '')}>
                    ${buildModelMarkup(config)}
                    <span class="sr-only" data-live aria-live="polite"></span>
                    <div class="viewer-empty" data-empty>${escapeHtml(translate('viewer.empty_state'))}</div>
                    ${buildControlsMarkup(config)}
                    ${buildInteractionMarkup(interaction, scorm)}
                </div>
            `;
}

/**
 * Whether the empty-state overlay should be shown.
 *
 * A model is present when the iDevice has a configured source — a relative
 * `content/resources/...` path, an `asset://` handle, a `blob:` URL or an
 * absolute URL all count — or when `<model-viewer>` already resolved one.
 */
export function computeEmptyStateDisplay(configSrc: string, viewerSrc: string): 'none' | 'grid' {
    return configSrc.trim() || viewerSrc.trim() ? 'none' : 'grid';
}
