import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Marker } from '../shared/types';
import { createWrapper, makeMarker, resetDom, sequentialIds } from '../test/helpers';
import { actionTypeLabel, moveMarker, removeMarker, renderMarkerList } from './marker-list';

const t = (text: string): string => text;

afterEach(resetDom);

function markers(): Marker[] {
    const ids = sequentialIds();
    return [
        makeMarker({ id: 'a', label: 'First' }, 0, ids),
        makeMarker({ id: 'b', label: '', action: { type: 'question', payload: {} } }, 1, ids),
        makeMarker({ id: 'c', label: 'Third' }, 2, ids),
    ];
}

describe('actionTypeLabel', () => {
    it('names every action type', () => {
        expect(actionTypeLabel('information', t)).toBe('Information');
        expect(actionTypeLabel('image', t)).toBe('Image');
        expect(actionTypeLabel('video', t)).toBe('Video');
        expect(actionTypeLabel('link', t)).toBe('Link');
        expect(actionTypeLabel('question', t)).toBe('Question');
    });
});

describe('renderMarkerList', () => {
    it('renders one row per marker, numbered and typed', () => {
        const host = createWrapper();
        renderMarkerList(host, markers(), t, { onMove: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });
        const rows = host.querySelectorAll('.tdv-marker-row');
        expect(rows).toHaveLength(3);
        expect(rows[0]?.querySelector('.tdv-marker-row-label')?.textContent).toBe('1. First — Information');
        // A marker with no label falls back to a numbered name.
        expect(rows[1]?.querySelector('.tdv-marker-row-label')?.textContent).toBe('2. Marker 2 — Question');
    });

    it('disables the reorder buttons at the ends', () => {
        const host = createWrapper();
        renderMarkerList(host, markers(), t, { onMove: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });
        const rows = host.querySelectorAll('.tdv-marker-row');
        expect(rows[0]?.querySelector<HTMLButtonElement>('.tdv-move-up')?.disabled).toBe(true);
        expect(rows[0]?.querySelector<HTMLButtonElement>('.tdv-move-down')?.disabled).toBe(false);
        expect(rows[2]?.querySelector<HTMLButtonElement>('.tdv-move-down')?.disabled).toBe(true);
    });

    it('labels every button for screen readers', () => {
        const host = createWrapper();
        renderMarkerList(host, markers(), t, { onMove: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });
        const row = host.querySelector('.tdv-marker-row');
        expect(row?.querySelector('.tdv-edit-marker')?.getAttribute('aria-label')).toBe('Edit: First');
        expect(row?.querySelector('.tdv-delete-marker')?.getAttribute('aria-label')).toBe('Delete: First');
    });

    it('wires the row callbacks', () => {
        const host = createWrapper();
        const onMove = vi.fn();
        const onEdit = vi.fn();
        const onDelete = vi.fn();
        renderMarkerList(host, markers(), t, { onMove, onEdit, onDelete });
        const row = host.querySelectorAll('.tdv-marker-row')[1];
        row?.querySelector<HTMLButtonElement>('.tdv-move-up')?.click();
        row?.querySelector<HTMLButtonElement>('.tdv-move-down')?.click();
        row?.querySelector<HTMLButtonElement>('.tdv-edit-marker')?.click();
        row?.querySelector<HTMLButtonElement>('.tdv-delete-marker')?.click();
        expect(onMove).toHaveBeenNthCalledWith(1, 'b', -1);
        expect(onMove).toHaveBeenNthCalledWith(2, 'b', 1);
        expect(onEdit).toHaveBeenCalledWith('b');
        expect(onDelete).toHaveBeenCalledWith('b');
    });

    it('replaces the previous rows instead of appending', () => {
        const host = createWrapper();
        const callbacks = { onMove: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
        renderMarkerList(host, markers(), t, callbacks);
        renderMarkerList(host, markers().slice(0, 1), t, callbacks);
        expect(host.querySelectorAll('.tdv-marker-row')).toHaveLength(1);
    });
});

describe('moveMarker', () => {
    it('swaps with the neighbour and re-indexes order', () => {
        const moved = moveMarker(markers(), 'b', -1);
        expect(moved.map(marker => marker.id)).toEqual(['b', 'a', 'c']);
        expect(moved.map(marker => marker.order)).toEqual([0, 1, 2]);
    });

    it('does nothing at the ends or for an unknown id', () => {
        expect(moveMarker(markers(), 'a', -1).map(marker => marker.id)).toEqual(['a', 'b', 'c']);
        expect(moveMarker(markers(), 'c', 1).map(marker => marker.id)).toEqual(['a', 'b', 'c']);
        expect(moveMarker(markers(), 'ghost', 1).map(marker => marker.id)).toEqual(['a', 'b', 'c']);
    });
});

describe('removeMarker', () => {
    it('removes the marker and re-indexes order', () => {
        const remaining = removeMarker(markers(), 'b');
        expect(remaining.map(marker => marker.id)).toEqual(['a', 'c']);
        expect(remaining.map(marker => marker.order)).toEqual([0, 1]);
    });

    it('is a no-op for an unknown id', () => {
        expect(removeMarker(markers(), 'ghost')).toHaveLength(3);
    });
});
