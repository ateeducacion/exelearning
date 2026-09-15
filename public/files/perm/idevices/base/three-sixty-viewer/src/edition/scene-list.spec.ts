import { describe, expect, it, vi } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import { removeSceneConfirmation, renderSceneList, wireSceneList } from './scene-list';
import { createEditorState } from './state';

const identity = (text: string): string => text;

function makeState() {
    const result = hydrateDocument(
        {
            version: 2,
            startSceneId: 'a',
            scenes: [
                { id: 'a', title: 'Hall', hotspots: [{ id: 'h1', action: { type: 'goToScene', payload: { sceneId: 'b' } } }] },
                { id: 'b', title: '' },
            ],
        },
        createSequentialIdGenerator(),
    );
    if (result.status !== 'ok') throw new Error('fixture');
    return createEditorState(result.document, createSequentialIdGenerator());
}

describe('renderSceneList', () => {
    it('renders rows with titles, start badge, active state and actions', () => {
        const state = makeState();
        const container = document.createElement('div');
        renderSceneList(container, state, identity);
        const rows = container.querySelectorAll('.three-sixty-scene-item');
        expect(rows).toHaveLength(2);
        expect(rows[0]?.classList.contains('is-active')).toBe(true);
        expect(rows[0]?.textContent).toContain('Hall');
        expect(rows[0]?.textContent).toContain('Start');
        // Untitled scenes get a positional fallback label.
        expect(rows[1]?.textContent).toContain('Scene 2');
        // The start scene's set-start button is disabled.
        expect(rows[0]?.querySelector('[data-action="set-start"]')?.hasAttribute('disabled')).toBe(true);
        expect(rows[1]?.querySelector('[data-action="set-start"]')?.hasAttribute('disabled')).toBe(false);
    });
});

describe('wireSceneList', () => {
    it('routes clicks to the right callbacks with the row index', () => {
        const state = makeState();
        const container = document.createElement('div');
        document.body.appendChild(container);
        renderSceneList(container, state, identity);
        const callbacks = {
            onSelect: vi.fn(),
            onSetStart: vi.fn(),
            onDuplicate: vi.fn(),
            onRemove: vi.fn(),
        };
        wireSceneList(container, callbacks);
        container.querySelectorAll('.three-sixty-scene-item')[1]
            ?.querySelector<HTMLButtonElement>('[data-action="select"]')
            ?.click();
        container.querySelectorAll('.three-sixty-scene-item')[1]
            ?.querySelector<HTMLButtonElement>('[data-action="set-start"]')
            ?.click();
        container.querySelectorAll('.three-sixty-scene-item')[0]
            ?.querySelector<HTMLButtonElement>('[data-action="duplicate"]')
            ?.click();
        container.querySelectorAll('.three-sixty-scene-item')[0]
            ?.querySelector<HTMLButtonElement>('[data-action="remove"]')
            ?.click();
        expect(callbacks.onSelect).toHaveBeenCalledWith(1);
        expect(callbacks.onSetStart).toHaveBeenCalledWith(1);
        expect(callbacks.onDuplicate).toHaveBeenCalledWith(0);
        expect(callbacks.onRemove).toHaveBeenCalledWith(0);
        container.remove();
    });
});

describe('removeSceneConfirmation', () => {
    it('is a plain confirmation for unreferenced scenes', () => {
        const state = makeState();
        expect(removeSceneConfirmation(state, 0, identity)).toBe('Delete scene "Hall"?');
    });

    it('counts affected hotspots for referenced scenes', () => {
        const state = makeState();
        const message = removeSceneConfirmation(state, 1, identity);
        expect(message).toContain('"b"');
        expect(message).toContain('1 hotspot(s)');
        expect(message).toContain('cleared');
    });
});
