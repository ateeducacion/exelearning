import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from './ids';
import {
    createDefaultDocument,
    detectDocumentVersion,
    hydrateDocument,
    parseDocumentSource,
    serializeDocument,
} from './schema';
import type { ThreeSixtyDocumentV2 } from './types';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');

function fixture(name: string): unknown {
    return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

function fixtureText(name: string): string {
    return readFileSync(join(fixturesDir, name), 'utf-8');
}

function hydrated(input: unknown): ThreeSixtyDocumentV2 {
    const result = hydrateDocument(input, createSequentialIdGenerator());
    if (result.status !== 'ok') throw new Error(`expected ok, got ${result.status}`);
    return result.document;
}

describe('parseDocumentSource', () => {
    it('passes objects through and parses JSON strings', () => {
        expect(parseDocumentSource({ a: 1 })).toEqual({ value: { a: 1 } });
        expect(parseDocumentSource('{"a":1}')).toEqual({ value: { a: 1 } });
        expect(parseDocumentSource('   ')).toEqual({ value: null });
        expect(parseDocumentSource(null)).toEqual({ value: null });
    });

    it('reports JSON errors instead of throwing', () => {
        const parsed = parseDocumentSource('{oops');
        expect('error' in parsed).toBe(true);
    });
});

describe('detectDocumentVersion', () => {
    it('reads a finite numeric version and nothing else', () => {
        expect(detectDocumentVersion({ version: 2 })).toBe(2);
        expect(detectDocumentVersion({ version: 3.5 })).toBe(3.5);
        expect(detectDocumentVersion({ version: '2' })).toBeNull();
        expect(detectDocumentVersion({})).toBeNull();
        expect(detectDocumentVersion([])).toBeNull();
        expect(detectDocumentVersion('x')).toBeNull();
    });
});

describe('hydrateDocument — empty and default input', () => {
    it('produces a valid default v2 document from empty input', () => {
        for (const input of [undefined, null, {}, '']) {
            const result = hydrateDocument(input, createSequentialIdGenerator());
            expect(result.status).toBe('ok');
            if (result.status !== 'ok') continue;
            expect(result.migrated).toBe(false);
            expect(result.document.version).toBe(2);
            expect(result.document.scenes).toHaveLength(1);
            expect(result.document.startSceneId).toBe('scene-1');
        }
    });

    it('createDefaultDocument matches the hydrated empty document', () => {
        expect(createDefaultDocument(createSequentialIdGenerator())).toEqual(hydrated(null));
    });
});

describe('hydrateDocument — v1 migration', () => {
    it('migrates the full v1 fixture, preserving src/alt/view/behaviour', () => {
        const result = hydrateDocument(fixture('version-1/full.json'), createSequentialIdGenerator());
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.migrated).toBe(true);
        const document = result.document;
        expect(document.ideviceId).toBe('idev-v1-full');
        expect(document.scenes).toHaveLength(1);
        expect(document.scenes[0]).toMatchObject({
            id: 'scene-1',
            src: 'asset://panoramas/plaza.jpg',
            alt: 'Main square panorama',
            projection: 'equirectangular',
            initialView: { yaw: 30, pitch: 10, fov: 80 },
        });
        expect(document.behaviour.autorotate).toEqual({ enabled: true, speed: 2 });
        expect(document.behaviour.zoomEnabled).toBe(false);
        expect(document.behaviour.fullscreenEnabled).toBe(true);
        expect(document.behaviour.showNavControls).toBe(false);
        expect(document.startSceneId).toBe('scene-1');
    });

    it('migrates a minimal v1 fixture with defaults everywhere else', () => {
        const result = hydrateDocument(fixture('version-1/minimal.json'), createSequentialIdGenerator());
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.migrated).toBe(true);
        expect(result.document.scenes[0]).toMatchObject({
            src: 'asset://panoramas/street.jpg',
            alt: '',
            initialView: { yaw: 0, pitch: 0, fov: 75 },
        });
        expect(result.document.behaviour.zoomEnabled).toBe(true);
    });

    it('accepts a v1 document serialized as a JSON string', () => {
        const result = hydrateDocument(fixtureText('version-1/full.json'), createSequentialIdGenerator());
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.migrated).toBe(true);
    });
});

describe('hydrateDocument — v2', () => {
    it('preserves every field of a valid v2 tour and does not mark it migrated', () => {
        const result = hydrateDocument(fixture('version-2/tour.json'), createSequentialIdGenerator());
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.migrated).toBe(false);
        const document = result.document;
        expect(document.ideviceId).toBe('idev-v2-tour');
        expect(document.startSceneId).toBe('scene-hall');
        expect(document.scenes.map(scene => scene.id)).toEqual(['scene-hall', 'scene-patio']);
        expect(document.scenes[1]?.projection).toBe('flat');
        expect(document.scenes[0]?.hotspots[0]?.action).toEqual({
            type: 'goToScene',
            payload: { sceneId: 'scene-patio' },
        });
        expect(document.scenes[1]?.hotspots.map(hotspot => hotspot.action.type)).toEqual(['image', 'video', 'link']);
        expect(document.behaviour.renderQuality).toBe('medium');
        expect(document.behaviour.labelPosition).toBe('left');
        expect(document.behaviour.imageAdjustments).toEqual({ brightness: 1.2, contrast: 0.9, saturation: 1.1 });
    });

    it('hydration + serialization round-trips the tour fixture unchanged', () => {
        const raw = fixture('version-2/tour.json');
        expect(serializeDocument(hydrated(raw))).toEqual(raw);
    });

    it('is idempotent: hydrating a hydrated document changes nothing', () => {
        const once = hydrated(fixture('version-2/tour.json'));
        expect(hydrated(serializeDocument(once))).toEqual(once);
    });

    it('resolves an invalid startSceneId to the first scene', () => {
        const document = hydrated({ version: 2, startSceneId: 'nope', scenes: [{ id: 'a' }, { id: 'b' }] });
        expect(document.startSceneId).toBe('a');
    });

    it('preserves unsupported hotspot actions through hydrate + serialize', () => {
        const raw = fixture('version-2/with-unknown-action.json');
        const document = hydrated(raw);
        const action = document.scenes[0]?.hotspots[0]?.action;
        expect(action?.type).toBe('unsupported');
        if (action?.type !== 'unsupported') return;
        expect(action.originalType).toBe('quiz3d');
        expect(action.originalPayload).toEqual({ question: 'Why?', options: ['a', 'b'], nested: { deep: true } });
        const serialized = serializeDocument(document) as {
            scenes: Array<{ hotspots: Array<{ action: unknown }> }>;
        };
        expect(serialized.scenes[0]?.hotspots[0]?.action).toEqual({
            type: 'quiz3d',
            payload: { question: 'Why?', options: ['a', 'b'], nested: { deep: true } },
        });
    });

    it('never mutates its input', () => {
        const raw = fixture('version-2/tour.json');
        const snapshot = JSON.parse(JSON.stringify(raw));
        hydrateDocument(raw, createSequentialIdGenerator());
        expect(raw).toEqual(snapshot);
    });
});

describe('hydrateDocument — future versions and invalid input', () => {
    it('rejects version > 2 without rewriting the payload', () => {
        const raw = fixture('invalid/future-version.json');
        const snapshot = JSON.parse(JSON.stringify(raw));
        const result = hydrateDocument(raw, createSequentialIdGenerator());
        expect(result.status).toBe('unsupported-version');
        if (result.status !== 'unsupported-version') return;
        expect(result.version).toBe(3);
        // The original payload is exposed intact — nothing was normalized away.
        expect(result.original).toEqual(snapshot);
        expect(result.original).toBe(raw);
    });

    it('rejects fractional future versions too', () => {
        const result = hydrateDocument({ version: 2.5, scenes: [] }, createSequentialIdGenerator());
        expect(result.status).toBe('unsupported-version');
    });

    it('fails safely on unparseable JSON strings', () => {
        const broken = fixtureText('invalid/broken.json.txt');
        const result = hydrateDocument(broken, createSequentialIdGenerator());
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('JSON');
        expect(result.original).toBe(broken);
    });

    it('fails safely on non-object primitives and arrays', () => {
        expect(hydrateDocument(42, createSequentialIdGenerator()).status).toBe('invalid');
        expect(hydrateDocument(true, createSequentialIdGenerator()).status).toBe('invalid');
        expect(hydrateDocument([1, 2], createSequentialIdGenerator()).status).toBe('invalid');
    });

    it('treats version 2 without scenes as an empty document, keeping ideviceId', () => {
        const result = hydrateDocument({ version: 2, ideviceId: 'kept' }, createSequentialIdGenerator());
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.document.ideviceId).toBe('kept');
        expect(result.document.scenes).toHaveLength(1);
    });
});
