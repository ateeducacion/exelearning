import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from './ids';
import {
    createDefaultBehaviour,
    createDefaultHotspot,
    createDefaultScene,
    findSceneById,
    getStartScene,
    normalizeBehaviour,
    normalizeDocument,
    normalizeHotspot,
    normalizeInitialView,
    normalizeScene,
    resolveStartSceneId,
} from './normalization';

describe('normalizeInitialView', () => {
    it('applies defaults for missing or invalid input', () => {
        expect(normalizeInitialView(undefined)).toEqual({ yaw: 0, pitch: 0, fov: 75 });
        expect(normalizeInitialView('junk')).toEqual({ yaw: 0, pitch: 0, fov: 75 });
        expect(normalizeInitialView({ yaw: 'x', pitch: null, fov: {} })).toEqual({ yaw: 0, pitch: 0, fov: 75 });
    });

    it('clamps every numeric range', () => {
        expect(normalizeInitialView({ yaw: -999, pitch: 999, fov: 5 })).toEqual({ yaw: -180, pitch: 90, fov: 30 });
        expect(normalizeInitialView({ yaw: 999, pitch: -999, fov: 999 })).toEqual({ yaw: 180, pitch: -90, fov: 120 });
    });

    it('parses numeric strings', () => {
        expect(normalizeInitialView({ yaw: '45', pitch: '-10', fov: '90' })).toEqual({ yaw: 45, pitch: -10, fov: 90 });
    });
});

describe('normalizeHotspot', () => {
    const ids = createSequentialIdGenerator();

    it('preserves valid data and generates ids only when missing', () => {
        const hotspot = normalizeHotspot(
            { id: 'keep', label: 'L', icon: 'star', yaw: 20, pitch: -5, x: 10, y: 90, action: { type: 'text', payload: { html: 'x' } } },
            ids,
        );
        expect(hotspot).toEqual({
            id: 'keep',
            label: 'L',
            icon: 'star',
            yaw: 20,
            pitch: -5,
            x: 10,
            y: 90,
            action: { type: 'text', payload: { html: 'x' } },
        });
        expect(normalizeHotspot({}, ids).id).toBe('hs-1');
    });

    it('clamps coordinates and falls back on defaults', () => {
        const hotspot = normalizeHotspot({ yaw: -400, pitch: 400, x: -5, y: 500 }, ids);
        expect(hotspot.yaw).toBe(-180);
        expect(hotspot.pitch).toBe(90);
        expect(hotspot.x).toBe(0);
        expect(hotspot.y).toBe(100);
        expect(hotspot.icon).toBe('circle');
        expect(hotspot.action).toEqual({ type: 'text', payload: { html: '' } });
    });
});

describe('normalizeScene', () => {
    const ids = createSequentialIdGenerator();

    it('keeps valid fields and normalizes hotspots', () => {
        const scene = normalizeScene(
            {
                id: 's1',
                title: 'T',
                src: 'asset://a.jpg',
                alt: 'Alt',
                description: 'D',
                projection: 'flat',
                initialView: { yaw: 10 },
                hotspots: [{ id: 'h', action: { type: 'link', payload: { url: 'https://x' } } }],
            },
            0,
            ids,
        );
        expect(scene.id).toBe('s1');
        expect(scene.projection).toBe('flat');
        expect(scene.initialView).toEqual({ yaw: 10, pitch: 0, fov: 75 });
        expect(scene.hotspots[0]?.action.type).toBe('link');
    });

    it('falls back predictably on invalid enum values and missing ids', () => {
        expect(normalizeScene({ projection: 'cylindrical' }, 2, ids).projection).toBe('equirectangular');
        expect(normalizeScene({}, 2, ids).id).toBe('scene-3');
        expect(normalizeScene(null, 0, ids).hotspots).toEqual([]);
    });
});

describe('normalizeBehaviour', () => {
    it('produces the defaults from empty input', () => {
        expect(normalizeBehaviour(undefined)).toEqual({
            autorotate: { enabled: false, speed: 1 },
            zoomEnabled: true,
            fullscreenEnabled: true,
            showNavControls: true,
            renderQuality: 'high',
            showLabels: true,
            labelPosition: 'right',
            imageAdjustments: { brightness: 1, contrast: 1, saturation: 1 },
        });
        expect(normalizeBehaviour(undefined)).toEqual(createDefaultBehaviour());
    });

    it('clamps ranges and validates enums', () => {
        const behaviour = normalizeBehaviour({
            autorotate: { enabled: 1, speed: 99 },
            renderQuality: 'ultra',
            labelPosition: 'diagonal',
            imageAdjustments: { brightness: 99, contrast: 0, saturation: -1 },
        });
        // Truthy input is coerced like the legacy `!!enabled`.
        expect(behaviour.autorotate).toEqual({ enabled: true, speed: 10 });
        expect(behaviour.renderQuality).toBe('high');
        expect(behaviour.labelPosition).toBe('right');
        expect(behaviour.imageAdjustments).toEqual({ brightness: 3, contrast: 0.1, saturation: 0 });
    });

    it('keeps explicit false toggles', () => {
        const behaviour = normalizeBehaviour({
            zoomEnabled: false,
            fullscreenEnabled: false,
            showNavControls: false,
            showLabels: false,
            renderQuality: 'low',
            labelPosition: 'top',
        });
        expect(behaviour.zoomEnabled).toBe(false);
        expect(behaviour.fullscreenEnabled).toBe(false);
        expect(behaviour.showNavControls).toBe(false);
        expect(behaviour.showLabels).toBe(false);
        expect(behaviour.renderQuality).toBe('low');
        expect(behaviour.labelPosition).toBe('top');
    });
});

describe('resolveStartSceneId / lookups', () => {
    const ids = createSequentialIdGenerator();
    const document = normalizeDocument(
        { startSceneId: 'b', scenes: [{ id: 'a' }, { id: 'b' }] },
        ids,
    );

    it('keeps a valid startSceneId and falls back to the first scene', () => {
        expect(resolveStartSceneId('b', document.scenes)).toBe('b');
        expect(resolveStartSceneId('missing', document.scenes)).toBe('a');
        expect(resolveStartSceneId(undefined, document.scenes)).toBe('a');
        expect(resolveStartSceneId('b', [])).toBe('');
    });

    it('findSceneById / getStartScene resolve scenes', () => {
        expect(findSceneById(document, 'b')?.id).toBe('b');
        expect(findSceneById(document, 'zz')).toBeNull();
        expect(getStartScene(document)?.id).toBe('b');
        expect(getStartScene({ ...document, startSceneId: 'zz' })?.id).toBe('a');
    });
});

describe('normalizeDocument', () => {
    it('always yields at least one scene and a resolved start scene', () => {
        const document = normalizeDocument({}, createSequentialIdGenerator());
        expect(document.version).toBe(2);
        expect(document.scenes).toHaveLength(1);
        expect(document.scenes[0]).toEqual(createDefaultScene('scene-1'));
        expect(document.startSceneId).toBe('scene-1');
    });

    it('preserves ideviceId and is idempotent', () => {
        const input = {
            ideviceId: 'idev-9',
            startSceneId: 's2',
            scenes: [
                { id: 's1', title: 'One', src: 'a.jpg', hotspots: [{ id: 'h1', yaw: 1000 }] },
                { id: 's2', projection: 'flat' },
            ],
            behaviour: { autorotate: { enabled: true, speed: 3 } },
        };
        const ids = createSequentialIdGenerator();
        const once = normalizeDocument(input, ids);
        const twice = normalizeDocument(once, ids);
        expect(once.ideviceId).toBe('idev-9');
        expect(once.startSceneId).toBe('s2');
        expect(twice).toEqual(once);
    });

    it('never mutates its input', () => {
        const input = {
            startSceneId: 'zz',
            scenes: [{ id: 's1', hotspots: [{ yaw: 999, action: { type: 'weird', payload: { a: 1 } } }] }],
            behaviour: { autorotate: { speed: 99 } },
        };
        const snapshot = JSON.parse(JSON.stringify(input));
        normalizeDocument(input, createSequentialIdGenerator());
        expect(input).toEqual(snapshot);
    });

    it('createDefaultHotspot matches the documented defaults', () => {
        expect(createDefaultHotspot('hs-x')).toEqual({
            id: 'hs-x',
            label: '',
            icon: 'circle',
            yaw: 0,
            pitch: 0,
            x: 50,
            y: 50,
            action: { type: 'text', payload: { html: '' } },
        });
    });
});
