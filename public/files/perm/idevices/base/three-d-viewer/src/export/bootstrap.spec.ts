import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWebGLProbe } from '../interactions/fallback';
import { publishViewerRuntime } from '../runtime/viewer-runtime';
import { createStubInstance, createWrapper, flush, resetDom } from '../test/helpers';
import { createModelViewerStub } from '../test/model-viewer-stub';
import { installThreeStub } from '../test/three-stub';
import {
    attachInteractionLayer,
    bootWrappers,
    findWrappers,
    migrateLegacyConfig,
    parseInteractionData,
    resolveBootConfig,
    stripStlModelViewerSrc,
} from './bootstrap';

let restoreThree: () => void;

// Register a stand-in element so `ensureModelViewerLoaded` resolves; happy-dom
// never upgrades the real one (it needs WebGL).
if (!customElements.get('model-viewer')) {
    customElements.define('model-viewer', class extends HTMLElement {});
}

beforeEach(() => {
    restoreThree = installThreeStub();
    globalThis.__tdvForceWebGL = true;
    resetWebGLProbe();
});

afterEach(() => {
    restoreThree();
    globalThis.__tdvForceWebGL = undefined;
    globalThis.eXe3DViewer = undefined;
    globalThis.eXeLearning = undefined;
    globalThis.$exeLibs = undefined;
    resetWebGLProbe();
    resetDom();
    vi.restoreAllMocks();
});

function base64(value: string): string {
    return btoa(unescape(encodeURIComponent(value)));
}

describe('migrateLegacyConfig', () => {
    it('copies the base64 data-config payload into the flat attributes', () => {
        const wrapper = createWrapper();
        wrapper.setAttribute(
            'data-config',
            base64(
                JSON.stringify({
                    src: 'asset://a.stl',
                    alt: 'Cube',
                    backgroundColor: '#ffffff',
                    cameraControls: false,
                    autoRotate: true,
                    autoRotateSpeed: 45,
                    showNavControls: true,
                    animation: { enabled: true, name: 'Spin', speed: 2 },
                }),
            ),
        );
        migrateLegacyConfig(wrapper);

        expect(wrapper.dataset.modelSrc).toBe('asset://a.stl');
        expect(wrapper.dataset.alt).toBe('Cube');
        expect(wrapper.dataset.cameraControls).toBe('false');
        expect(wrapper.dataset.autoRotate).toBe('true');
        expect(wrapper.dataset.showNavControls).toBe('true');
        expect(wrapper.dataset.animationEnabled).toBe('true');
        expect(wrapper.dataset.animationName).toBe('Spin');
        expect(wrapper.dataset.modelType).toBe('stl');
        expect(wrapper.dataset.modelColor).toBe('#888888');
        expect(wrapper.hasAttribute('data-config')).toBe(false);
    });

    it('accepts a plain-JSON data-config as well', () => {
        const wrapper = createWrapper();
        wrapper.setAttribute('data-config', JSON.stringify({ src: 'a.glb' }));
        migrateLegacyConfig(wrapper);
        expect(wrapper.dataset.modelSrc).toBe('a.glb');
    });

    it('never overwrites an attribute the new format already set', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'asset://new.glb';
        wrapper.setAttribute('data-config', base64(JSON.stringify({ src: 'asset://old.glb' })));
        migrateLegacyConfig(wrapper);
        expect(wrapper.dataset.modelSrc).toBe('asset://new.glb');
    });

    it('is a no-op for a wrapper already in the new format, and for garbage', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'a.glb';
        migrateLegacyConfig(wrapper);
        expect(wrapper.dataset.modelType).toBeUndefined();

        wrapper.setAttribute('data-config', 'not-base64-or-json');
        expect(() => migrateLegacyConfig(wrapper)).not.toThrow();
        expect(wrapper.hasAttribute('data-config')).toBe(false);
    });
});

describe('resolveBootConfig', () => {
    it('reads the flat attributes', () => {
        const wrapper = createWrapper();
        Object.assign(wrapper.dataset, {
            modelSrc: 'content/resources/a.stl',
            modelType: 'stl',
            modelColor: '#ABCDEF',
            backgroundColor: '#000',
            alt: 'Cube',
            cameraControls: 'false',
            autoRotate: 'true',
            autoRotateSpeed: '45',
            showNavControls: 'false',
            animationEnabled: 'true',
            animationName: 'Spin',
            animationSpeed: '2',
        });
        expect(resolveBootConfig(wrapper)).toEqual({
            src: 'content/resources/a.stl',
            type: 'stl',
            alt: 'Cube',
            modelColor: '#abcdef',
            backgroundColor: '#000000',
            cameraControls: false,
            autoRotate: true,
            autoRotateSpeed: 45,
            showNavControls: false,
            animation: { enabled: true, name: 'Spin', speed: 2 },
        });
    });

    it('applies the defaults when the attributes are missing', () => {
        const wrapper = createWrapper();
        expect(resolveBootConfig(wrapper)).toMatchObject({
            src: '',
            cameraControls: true,
            autoRotate: true,
            autoRotateSpeed: 30,
            showNavControls: false,
        });
    });

    it('lets nav controls win over auto-rotation', () => {
        const wrapper = createWrapper();
        wrapper.dataset.showNavControls = 'true';
        wrapper.dataset.autoRotate = 'true';
        expect(resolveBootConfig(wrapper).autoRotate).toBe(false);
    });

    it('prefers the asset reference when AssetManager is live', () => {
        globalThis.eXeLearning = { app: { project: { assetManager: {} } } };
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'content/resources/uuid.glb';
        wrapper.dataset.modelAssetRef = 'uuid.glb';
        expect(resolveBootConfig(wrapper).src).toBe('asset://uuid.glb');
    });

    it('uses the rewritten path in an export, where there is no AssetManager', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'content/resources/uuid.glb';
        wrapper.dataset.modelAssetRef = 'uuid.glb';
        expect(resolveBootConfig(wrapper).src).toBe('content/resources/uuid.glb');
    });

    it('rejects a data: source but keeps a live blob: one', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'data:model/gltf+json,{}';
        expect(resolveBootConfig(wrapper).src).toBe('');
        wrapper.dataset.modelSrc = 'blob:http://localhost/1';
        expect(resolveBootConfig(wrapper).src).toBe('blob:http://localhost/1');
    });
});

describe('stripStlModelViewerSrc', () => {
    it('removes a stale src from an STL wrapper before model-viewer upgrades', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelType = 'stl';
        const modelViewer = createModelViewerStub(wrapper);
        modelViewer.setAttribute('src', 'content/resources/a.stl');
        stripStlModelViewerSrc(wrapper);
        expect(modelViewer.hasAttribute('src')).toBe(false);
    });

    it('detects STL from the source when the type attribute is missing', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'content/resources/a.stl';
        const modelViewer = createModelViewerStub(wrapper);
        modelViewer.setAttribute('src', 'anything');
        stripStlModelViewerSrc(wrapper);
        expect(modelViewer.hasAttribute('src')).toBe(false);
    });

    it('leaves a GLB wrapper alone, and tolerates a wrapper without model-viewer', () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelType = 'glb';
        const modelViewer = createModelViewerStub(wrapper);
        modelViewer.setAttribute('src', 'a.glb');
        stripStlModelViewerSrc(wrapper);
        expect(modelViewer.getAttribute('src')).toBe('a.glb');
        expect(() => stripStlModelViewerSrc(createWrapper('empty'))).not.toThrow();
    });
});

describe('parseInteractionData', () => {
    it('parses the JSON block', () => {
        const wrapper = createWrapper();
        wrapper.innerHTML = '<script type="application/json" class="tdv-interaction-data">{"enabled":true}</script>';
        expect(parseInteractionData(wrapper)).toEqual({ enabled: true });
    });

    it('returns null when the block is missing or malformed', () => {
        expect(parseInteractionData(createWrapper('a'))).toBeNull();
        const broken = createWrapper('b');
        broken.innerHTML = '<script type="application/json" class="tdv-interaction-data">{oops</script>';
        expect(parseInteractionData(broken)).toBeNull();
    });
});

describe('findWrappers', () => {
    it('finds every wrapper in the document', () => {
        createWrapper('one');
        createWrapper('two');
        expect(findWrappers('')).toHaveLength(2);
    });

    it('scopes to the iDevice node when one matches', () => {
        const node = document.createElement('div');
        node.className = 'idevice_node three-d-viewer';
        node.id = 'idev-1';
        document.body.appendChild(node);
        const scoped = createWrapper('scoped');
        node.appendChild(scoped);
        createWrapper('outside');
        expect(findWrappers('idev-1')).toEqual([scoped]);
    });

    it('falls back to the whole document when the scope holds no wrapper', () => {
        const node = document.createElement('div');
        node.className = 'idevice_node three-d-viewer';
        node.id = 'idev-1';
        document.body.appendChild(node);
        const outside = createWrapper('outside');
        expect(findWrappers('idev-1')).toEqual([outside]);
    });
});

describe('attachInteractionLayer', () => {
    function withInteraction(wrapper: HTMLElement, payload: Record<string, unknown>): void {
        const script = document.createElement('script');
        script.type = 'application/json';
        script.className = 'tdv-interaction-data';
        script.textContent = JSON.stringify(payload);
        wrapper.appendChild(script);
    }

    it('creates the layer for a GLB wrapper', async () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelType = 'glb';
        createModelViewerStub(wrapper);
        withInteraction(wrapper, { enabled: true, markers: [{ id: 'm1', label: 'One' }] });

        await attachInteractionLayer(wrapper);
        expect(wrapper.querySelector('.tdv-marker')?.getAttribute('aria-label')).toBe('One');
        expect(wrapper.dataset.tdvInteractionBooted).toBe('1');
    });

    it('uses the baked i18n map for learner strings', async () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelType = 'glb';
        createModelViewerStub(wrapper);
        withInteraction(wrapper, { enabled: true, markers: [{ id: 'm1' }], i18n: { Marker: 'Marcador' } });
        await attachInteractionLayer(wrapper);
        expect(wrapper.querySelector('.tdv-marker')?.getAttribute('aria-label')).toBe('Marcador 1');
    });

    it('is idempotent and skips a disabled or missing block', async () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelType = 'glb';
        createModelViewerStub(wrapper);
        withInteraction(wrapper, { enabled: true, markers: [{ id: 'm1' }] });
        await attachInteractionLayer(wrapper);
        await attachInteractionLayer(wrapper);
        expect(wrapper.querySelectorAll('.tdv-marker')).toHaveLength(1);

        const disabled = createWrapper('disabled');
        withInteraction(disabled, { enabled: false });
        await attachInteractionLayer(disabled);
        expect(disabled.dataset.tdvInteractionBooted).toBeUndefined();
    });

    it('attaches to a booted STL instance', async () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelType = 'stl';
        withInteraction(wrapper, { enabled: true, markers: [{ id: 'm1', label: 'STL' }] });
        const runtime = publishViewerRuntime();
        const instance = createStubInstance(wrapper);
        runtime.registry.set(wrapper, instance);

        await attachInteractionLayer(wrapper);
        expect(wrapper.querySelector('.tdv-marker--stl')?.getAttribute('aria-label')).toBe('STL');
        expect(instance.interaction).not.toBeNull();
    });

    it('reveals the text fallback when the STL scene never produced a mesh', async () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelType = 'stl';
        wrapper.innerHTML = '<ul class="tdv-fallback" hidden></ul>';
        withInteraction(wrapper, { enabled: true, markers: [{ id: 'm1' }] });
        const runtime = publishViewerRuntime();
        const instance = createStubInstance(wrapper);
        instance.mesh = null;
        runtime.registry.set(wrapper, instance);

        // A zero deadline keeps the test fast; production waits 20 seconds.
        await attachInteractionLayer(wrapper, 0);
        expect(wrapper.querySelector<HTMLElement>('.tdv-fallback')?.hidden).toBe(false);
    });
});

describe('bootWrappers', () => {
    it('returns true and does nothing when there is no wrapper', () => {
        expect(bootWrappers('')).toBe(true);
    });

    it('migrates, strips and boots every wrapper it finds', async () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'content/resources/a.stl';
        wrapper.dataset.modelType = 'stl';
        const modelViewer = createModelViewerStub(wrapper);
        modelViewer.setAttribute('src', 'content/resources/a.stl');

        expect(bootWrappers('')).toBe(true);
        await flush();

        expect(modelViewer.hasAttribute('src')).toBe(false);
        expect(wrapper.dataset.threedBooted).toBe('1');
    });

    it('does not boot the same wrapper twice', async () => {
        const wrapper = createWrapper();
        wrapper.dataset.modelSrc = 'a.glb';
        createModelViewerStub(wrapper);
        bootWrappers('');
        await flush();
        const first = wrapper.dataset.threedBooted;
        bootWrappers('');
        await flush();
        expect(wrapper.dataset.threedBooted).toBe(first);
    });
});
