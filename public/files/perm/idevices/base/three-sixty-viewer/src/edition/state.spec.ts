import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { createDefaultDocument, hydrateDocument } from '../shared/schema';
import type { ThreeSixtyDocumentV2 } from '../shared/types';
import { createEditorState } from './state';

function tourDocument(): ThreeSixtyDocumentV2 {
    const result = hydrateDocument(
        {
            version: 2,
            startSceneId: 'a',
            scenes: [
                {
                    id: 'a',
                    title: 'A',
                    src: 'a.jpg',
                    hotspots: [{ id: 'h1', label: 'to b', action: { type: 'goToScene', payload: { sceneId: 'b' } } }],
                },
                { id: 'b', title: 'B', src: 'b.jpg' },
            ],
        },
        createSequentialIdGenerator(),
    );
    if (result.status !== 'ok') throw new Error('fixture');
    return result.document;
}

function makeState(document360 = tourDocument()) {
    return createEditorState(document360, createSequentialIdGenerator());
}

describe('createEditorState — scenes', () => {
    it('adds, duplicates and activates scenes with fresh ids', () => {
        const state = makeState();
        const added = state.addScene('Scene 3');
        expect(added.id).toBe('scene-1');
        expect(state.doc.scenes).toHaveLength(3);

        const copy = state.duplicateScene(0, 'copy');
        expect(copy?.title).toBe('A (copy)');
        expect(copy?.id).toBe('scene-2');
        // Duplicated hotspots get new ids.
        expect(copy?.hotspots[0]?.id).toBe('hs-1');
        expect(state.doc.scenes[1]).toBe(copy);

        expect(state.setActiveScene(1)).toBe(true);
        expect(state.activeScene()).toBe(copy);
        expect(state.setActiveScene(99)).toBe(false);
        expect(state.duplicateScene(99, 'copy')).toBeNull();
    });

    it('reports references before deletion and repairs them after', () => {
        const state = makeState();
        expect(state.referencesToScene(1)).toEqual([{ sceneId: 'a', hotspotId: 'h1' }]);
        expect(state.referencesToScene(0)).toEqual([]);

        const removed = state.removeScene(1);
        expect(removed?.id).toBe('b');
        // The dangling goToScene target was cleared deterministically…
        const hotspot = state.doc.scenes[0]?.hotspots[0];
        expect(hotspot?.action).toEqual({ type: 'goToScene', payload: { sceneId: '' } });
        // …and now surfaces as a validation issue.
        expect(state.hotspotIssues(0)).toHaveLength(1);
    });

    it('start scene and active index survive scene removal', () => {
        const state = makeState();
        state.setStartScene('b');
        expect(state.doc.startSceneId).toBe('b');
        state.setActiveScene(1);
        state.removeScene(1);
        expect(state.doc.startSceneId).toBe('a');
        expect(state.activeSceneIndex).toBe(0);
        // Removing the last scene recreates a default one.
        state.removeScene(0);
        expect(state.doc.scenes).toHaveLength(1);
        expect(state.doc.scenes[0]?.id).toBe('scene-1');
        expect(state.removeScene(9)).toBeNull();
    });

    it('setStartScene ignores unknown ids', () => {
        const state = makeState();
        state.setStartScene('nope');
        expect(state.doc.startSceneId).toBe('a');
    });
});

describe('createEditorState — hotspots', () => {
    it('adds hotspots in yaw/pitch or x/y coordinates, clamped and selected', () => {
        const state = makeState();
        const equirect = state.addHotspot({ yaw: 500, pitch: -500 }, 'H2');
        expect(equirect.yaw).toBe(180);
        expect(equirect.pitch).toBe(-90);
        expect(state.selectedHotspotIndex).toBe(1);

        const flat = state.addHotspot({ x: 120, y: -3 }, 'H3');
        expect(flat.x).toBe(100);
        expect(flat.y).toBe(0);
        expect(state.activeScene().hotspots).toHaveLength(3);
    });

    it('removes hotspots and clamps the selection', () => {
        const state = makeState();
        state.addHotspot({ x: 10, y: 10 }, 'H2');
        expect(state.selectedHotspotIndex).toBe(1);
        expect(state.removeHotspot(1)?.label).toBe('H2');
        // Deleting the selected hotspot collapses the accordion selection.
        expect(state.selectedHotspotIndex).toBe(-1);
        expect(state.removeHotspot(42)).toBeNull();
        expect(state.hotspotAt(0)?.id).toBe('h1');
        expect(state.hotspotAt(9)).toBeNull();
    });

    it('switching the action type resets the payload to that type’s default', () => {
        const state = makeState();
        state.setHotspotActionType(0, 'link');
        expect(state.hotspotAt(0)?.action).toEqual({ type: 'link', payload: { url: '', newTab: true } });
        state.setHotspotActionType(0, 'goToScene');
        expect(state.hotspotAt(0)?.action).toEqual({ type: 'goToScene', payload: { sceneId: '' } });
        state.setHotspotActionType(42, 'text'); // out of range: no-op
    });

    it('validates hotspot actions in document context', () => {
        const state = makeState();
        expect(state.hotspotIssues(0)).toEqual([]); // a→b is valid
        state.setHotspotActionType(0, 'goToScene');
        expect(state.hotspotIssues(0)).toHaveLength(1); // empty target
        expect(state.hotspotIssues(9)).toEqual([]);
    });
});

describe('createEditorState — saving', () => {
    it('serializes to the normalized v2 wire form', () => {
        const state = makeState();
        const serialized = state.serialize() as { version: number; scenes: unknown[]; startSceneId: string };
        expect(serialized.version).toBe(2);
        expect(serialized.scenes).toHaveLength(2);
        expect(serialized.startSceneId).toBe('a');
    });

    it('round-trips unsupported hotspot actions through serialize()', () => {
        const result = hydrateDocument(
            {
                version: 2,
                scenes: [{ id: 's', hotspots: [{ id: 'h', action: { type: 'future-action', payload: { keep: 1 } } }] }],
            },
            createSequentialIdGenerator(),
        );
        if (result.status !== 'ok') throw new Error('fixture');
        const state = createEditorState(result.document, createSequentialIdGenerator());
        const serialized = state.serialize() as {
            scenes: Array<{ hotspots: Array<{ action: { type: string; payload: unknown } }> }>;
        };
        expect(serialized.scenes[0]?.hotspots[0]?.action).toEqual({ type: 'future-action', payload: { keep: 1 } });
    });

    it('blocks saving on unsafe link URLs only', () => {
        const state = makeState();
        state.setHotspotActionType(0, 'link');
        expect(state.saveIssues()).toEqual([]); // empty URL is incomplete, not dangerous
        const hotspot = state.hotspotAt(0);
        if (hotspot?.action.type === 'link') hotspot.action.payload.url = 'javascript:alert(1)';
        expect(state.saveIssues()).toHaveLength(1);
        if (hotspot?.action.type === 'link') hotspot.action.payload.url = 'https://example.com';
        expect(state.saveIssues()).toEqual([]);
    });

    it('guards an empty document with a default scene', () => {
        const empty = { ...createDefaultDocument(createSequentialIdGenerator()), scenes: [] };
        const state = createEditorState(empty, createSequentialIdGenerator());
        expect(state.doc.scenes).toHaveLength(1);
        expect(state.activeScene().id).toBe('scene-1');
    });
});
