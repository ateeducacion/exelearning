import { describe, expect, it } from 'vitest';
import { readFixture, sequentialIds } from '../test/helpers';
import { hydrateDocument, hydrateFromJson, serializeDocument } from './migration';
import { createDefaultDocument } from './schema';
import { SCHEMA_VERSION } from './types';

describe('hydrateDocument — original unversioned content', () => {
    it('migrates the pre-interaction shape straight to schema v2', () => {
        const result = hydrateDocument(readFixture('legacy/unversioned.json'), sequentialIds());
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') {
            return;
        }
        expect(result.document.schemaVersion).toBe(SCHEMA_VERSION);
        expect(result.document.src).toBe('asset://8f3c2a10-0b41-4f0f-9a1c-2b7d5e6f7a90.glb');
        expect(result.document.modelColor).toBe('#aabbcc');
        expect(result.document.animation).toEqual({ enabled: true, name: 'Spin', speed: 1.5 });
    });

    it('gives legacy content a disabled, empty interaction layer so it looks unchanged', () => {
        const result = hydrateDocument(readFixture('legacy/unversioned.json'), sequentialIds());
        expect(result.status === 'ok' && result.document.interaction).toEqual({
            enabled: false,
            guidedMode: false,
            wrapNavigation: false,
            showMarkerLabels: true,
            activeMarkerId: '',
            markers: [],
        });
        expect(result.status === 'ok' && result.document.scorm).toEqual({
            mode: 0,
            weighted: 100,
            saveButtonText: '',
        });
    });

    it('never loses a valid model source', () => {
        for (const src of [
            'asset://a.glb',
            'content/resources/a.stl',
            'https://example.org/a.gltf',
            'file_manager/a.glb',
        ]) {
            const result = hydrateDocument({ src }, sequentialIds());
            expect(result.status === 'ok' && result.document.src).toBe(src);
        }
    });

    it('never persists a blob: or data: model source', () => {
        for (const src of ['blob:http://localhost/abc', 'data:model/gltf+json,{}']) {
            const result = hydrateDocument({ src }, sequentialIds());
            expect(result.status === 'ok' && result.document.src).toBe('');
        }
    });
});

describe('hydrateDocument — schema v2', () => {
    it('normalizes a stored v2 document without changing its meaning', () => {
        const result = hydrateDocument(readFixture('schema-v2/with-markers.json'), sequentialIds());
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') {
            return;
        }
        expect(result.document.interaction.markers.map(marker => marker.id)).toEqual(['marker-summit', 'marker-quiz']);
        expect(result.document.scorm).toEqual({ mode: 1, weighted: 80, saveButtonText: '' });
        // Nav controls win over auto-rotation, as the schema guarantees.
        expect(result.document.autoRotate).toBe(false);
    });

    it('round-trips through serializeDocument without loss', () => {
        const first = hydrateDocument(readFixture('schema-v2/with-markers.json'), sequentialIds());
        expect(first.status).toBe('ok');
        if (first.status !== 'ok') {
            return;
        }
        const serialized = serializeDocument(first.document, sequentialIds());
        const second = hydrateDocument(serialized, sequentialIds());
        expect(second.status === 'ok' && second.document).toEqual(first.document);
    });

    it('is idempotent under repeated normalization', () => {
        const hydrated = hydrateDocument(readFixture('schema-v2/with-markers.json'), sequentialIds());
        expect(hydrated.status).toBe('ok');
        if (hydrated.status !== 'ok') {
            return;
        }
        const once = serializeDocument(hydrated.document, sequentialIds());
        expect(serializeDocument(once, sequentialIds())).toEqual(once);
    });

    it('strips a blob: marker media URL on the way out', () => {
        const result = hydrateDocument(
            {
                schemaVersion: 2,
                src: 'asset://a.glb',
                interaction: {
                    enabled: true,
                    markers: [{ id: 'm1', action: { type: 'image', payload: { src: 'blob:http://x/1' } } }],
                },
            },
            sequentialIds(),
        );
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') {
            return;
        }
        const serialized = serializeDocument(result.document, sequentialIds());
        const action = serialized.interaction.markers[0]?.action;
        expect(action?.type === 'image' && action.payload.src).toBe('');
    });
});

describe('hydrateDocument — version gating', () => {
    it('rejects a future schema version and preserves the original', () => {
        const original = readFixture('schema-v2/future.json');
        const result = hydrateDocument(original, sequentialIds());
        expect(result.status).toBe('unsupported-version');
        if (result.status !== 'unsupported-version') {
            return;
        }
        expect(result.version).toBe(99);
        expect(result.original).toBe(original);
    });

    it('accepts schemaVersion written as a numeric string', () => {
        expect(hydrateDocument({ schemaVersion: '2' }, sequentialIds()).status).toBe('ok');
        expect(hydrateDocument({ schemaVersion: '3' }, sequentialIds()).status).toBe('unsupported-version');
    });

    it('treats an unrecognised version marker as original unversioned content', () => {
        // The unpublished development branch used `version: 2`; there is no
        // migration for it — the field is simply ignored and the shape, which is
        // compatible, is normalized as legacy content.
        const result = hydrateDocument({ version: 2, src: 'asset://a.glb' }, sequentialIds());
        expect(result.status === 'ok' && result.document.schemaVersion).toBe(2);
        expect(
            result.status === 'ok' && (result.document as unknown as Record<string, unknown>).version,
        ).toBeUndefined();
    });

    it('returns the defaults for null, undefined and an empty string', () => {
        for (const input of [null, undefined, '']) {
            const result = hydrateDocument(input, sequentialIds());
            expect(result.status === 'ok' && result.document).toEqual(createDefaultDocument());
        }
    });

    it('reports non-object input as invalid instead of guessing', () => {
        for (const input of ['a string', 42, [1, 2, 3], true]) {
            const result = hydrateDocument(input, sequentialIds());
            expect(result.status).toBe('invalid');
            expect(result.status === 'invalid' && result.original).toBe(input);
        }
    });
});

describe('hydrateFromJson', () => {
    it('parses a JSON string', () => {
        const result = hydrateFromJson('{"schemaVersion":2,"src":"asset://a.glb"}', sequentialIds());
        expect(result.status === 'ok' && result.document.src).toBe('asset://a.glb');
    });

    it('reports malformed JSON as invalid rather than throwing', () => {
        const result = hydrateFromJson('{not json', sequentialIds());
        expect(result.status).toBe('invalid');
        expect(result.status === 'invalid' && result.reason).toBe('malformed JSON');
    });

    it('returns the defaults for an empty string and delegates non-strings', () => {
        expect(hydrateFromJson('   ', sequentialIds()).status).toBe('ok');
        expect(hydrateFromJson({ schemaVersion: 99 }, sequentialIds()).status).toBe('unsupported-version');
    });
});
