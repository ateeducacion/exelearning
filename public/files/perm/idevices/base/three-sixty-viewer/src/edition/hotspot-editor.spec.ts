import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import type { Hotspot } from '../shared/types';
import { actionTypeLabel, actionTypeOptionsHtml, payloadInputsHtml } from './hotspot-editor';
import { createDefaultHotspot } from '../shared/normalization';
import { createEditorState } from './state';

const identity = (text: string): string => text;

function makeState() {
    const result = hydrateDocument(
        { version: 2, scenes: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] },
        createSequentialIdGenerator(),
    );
    if (result.status !== 'ok') throw new Error('fixture');
    return createEditorState(result.document, createSequentialIdGenerator());
}

function hotspotWith(action: Hotspot['action']): Hotspot {
    return { ...createDefaultHotspot('h'), action };
}

describe('actionTypeLabel', () => {
    it('labels every known type and echoes unknown ones', () => {
        expect(actionTypeLabel('goToScene', identity)).toBe('Go to scene');
        expect(actionTypeLabel('text', identity)).toBe('Text');
        expect(actionTypeLabel('image', identity)).toBe('Image');
        expect(actionTypeLabel('video', identity)).toBe('Video');
        expect(actionTypeLabel('link', identity)).toBe('External link');
        expect(actionTypeLabel('quiz3d', identity)).toBe('quiz3d');
    });
});

describe('actionTypeOptionsHtml', () => {
    it('marks the current type selected', () => {
        const html = actionTypeOptionsHtml(hotspotWith({ type: 'video', payload: { src: '', poster: '' } }), identity);
        expect(html).toContain('<option value="video" selected>');
        expect(html).not.toContain('unsupported');
    });

    it('adds a disabled option that names an unsupported original type', () => {
        const html = actionTypeOptionsHtml(
            hotspotWith({ type: 'unsupported', originalType: 'quiz3d', originalPayload: null }),
            identity,
        );
        expect(html).toContain('selected disabled');
        expect(html).toContain('quiz3d');
    });
});

describe('payloadInputsHtml', () => {
    it('renders scene options for goToScene with the current target selected', () => {
        const state = makeState();
        const html = payloadInputsHtml(
            state,
            hotspotWith({ type: 'goToScene', payload: { sceneId: 'b' } }),
            0,
            identity,
        );
        expect(html).toContain('hotspot-payload-sceneId');
        expect(html).toContain('<option value="b" selected>');
    });

    it('escapes payload values in every editor', () => {
        const state = makeState();
        const html = payloadInputsHtml(
            state,
            hotspotWith({ type: 'image', payload: { src: '"><img>', alt: '<b>', caption: '' } }),
            0,
            identity,
        );
        expect(html).not.toContain('"><img>');
        expect(html).toContain('&quot;&gt;&lt;img&gt;');
    });

    it('shows an inline alert for the field a validation issue points at', () => {
        const state = makeState();
        state.addHotspot({ yaw: 0, pitch: 0 }, 'H');
        state.setHotspotActionType(0, 'goToScene');
        const html = payloadInputsHtml(state, state.hotspotAt(0) as Hotspot, 0, identity);
        expect(html).toContain('hotspot-field-error');
        expect(html).toContain('Select a target scene.');
    });

    it('explains unsupported payloads instead of rendering inputs', () => {
        const state = makeState();
        const html = payloadInputsHtml(
            state,
            hotspotWith({ type: 'unsupported', originalType: 'x', originalPayload: { a: 1 } }),
            0,
            identity,
        );
        expect(html).toContain('newer eXeLearning version');
        expect(html).not.toContain('<input');
    });
});
