import { describe, expect, it } from 'vitest';
import { isV1Document, migrateV1ToV2 } from './migration';

describe('isV1Document', () => {
    it('detects each v1 marker field', () => {
        expect(isV1Document({ src: 'a.jpg' })).toBe(true);
        expect(isV1Document({ alt: 'text' })).toBe(true);
        expect(isV1Document({ initialView: { yaw: 1 } })).toBe(true);
        expect(isV1Document({ autorotate: { enabled: true } })).toBe(true);
        expect(isV1Document({ zoomEnabled: false })).toBe(true);
        expect(isV1Document({ fullscreenEnabled: true })).toBe(true);
    });

    it('rejects empty and non-v1 input', () => {
        expect(isV1Document({})).toBe(false);
        expect(isV1Document(null)).toBe(false);
        expect(isV1Document(undefined)).toBe(false);
        expect(isV1Document({ version: 2, scenes: [] })).toBe(false);
        expect(isV1Document('src')).toBe(false);
    });
});

describe('migrateV1ToV2', () => {
    it('lifts src, alt and initial view into a single scene-1', () => {
        const parts = migrateV1ToV2({
            src: 'asset://pano.jpg',
            alt: 'A scene',
            initialView: { yaw: 30, pitch: 10, fov: 80 },
        });
        expect(parts.startSceneId).toBe('scene-1');
        expect(parts.scenes).toHaveLength(1);
        expect(parts.scenes[0]).toMatchObject({
            id: 'scene-1',
            src: 'asset://pano.jpg',
            alt: 'A scene',
            projection: 'equirectangular',
            initialView: { yaw: 30, pitch: 10, fov: 80 },
            hotspots: [],
        });
    });

    it('carries the behaviour toggles through untouched', () => {
        const parts = migrateV1ToV2({
            src: 'x.jpg',
            autorotate: { enabled: true, speed: 2 },
            zoomEnabled: false,
            fullscreenEnabled: true,
            showNavControls: false,
        });
        expect(parts.behaviour).toEqual({
            autorotate: { enabled: true, speed: 2 },
            zoomEnabled: false,
            fullscreenEnabled: true,
            showNavControls: false,
        });
    });

    it('handles partial v1 documents', () => {
        const parts = migrateV1ToV2({ alt: 'only alt' });
        expect(parts.scenes[0]).toMatchObject({ src: '', alt: 'only alt', initialView: { yaw: 0, pitch: 0, fov: 75 } });
        expect(parts.behaviour).toMatchObject({ autorotate: {} });
    });
});
