/**
 * The authored marker list: one row per marker with reorder, edit and delete.
 * Pure DOM rendering driven by callbacks, so it can be tested without the
 * device or a live preview.
 */

import type { Marker, MarkerActionType } from '../shared/types';
import type { Translate } from './editor';

export interface MarkerListCallbacks {
    onMove: (markerId: string, delta: -1 | 1) => void;
    onEdit: (markerId: string) => void;
    onDelete: (markerId: string) => void;
}

/** Human-readable label for a marker action type. */
export function actionTypeLabel(type: MarkerActionType, t: Translate): string {
    const labels: Record<MarkerActionType, string> = {
        information: t('Information'),
        image: t('Image'),
        video: t('Video'),
        link: t('Link'),
        question: t('Question'),
    };
    return labels[type];
}

function createRowButton(options: {
    className: string;
    glyph: string;
    title: string;
    markerName: string;
    disabled: boolean;
    onClick: () => void;
}): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn-sm btn-outline-secondary ${options.className}`;
    button.textContent = options.glyph;
    button.title = options.title;
    button.setAttribute('aria-label', `${options.title}: ${options.markerName}`);
    button.disabled = options.disabled;
    button.addEventListener('click', options.onClick);
    return button;
}

/** Re-render the whole list. Rows are rebuilt, so their listeners die with them. */
export function renderMarkerList(
    host: HTMLElement,
    markers: readonly Marker[],
    t: Translate,
    callbacks: MarkerListCallbacks,
): void {
    host.innerHTML = '';
    markers.forEach((marker, index) => {
        const name = marker.label || `${t('Marker')} ${index + 1}`;
        const row = document.createElement('li');
        row.className = 'tdv-marker-row d-flex align-items-center gap-1 mb-1';
        row.dataset.markerId = marker.id;

        const label = document.createElement('span');
        label.className = 'tdv-marker-row-label flex-grow-1';
        label.textContent = `${index + 1}. ${name} — ${actionTypeLabel(marker.action.type, t)}`;
        row.appendChild(label);

        row.append(
            createRowButton({
                className: 'tdv-move-up',
                glyph: '↑',
                title: t('Move up'),
                markerName: name,
                disabled: index === 0,
                onClick: () => callbacks.onMove(marker.id, -1),
            }),
            createRowButton({
                className: 'tdv-move-down',
                glyph: '↓',
                title: t('Move down'),
                markerName: name,
                disabled: index === markers.length - 1,
                onClick: () => callbacks.onMove(marker.id, 1),
            }),
            createRowButton({
                className: 'tdv-edit-marker',
                glyph: '✎',
                title: t('Edit'),
                markerName: name,
                disabled: false,
                onClick: () => callbacks.onEdit(marker.id),
            }),
            createRowButton({
                className: 'tdv-delete-marker',
                glyph: '✕',
                title: t('Delete'),
                markerName: name,
                disabled: false,
                onClick: () => callbacks.onDelete(marker.id),
            }),
        );
        host.appendChild(row);
    });
}

/** Move a marker one slot and re-index `order`. Returns a new array. */
export function moveMarker(markers: readonly Marker[], markerId: string, delta: -1 | 1): Marker[] {
    const from = markers.findIndex(marker => marker.id === markerId);
    const to = from + delta;
    const next = [...markers];
    const moved = next[from];
    const displaced = next[to];
    if (from < 0 || !moved || !displaced) {
        return next;
    }
    next[from] = displaced;
    next[to] = moved;
    return next.map((marker, index) => ({ ...marker, order: index }));
}

/** Remove a marker and re-index `order`. Returns a new array. */
export function removeMarker(markers: readonly Marker[], markerId: string): Marker[] {
    return markers.filter(marker => marker.id !== markerId).map((marker, index) => ({ ...marker, order: index }));
}
