/**
 * The marker button. Both adapters build the same accessible element so a
 * marker looks and reads identically on the GLB/GLTF and STL paths; only the
 * positioning mechanism differs.
 */

import type { Marker } from '../shared/types';
import type { MarkerRenderOptions } from './types';

export interface MarkerButtonOptions extends MarkerRenderOptions {
    index: number;
    label: string;
    /** Extra class marking the render path, e.g. `tdv-marker--mv`. */
    variantClass: string;
    onActivate: (markerId: string) => void;
}

/** Build one marker button, fully wired and labelled. */
export function createMarkerButton(marker: Marker, options: MarkerButtonOptions): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tdv-marker ${options.variantClass}`;
    button.dataset.markerId = marker.id;
    button.dataset.markerOrder = String(options.index);
    button.setAttribute('aria-label', options.label);

    const icon = document.createElement('span');
    icon.className = `tdv-marker-icon tdv-icon-${marker.icon}`;
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);

    if (options.showLabels && marker.label) {
        const label = document.createElement('span');
        label.className = 'tdv-marker-label';
        label.textContent = marker.label;
        button.appendChild(label);
    }

    if (options.activeId === marker.id) {
        button.classList.add('tdv-marker--active');
        button.setAttribute('aria-current', 'true');
    }

    // Bound directly: marker buttons are rebuilt on every render and removed on
    // destroy, so their listeners die with them and never need tracking.
    button.addEventListener('click', () => options.onActivate(marker.id));
    return button;
}

/** Reflect the active marker across an already-rendered set of buttons. */
export function applyActiveMarker(buttons: Iterable<HTMLElement>, activeId: string): void {
    for (const button of buttons) {
        const isActive = button.dataset.markerId === activeId;
        button.classList.toggle('tdv-marker--active', isActive);
        if (isActive) {
            button.setAttribute('aria-current', 'true');
        } else {
            button.removeAttribute('aria-current');
        }
    }
}
