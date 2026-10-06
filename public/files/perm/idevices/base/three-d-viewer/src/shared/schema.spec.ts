import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../test/helpers';
import {
    createDefaultDocument,
    defaultIdFactory,
    normalizeAction,
    normalizeAnchor,
    normalizeAnimation,
    normalizeCamera,
    normalizeDocument,
    normalizeInteraction,
    normalizeMarker,
    normalizeQuestion,
    normalizeScorm,
    normalizeVector3,
} from './schema';

describe('normalizeVector3 / normalizeAnchor / normalizeCamera', () => {
    it('coerces components with a numeric fallback', () => {
        expect(normalizeVector3({ x: '1.5', y: null, z: 3 }, { x: 0, y: 9, z: 0 })).toEqual({ x: 1.5, y: 9, z: 3 });
    });

    it('defaults an anchor to the origin with an up-facing normal', () => {
        expect(normalizeAnchor(undefined)).toEqual({
            position: { x: 0, y: 0, z: 0 },
            normal: { x: 0, y: 1, z: 0 },
            surface: '',
        });
    });

    it('keeps a surface hint and coerces camera fields to strings', () => {
        expect(normalizeAnchor({ surface: 'front' }).surface).toBe('front');
        expect(normalizeCamera({ orbit: 1, target: 'a', fieldOfView: null })).toEqual({
            orbit: '',
            target: 'a',
            fieldOfView: '',
        });
    });
});

describe('normalizeQuestion', () => {
    it('provides two placeholder options when none are supplied', () => {
        const question = normalizeQuestion({}, sequentialIds());
        expect(question.options).toHaveLength(2);
        expect(question.options[0]?.correct).toBe(true);
        expect(question.options[1]?.correct).toBe(false);
    });

    it('forces exactly one correct option — the first flagged wins', () => {
        const question = normalizeQuestion(
            { options: [{ text: 'a', correct: true }, { text: 'b', correct: true }, { text: 'c' }] },
            sequentialIds(),
        );
        expect(question.options.map(option => option.correct)).toEqual([true, false, false]);
    });

    it('marks the first option correct when none is', () => {
        const question = normalizeQuestion({ options: [{ text: 'a' }, { text: 'b' }] }, sequentialIds());
        expect(question.options[0]?.correct).toBe(true);
    });

    it('clamps attemptsAllowed to whole numbers in [0, 20]', () => {
        expect(normalizeQuestion({ attemptsAllowed: -3 }, sequentialIds()).attemptsAllowed).toBe(0);
        expect(normalizeQuestion({ attemptsAllowed: 999 }, sequentialIds()).attemptsAllowed).toBe(20);
        expect(normalizeQuestion({ attemptsAllowed: 2.6 }, sequentialIds()).attemptsAllowed).toBe(3);
    });

    it('caps stored options at ten', () => {
        const options = Array.from({ length: 15 }, (_, index) => ({ text: `option ${index}` }));
        expect(normalizeQuestion({ options }, sequentialIds()).options).toHaveLength(10);
    });

    it('preserves existing option ids and creates ids for new options', () => {
        const question = normalizeQuestion({ options: [{ id: 'keep-me', text: 'a' }, { text: 'b' }] }, sequentialIds());
        expect(question.options[0]?.id).toBe('keep-me');
        expect(question.options[1]?.id).toBe('option-1');
    });
});

describe('normalizeAction', () => {
    it('defaults an unknown action type to information, keeping its payload', () => {
        const action = normalizeAction({ type: 'explode', payload: { html: '<b>x</b>' } }, sequentialIds());
        expect(action.type).toBe('information');
        expect(action.payload).toEqual({ html: '<b>x</b>' });
    });

    it('drops payload fields that do not belong to the resolved action type', () => {
        const action = normalizeAction({ type: 'information', payload: { html: 'a', url: 'b' } }, sequentialIds());
        expect(action.payload).toEqual({ html: 'a' });
    });

    it('strips blob: and data: URLs from image and video payloads', () => {
        const image = normalizeAction(
            { type: 'image', payload: { src: 'blob:http://x/1', alt: 'a' } },
            sequentialIds(),
        );
        expect(image.type === 'image' && image.payload.src).toBe('');
        const video = normalizeAction(
            { type: 'video', payload: { src: 'data:video/mp4;base64,AA', poster: 'poster.png' } },
            sequentialIds(),
        );
        expect(video.type === 'video' && video.payload).toEqual({ src: '', poster: 'poster.png' });
    });

    it('keeps asset:// media and defaults link newTab to true', () => {
        const image = normalizeAction({ type: 'image', payload: { src: 'asset://a.png' } }, sequentialIds());
        expect(image.type === 'image' && image.payload.src).toBe('asset://a.png');
        const link = normalizeAction({ type: 'link', payload: { url: 'https://example.org' } }, sequentialIds());
        expect(link.type === 'link' && link.payload).toEqual({ url: 'https://example.org', newTab: true });
    });

    it('strips executable schemes from link URLs at normalize time', () => {
        for (const url of ['javascript:alert(1)', ' vbscript:msgbox', 'JavaScript:alert(1)']) {
            const link = normalizeAction({ type: 'link', payload: { url } }, sequentialIds());
            expect(link.type === 'link' && link.payload.url).toBe('');
        }
    });

    it('normalizes a question payload through normalizeQuestion', () => {
        const action = normalizeAction({ type: 'question', payload: { prompt: 'Q?' } }, sequentialIds());
        expect(action.type).toBe('question');
        expect(action.type === 'question' && action.payload.type).toBe('single-choice');
    });
});

describe('normalizeMarker', () => {
    it('creates an id, defaults the icon and falls back to the array index', () => {
        const marker = normalizeMarker({}, 4, sequentialIds());
        expect(marker.id).toBe('marker-1');
        expect(marker.icon).toBe('circle');
        expect(marker.order).toBe(4);
    });

    it('preserves an existing id and clamps an invalid icon', () => {
        const marker = normalizeMarker({ id: 'marker-x', icon: 'rocket' }, 0, sequentialIds());
        expect(marker.id).toBe('marker-x');
        expect(marker.icon).toBe('circle');
    });
});

describe('normalizeInteraction', () => {
    it('returns a disabled, empty interaction for undefined and for garbage', () => {
        for (const input of [undefined, null, 'nope', 42, []]) {
            const interaction = normalizeInteraction(input, sequentialIds());
            expect(interaction.enabled).toBe(false);
            expect(interaction.markers).toEqual([]);
            expect(interaction.showMarkerLabels).toBe(true);
        }
    });

    it('coerces the boolean flags', () => {
        const interaction = normalizeInteraction(
            { enabled: 1, guidedMode: 'yes', wrapNavigation: 0, showMarkerLabels: false },
            sequentialIds(),
        );
        expect(interaction).toMatchObject({
            enabled: true,
            guidedMode: true,
            wrapNavigation: false,
            showMarkerLabels: false,
        });
    });

    it('sorts markers by order and re-indexes them contiguously', () => {
        const interaction = normalizeInteraction(
            {
                markers: [
                    { id: 'b', order: 5 },
                    { id: 'a', order: 1 },
                    { id: 'c', order: 3 },
                ],
            },
            sequentialIds(),
        );
        expect(interaction.markers.map(marker => marker.id)).toEqual(['a', 'c', 'b']);
        expect(interaction.markers.map(marker => marker.order)).toEqual([0, 1, 2]);
    });

    it('keeps activeMarkerId only when it points at an existing marker', () => {
        expect(
            normalizeInteraction({ markers: [{ id: 'a' }], activeMarkerId: 'a' }, sequentialIds()).activeMarkerId,
        ).toBe('a');
        expect(
            normalizeInteraction({ markers: [{ id: 'a' }], activeMarkerId: 'zzz' }, sequentialIds()).activeMarkerId,
        ).toBe('');
    });

    it('is idempotent', () => {
        const once = normalizeInteraction(
            { enabled: true, markers: [{ id: 'a', action: { type: 'question', payload: {} } }] },
            sequentialIds(),
        );
        expect(normalizeInteraction(once, sequentialIds())).toEqual(once);
    });
});

describe('normalizeAnimation', () => {
    it('clamps the speed into [0.1, 3] and defaults to 1', () => {
        expect(normalizeAnimation({ speed: 99 }).speed).toBe(3);
        expect(normalizeAnimation({ speed: 0 }).speed).toBe(0.1);
        expect(normalizeAnimation({}).speed).toBe(1);
    });
});

describe('normalizeScorm', () => {
    it('defaults to disabled scoring', () => {
        expect(normalizeScorm(undefined)).toEqual({ mode: 0, weighted: 100, saveButtonText: '' });
    });

    it('clamps the mode to 0..2 and the weight to 1..100', () => {
        expect(normalizeScorm({ mode: 7, weighted: 500 })).toMatchObject({ mode: 2, weighted: 100 });
        expect(normalizeScorm({ mode: -4, weighted: 0 })).toMatchObject({ mode: 0, weighted: 1 });
    });

    it('accepts the gamification framework vocabulary', () => {
        expect(normalizeScorm({ isScorm: 2, weighted: 60, textButtonScorm: 'Send' })).toEqual({
            mode: 2,
            weighted: 60,
            saveButtonText: 'Send',
        });
    });
});

describe('normalizeDocument', () => {
    it('produces the defaults for an empty input', () => {
        expect(normalizeDocument({}, sequentialIds())).toEqual(createDefaultDocument());
    });

    it('drops blob: and data: model sources', () => {
        expect(normalizeDocument({ src: 'blob:http://x/1' }, sequentialIds()).src).toBe('');
        expect(normalizeDocument({ src: 'data:model/gltf+json,{}' }, sequentialIds()).src).toBe('');
    });

    it('normalizes colours to lowercase six-digit hex', () => {
        const document = normalizeDocument({ modelColor: '#ABC', backgroundColor: 'rebeccapurple' }, sequentialIds());
        expect(document.modelColor).toBe('#aabbcc');
        expect(document.backgroundColor).toBe('#f5f5f5');
    });

    it('lets nav controls win over auto-rotation', () => {
        const document = normalizeDocument({ showNavControls: true, autoRotate: true }, sequentialIds());
        expect(document.autoRotate).toBe(false);
    });

    it('clamps the auto-rotate speed to the control range', () => {
        expect(normalizeDocument({ autoRotateSpeed: 900 }, sequentialIds()).autoRotateSpeed).toBe(90);
        expect(normalizeDocument({ autoRotateSpeed: 0 }, sequentialIds()).autoRotateSpeed).toBe(1);
    });

    it('reads SCORM from the nested block or from the legacy flat fields', () => {
        expect(normalizeDocument({ scorm: { mode: 2 } }, sequentialIds()).scorm.mode).toBe(2);
        expect(normalizeDocument({ isScorm: 1, weighted: 50 }, sequentialIds()).scorm).toMatchObject({
            mode: 1,
            weighted: 50,
        });
    });

    it('is idempotent', () => {
        const once = normalizeDocument(
            { src: 'asset://a.stl', interaction: { enabled: true, markers: [{ id: 'a' }] } },
            sequentialIds(),
        );
        expect(normalizeDocument(once, sequentialIds())).toEqual(once);
    });
});

describe('defaultIdFactory', () => {
    it('prefixes the generated id and does not repeat itself', () => {
        const first = defaultIdFactory('marker');
        const second = defaultIdFactory('marker');
        expect(first.startsWith('marker-')).toBe(true);
        expect(first).not.toBe(second);
    });
});
