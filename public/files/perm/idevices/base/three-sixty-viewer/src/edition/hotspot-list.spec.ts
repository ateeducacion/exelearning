import { describe, expect, it, vi } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import { hotspotSummary, renderHotspotList, wireHotspotList } from './hotspot-list';
import { createEditorState } from './state';
import type { EditorState } from './state';

const identity = (text: string): string => text;

function makeState(sceneOverrides: Record<string, unknown> = {}): EditorState {
    const result = hydrateDocument(
        {
            version: 2,
            startSceneId: 'a',
            scenes: [
                {
                    id: 'a',
                    title: 'A',
                    hotspots: [{ id: 'h1', label: 'First', action: { type: 'text', payload: { html: 'hi' } } }],
                    ...sceneOverrides,
                },
                { id: 'b', title: 'B' },
            ],
        },
        createSequentialIdGenerator(),
    );
    if (result.status !== 'ok') throw new Error('fixture');
    const state = createEditorState(result.document, createSequentialIdGenerator());
    // Accordion: fields only render for the selected row.
    state.selectedHotspotIndex = 0;
    return state;
}

function renderInto(state: EditorState): { container: HTMLElement; callbacks: ReturnType<typeof makeCallbacks> } {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const callbacks = makeCallbacks();
    wireHotspotList(container, state, callbacks, identity);
    renderHotspotList(container, state, identity);
    return { container, callbacks };
}

function makeCallbacks() {
    return {
        onChanged: vi.fn(),
        onStructureChanged: vi.fn(),
        onSelect: vi.fn(),
        onDeselect: vi.fn(),
        onPickMedia: vi.fn(),
    };
}

function setInput(container: HTMLElement, selector: string, value: string): void {
    const input = container.querySelector<HTMLInputElement>(selector);
    if (!input) throw new Error(`missing ${selector}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('hotspotSummary', () => {
    it('prefers the label, otherwise describes the action', () => {
        const labeled = makeState().hotspotAt(0);
        expect(labeled && hotspotSummary(labeled, identity)).toBe('First');

        const state = makeState({ hotspots: [{ id: 'h', label: '', action: { type: 'link', payload: { url: '' } } }] });
        const emptyLink = state.hotspotAt(0);
        expect(emptyLink && hotspotSummary(emptyLink, identity)).toBe('Link (no URL)');
    });
});

describe('renderHotspotList', () => {
    it('shows an empty message without hotspots', () => {
        const state = makeState({ hotspots: [] });
        state.selectedHotspotIndex = -1;
        const { container } = renderInto(state);
        expect(container.textContent).toContain('No hotspots in this scene yet.');
        container.remove();
    });

    it('collapses non-selected rows and expands only the selected one', () => {
        const state = makeState({
            hotspots: [
                { id: 'h1', label: 'A', action: { type: 'text', payload: { html: 'a' } } },
                { id: 'h2', label: 'B', action: { type: 'link', payload: { url: 'https://x.test' } } },
            ],
        });
        state.selectedHotspotIndex = 0;
        const { container } = renderInto(state);
        expect(container.querySelectorAll('.three-sixty-hotspot-item')).toHaveLength(2);
        expect(container.querySelectorAll('.three-sixty-hotspot-detail')).toHaveLength(1);
        expect(container.querySelector('.three-sixty-hotspot-item.is-selected .hotspot-label')).toBeTruthy();
        // Collapsed row shows badge + summary, not the editor fields.
        const collapsed = container.querySelector('.three-sixty-hotspot-item:not(.is-selected)');
        expect(collapsed?.querySelector('.hotspot-action-type')).toBeNull();
        expect(collapsed?.textContent).toContain('External link');
        expect(collapsed?.textContent).toContain('B');
        container.remove();
    });

    it('renders yaw/pitch fields for panorama scenes and X/Y for flat scenes', () => {
        const panorama = renderInto(makeState());
        expect(panorama.container.querySelector('.hotspot-yaw')).toBeTruthy();
        expect(panorama.container.querySelector('.hotspot-x')).toBeNull();
        panorama.container.remove();

        const flat = renderInto(makeState({ projection: 'flat' }));
        expect(flat.container.querySelector('.hotspot-x')).toBeTruthy();
        expect(flat.container.querySelector('.hotspot-yaw')).toBeNull();
        flat.container.remove();
    });

    it('renders the action-specific payload editor for each type', () => {
        const state = makeState();
        const { container } = renderInto(state);
        expect(container.querySelector('.hotspot-payload-html')).toBeTruthy();
        for (const [type, selector] of [
            ['goToScene', '.hotspot-payload-sceneId'],
            ['image', '.hotspot-payload-src'],
            ['video', '.hotspot-payload-src'],
            ['link', '.hotspot-payload-url'],
        ] as const) {
            state.setHotspotActionType(0, type);
            renderHotspotList(container, state, identity);
            expect(container.querySelector(selector), type).toBeTruthy();
        }
        state.setHotspotActionType(0, 'image');
        renderHotspotList(container, state, identity);
        expect(container.querySelector('.hotspot-payload-alt')).toBeTruthy();
        expect(container.querySelector('.hotspot-payload-caption')).toBeTruthy();
        state.setHotspotActionType(0, 'link');
        renderHotspotList(container, state, identity);
        expect(container.querySelector('.hotspot-payload-newTab')).toBeTruthy();
        container.remove();
    });

    it('marks the selected row and validation issues inline', () => {
        const state = makeState();
        state.setHotspotActionType(0, 'goToScene'); // empty target → issue
        state.selectedHotspotIndex = 0;
        const { container } = renderInto(state);
        expect(container.querySelector('.three-sixty-hotspot-item.is-selected')).toBeTruthy();
        const error = container.querySelector('.hotspot-field-error');
        expect(error?.getAttribute('role')).toBe('alert');
        expect(error?.textContent).toContain('Select a target scene.');
        // Collapsed validity badge also surfaces on the row header.
        expect(container.querySelector('.three-sixty-hotspot-validity')?.textContent).toContain('⚠');
        container.remove();
    });

    it('renders unsupported actions read-only with an explanation', () => {
        const state = makeState({
            hotspots: [{ id: 'h1', action: { type: 'quiz3d', payload: { keep: true } } }],
        });
        const { container } = renderInto(state);
        const select = container.querySelector<HTMLSelectElement>('.hotspot-action-type');
        expect(select?.disabled).toBe(true);
        expect(select?.textContent).toContain('quiz3d');
        expect(container.textContent).toContain('newer eXeLearning version');
        container.remove();
    });

    it('renders type badges with text labels (not colour alone)', () => {
        const { container } = renderInto(makeState());
        const badge = container.querySelector('.three-sixty-hotspot-badge');
        expect(badge?.textContent).toContain('Text');
        expect(container.querySelector('.three-sixty-kind--text')).toBeTruthy();
        container.remove();
    });
});

describe('wireHotspotList', () => {
    it('updates label and clamped coordinates from inputs', () => {
        const state = makeState();
        const { container, callbacks } = renderInto(state);
        setInput(container, '.hotspot-label', 'Renamed');
        setInput(container, '.hotspot-yaw', '400');
        setInput(container, '.hotspot-pitch', '-400');
        const hotspot = state.hotspotAt(0);
        expect(hotspot?.label).toBe('Renamed');
        expect(hotspot?.yaw).toBe(180);
        expect(hotspot?.pitch).toBe(-90);
        expect(callbacks.onChanged).toHaveBeenCalledTimes(3);
        // Transient "Saved" chip after each edit.
        expect(container.querySelector('.three-sixty-hotspot-saved.is-saved')?.textContent).toContain('Saved');
        container.remove();
    });

    it('updates flat x/y fields', () => {
        const state = makeState({ projection: 'flat' });
        const { container } = renderInto(state);
        setInput(container, '.hotspot-x', '120');
        setInput(container, '.hotspot-y', '30');
        expect(state.hotspotAt(0)?.x).toBe(100);
        expect(state.hotspotAt(0)?.y).toBe(30);
        container.remove();
    });

    it('updates payload fields for each action type', () => {
        const state = makeState();
        const { container } = renderInto(state);
        setInput(container, '.hotspot-payload-html', '<p>new</p>');
        let action = state.hotspotAt(0)?.action;
        expect(action?.type === 'text' && action.payload.html).toBe('<p>new</p>');

        state.setHotspotActionType(0, 'goToScene');
        renderHotspotList(container, state, identity);
        const select = container.querySelector<HTMLSelectElement>('.hotspot-payload-sceneId');
        if (!select) throw new Error('missing select');
        select.value = 'b';
        select.dispatchEvent(new Event('input', { bubbles: true }));
        action = state.hotspotAt(0)?.action;
        expect(action?.type === 'goToScene' && action.payload.sceneId).toBe('b');

        state.setHotspotActionType(0, 'image');
        renderHotspotList(container, state, identity);
        setInput(container, '.hotspot-payload-src', 'asset://img.jpg');
        setInput(container, '.hotspot-payload-alt', 'described');
        setInput(container, '.hotspot-payload-caption', 'cap');
        action = state.hotspotAt(0)?.action;
        expect(action?.type === 'image' && action.payload).toEqual({
            src: 'asset://img.jpg',
            alt: 'described',
            caption: 'cap',
        });

        state.setHotspotActionType(0, 'link');
        renderHotspotList(container, state, identity);
        setInput(container, '.hotspot-payload-url', 'https://example.com');
        const newTab = container.querySelector<HTMLInputElement>('.hotspot-payload-newTab');
        if (!newTab) throw new Error('missing newTab');
        newTab.checked = false;
        newTab.dispatchEvent(new Event('change', { bubbles: true }));
        action = state.hotspotAt(0)?.action;
        expect(action?.type === 'link' && action.payload).toEqual({ url: 'https://example.com', newTab: false });
        container.remove();
    });

    it('switching the action type through the select resets the payload and re-renders', () => {
        const state = makeState();
        const { container, callbacks } = renderInto(state);
        const select = container.querySelector<HTMLSelectElement>('.hotspot-action-type');
        if (!select) throw new Error('missing select');
        select.value = 'video';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.hotspotAt(0)?.action).toEqual({ type: 'video', payload: { src: '', poster: '' } });
        expect(callbacks.onStructureChanged).toHaveBeenCalled();
        container.remove();
    });

    it('confirms deletion inline (no modal) and can be cancelled', () => {
        const state = makeState();
        const { container, callbacks } = renderInto(state);

        container.querySelector<HTMLButtonElement>('[data-hotspot-action="remove"]')?.click();
        expect(state.confirmDeleteHotspotIndex).toBe(0);
        expect(state.activeScene().hotspots).toHaveLength(1);
        expect(callbacks.onStructureChanged).toHaveBeenCalled();

        // Simulate re-render after confirm mode is set.
        renderHotspotList(container, state, identity);
        expect(container.querySelector('.three-sixty-delete-confirm')).toBeTruthy();
        expect(container.textContent).toContain('Delete this hotspot?');

        container.querySelector<HTMLButtonElement>('.three-sixty-hotspot-del-no')?.click();
        expect(state.confirmDeleteHotspotIndex).toBeNull();
        expect(state.activeScene().hotspots).toHaveLength(1);

        // Confirm delete.
        state.confirmDeleteHotspotIndex = 0;
        renderHotspotList(container, state, identity);
        container.querySelector<HTMLButtonElement>('.three-sixty-hotspot-del-yes')?.click();
        expect(state.activeScene().hotspots).toHaveLength(0);
        container.remove();
    });

    it('selects, deselects (Done / re-click) and requests media picking', () => {
        const state = makeState();
        state.setHotspotActionType(0, 'image');
        const { container, callbacks } = renderInto(state);
        renderHotspotList(container, state, identity);
        container.querySelector<HTMLButtonElement>('.hotspot-payload-pickImage')?.click();
        expect(callbacks.onPickMedia).toHaveBeenCalledWith(0, 'image');

        state.setHotspotActionType(0, 'video');
        renderHotspotList(container, state, identity);
        container.querySelector<HTMLButtonElement>('.hotspot-payload-pickVideo')?.click();
        expect(callbacks.onPickMedia).toHaveBeenCalledWith(0, 'video');

        // Re-click selected → deselect.
        container.querySelector<HTMLButtonElement>('.three-sixty-hotspot-select')?.click();
        expect(callbacks.onDeselect).toHaveBeenCalled();

        // Done button also deselects.
        callbacks.onDeselect.mockClear();
        container.querySelector<HTMLButtonElement>('.three-sixty-hotspot-done')?.click();
        expect(callbacks.onDeselect).toHaveBeenCalled();

        // Select another (collapsed) row.
        state.selectedHotspotIndex = -1;
        state.addHotspot({ yaw: 0, pitch: 0 }, 'Second');
        state.selectedHotspotIndex = 0;
        renderHotspotList(container, state, identity);
        const second = container.querySelectorAll<HTMLButtonElement>('.three-sixty-hotspot-select')[1];
        second?.click();
        expect(callbacks.onSelect).toHaveBeenCalledWith(1);
        container.remove();
    });
});
