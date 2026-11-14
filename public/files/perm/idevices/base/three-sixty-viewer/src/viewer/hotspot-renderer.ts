/**
 * Hotspot overlay: one absolutely-positioned button per hotspot on top of the
 * scene. Rendering (buttons, labels, icons) is separated from positioning so
 * the per-frame loop only moves what already exists.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { Hotspot, LabelPosition } from '../shared/types';

export interface HotspotPosition {
    readonly x: number;
    readonly y: number;
    readonly visible: boolean;
}

export interface HotspotLayerOptions {
    /** Extra class on every button (e.g. the editor-handle modifier). */
    readonly buttonModifier?: string;
    readonly showLabels: boolean;
    readonly labelPosition: LabelPosition;
    readonly fallbackLabel: (hotspot: Hotspot) => string;
    readonly onActivate?: (hotspot: Hotspot, button: HTMLButtonElement) => void;
    /** Attach extra behaviour (e.g. drag) to each created button. */
    readonly decorateButton?: (button: HTMLButtonElement, hotspot: Hotspot, index: number) => void;
}

export interface HotspotLayer {
    readonly overlay: HTMLElement;
    readonly buttons: ReadonlyArray<{ readonly button: HTMLButtonElement; readonly hotspot: Hotspot }>;
    setHotspots: (hotspots: readonly Hotspot[]) => void;
    /** Move every button; `positionFor` returns null to hide a hotspot. */
    positionAll: (positionFor: (hotspot: Hotspot) => HotspotPosition | null) => void;
    dispose: () => void;
}

function actionClass(hotspot: Hotspot): string {
    return hotspot.action.type === 'unsupported' ? 'text' : hotspot.action.type;
}

export function createHotspotLayer(host: HTMLElement, options: HotspotLayerOptions): HotspotLayer {
    const overlay = document.createElement('div');
    overlay.className = `three-sixty-viewer-overlay${options.buttonModifier ? ' three-sixty-viewer-overlay--editor' : ''}`;
    host.appendChild(overlay);

    let entries: Array<{ button: HTMLButtonElement; hotspot: Hotspot }> = [];

    const clear = (): void => {
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
        entries = [];
    };

    return {
        overlay,
        get buttons() {
            return entries;
        },

        setHotspots(hotspots) {
            clear();
            hotspots.forEach((hotspot, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className =
                    `three-sixty-viewer-hotspot three-sixty-viewer-hotspot-${actionClass(hotspot)}` +
                    (options.buttonModifier ? ` ${options.buttonModifier}` : '');
                button.setAttribute('data-hotspot-id', hotspot.id);
                button.setAttribute('data-hotspot-index', String(index));
                const label = hotspot.label || options.fallbackLabel(hotspot);
                button.setAttribute('aria-label', label);
                button.setAttribute('title', label);
                button.setAttribute('tabindex', '0');
                // Hidden until positioned on the first frame.
                button.style.display = 'none';

                const icon = document.createElement('span');
                icon.className = 'three-sixty-viewer-hotspot-icon';
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);

                if (hotspot.label && options.showLabels) {
                    const labelEl = document.createElement('span');
                    labelEl.className =
                        `three-sixty-viewer-hotspot-label three-sixty-viewer-hotspot-label-${options.labelPosition}`;
                    labelEl.textContent = hotspot.label;
                    button.appendChild(labelEl);
                }

                if (options.onActivate) {
                    button.addEventListener('click', event => {
                        event.preventDefault();
                        options.onActivate?.(hotspot, button);
                    });
                    button.addEventListener('keydown', event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            options.onActivate?.(hotspot, button);
                        }
                    });
                }
                options.decorateButton?.(button, hotspot, index);

                overlay.appendChild(button);
                entries.push({ button, hotspot });
            });
        },

        positionAll(positionFor) {
            for (const entry of entries) {
                const position = positionFor(entry.hotspot);
                if (!position || !position.visible) {
                    entry.button.style.display = 'none';
                    continue;
                }
                entry.button.style.display = '';
                entry.button.style.left = `${position.x}px`;
                entry.button.style.top = `${position.y}px`;
            }
        },

        dispose() {
            clear();
            overlay.parentNode?.removeChild(overlay);
        },
    };
}
