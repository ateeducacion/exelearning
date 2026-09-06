import { describe, expect, it } from 'vitest';
import {
    createDefaultAction,
    hotspotsReferencingScene,
    isKnownActionType,
    normalizeAction,
    repairSceneReferences,
    serializeAction,
    validateAction,
} from './hotspot-actions';
import { createSequentialIdGenerator } from './ids';
import { normalizeDocument } from './normalization';
import type { HotspotAction } from './types';

describe('isKnownActionType / createDefaultAction', () => {
    it('recognises every supported action type', () => {
        for (const type of ['goToScene', 'text', 'image', 'video', 'link'] as const) {
            expect(isKnownActionType(type)).toBe(true);
            expect(createDefaultAction(type).type).toBe(type);
        }
        expect(isKnownActionType('quiz')).toBe(false);
        expect(isKnownActionType(undefined)).toBe(false);
        expect(isKnownActionType(3)).toBe(false);
    });

    it('link defaults to opening in a new tab', () => {
        expect(createDefaultAction('link')).toEqual({ type: 'link', payload: { url: '', newTab: true } });
    });
});

describe('normalizeAction', () => {
    it('normalizes each known payload, dropping bad field types', () => {
        expect(normalizeAction({ type: 'goToScene', payload: { sceneId: 's2' } })).toEqual({
            type: 'goToScene',
            payload: { sceneId: 's2' },
        });
        expect(normalizeAction({ type: 'goToScene', payload: { sceneId: 7 } })).toEqual({
            type: 'goToScene',
            payload: { sceneId: '' },
        });
        expect(normalizeAction({ type: 'text', payload: { html: '<p>x</p>' } })).toEqual({
            type: 'text',
            payload: { html: '<p>x</p>' },
        });
        expect(normalizeAction({ type: 'image', payload: { src: 'a.jpg' } })).toEqual({
            type: 'image',
            payload: { src: 'a.jpg', alt: '', caption: '' },
        });
        expect(normalizeAction({ type: 'video', payload: { src: 'v.mp4', poster: 'p.jpg' } })).toEqual({
            type: 'video',
            payload: { src: 'v.mp4', poster: 'p.jpg' },
        });
        expect(normalizeAction({ type: 'link', payload: { url: 'https://x', newTab: false } })).toEqual({
            type: 'link',
            payload: { url: 'https://x', newTab: false },
        });
    });

    it('defaults a missing action to an empty text action (legacy behaviour)', () => {
        expect(normalizeAction(undefined)).toEqual({ type: 'text', payload: { html: '' } });
        expect(normalizeAction({})).toEqual({ type: 'text', payload: { html: '' } });
    });

    it('preserves unknown action types instead of silently converting to text', () => {
        const action = normalizeAction({ type: 'quiz3d', payload: { question: 'why?', points: 3 } });
        expect(action).toEqual({
            type: 'unsupported',
            originalType: 'quiz3d',
            originalPayload: { question: 'why?', points: 3 },
        });
    });

    it('is idempotent over already-normalized unsupported actions', () => {
        const once = normalizeAction({ type: 'quiz3d', payload: { a: 1 } });
        expect(normalizeAction(once)).toEqual(once);
    });

    it('preserves unknown actions even without a payload', () => {
        expect(normalizeAction({ type: 'future' })).toEqual({
            type: 'unsupported',
            originalType: 'future',
            originalPayload: undefined,
        });
    });
});

describe('serializeAction', () => {
    it('round-trips known actions verbatim', () => {
        const link: HotspotAction = { type: 'link', payload: { url: 'https://x', newTab: false } };
        expect(serializeAction(link)).toEqual({ type: 'link', payload: { url: 'https://x', newTab: false } });
    });

    it('writes unsupported actions back in their original wire form (lossless)', () => {
        const wire = { type: 'quiz3d', payload: { question: 'why?', nested: { deep: true } } };
        const normalized = normalizeAction(wire);
        expect(serializeAction(normalized)).toEqual(wire);
    });
});

describe('validateAction', () => {
    const context = { sceneIds: ['s1', 's2'], currentSceneId: 's1' };

    it('goToScene requires an existing scene other than the current one', () => {
        expect(validateAction({ type: 'goToScene', payload: { sceneId: 's2' } }, context)).toEqual([]);
        expect(validateAction({ type: 'goToScene', payload: { sceneId: '' } }, context)).toHaveLength(1);
        expect(validateAction({ type: 'goToScene', payload: { sceneId: 'missing' } }, context)).toHaveLength(1);
        expect(validateAction({ type: 'goToScene', payload: { sceneId: 's1' } }, context)).toHaveLength(1);
    });

    it('link accepts only safe URL schemes', () => {
        expect(validateAction({ type: 'link', payload: { url: 'https://x', newTab: true } }, context)).toEqual([]);
        expect(validateAction({ type: 'link', payload: { url: '', newTab: true } }, context)).toHaveLength(1);
        expect(
            validateAction({ type: 'link', payload: { url: 'javascript:alert(1)', newTab: true } }, context),
        ).toHaveLength(1);
    });

    it('image and video require a source', () => {
        expect(validateAction({ type: 'image', payload: { src: '', alt: '', caption: '' } }, context)).toHaveLength(1);
        expect(validateAction({ type: 'image', payload: { src: 'a.jpg', alt: 'x', caption: '' } }, context)).toEqual([]);
        expect(validateAction({ type: 'video', payload: { src: '', poster: '' } }, context)).toHaveLength(1);
        expect(validateAction({ type: 'video', payload: { src: 'v.mp4', poster: '' } }, context)).toEqual([]);
    });

    it('text and unsupported actions are always acceptable', () => {
        expect(validateAction({ type: 'text', payload: { html: '' } }, context)).toEqual([]);
        expect(
            validateAction({ type: 'unsupported', originalType: 'x', originalPayload: null }, context),
        ).toEqual([]);
    });
});

describe('scene references', () => {
    const ids = createSequentialIdGenerator();
    const document = normalizeDocument(
        {
            startSceneId: 'a',
            scenes: [
                {
                    id: 'a',
                    hotspots: [
                        { id: 'h1', action: { type: 'goToScene', payload: { sceneId: 'b' } } },
                        { id: 'h2', action: { type: 'text', payload: { html: 'x' } } },
                    ],
                },
                { id: 'b', hotspots: [{ id: 'h3', action: { type: 'goToScene', payload: { sceneId: 'b' } } }] },
            ],
        },
        ids,
    );

    it('finds every hotspot referencing a scene, across scenes', () => {
        expect(hotspotsReferencingScene(document, 'b')).toEqual([
            { sceneId: 'a', hotspotId: 'h1' },
            { sceneId: 'b', hotspotId: 'h3' },
        ]);
        expect(hotspotsReferencingScene(document, 'a')).toEqual([]);
    });

    it('repairs references deterministically without mutating input', () => {
        const repaired = repairSceneReferences(document.scenes, 'b', 'a');
        expect(repaired[0]?.hotspots[0]?.action).toEqual({ type: 'goToScene', payload: { sceneId: 'a' } });
        expect(repaired[1]?.hotspots[0]?.action).toEqual({ type: 'goToScene', payload: { sceneId: 'a' } });
        // Non-referencing hotspots are untouched (same object identity).
        expect(repaired[0]?.hotspots[1]).toBe(document.scenes[0]?.hotspots[1]);
        // Original document unchanged.
        expect(document.scenes[0]?.hotspots[0]?.action).toEqual({ type: 'goToScene', payload: { sceneId: 'b' } });
    });

    it('clears references when no replacement is given', () => {
        const repaired = repairSceneReferences(document.scenes, 'b');
        expect(repaired[0]?.hotspots[0]?.action).toEqual({ type: 'goToScene', payload: { sceneId: '' } });
    });
});
