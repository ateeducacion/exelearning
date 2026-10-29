import { afterEach, describe, expect, it } from 'vitest';
import { createThreeMock, installThreeGlobal, stubRect } from '../test/helpers';
import { createThreeSixtyRuntime } from './runtime';

let uninstallThree: (() => void) | null = null;

afterEach(() => {
    uninstallThree?.();
    uninstallThree = null;
    document.body.innerHTML = '';
});

const V1_DATA = {
    ideviceId: 'idev-v1',
    src: 'asset://pano.jpg',
    alt: 'A scene',
    initialView: { yaw: 30, pitch: 10, fov: 80 },
    autorotate: { enabled: true, speed: 2 },
    zoomEnabled: false,
};

function v2Data(ideviceId: string) {
    return {
        version: 2,
        ideviceId,
        startSceneId: 's1',
        scenes: [{ id: 's1', src: 'one.jpg', alt: 'One' }],
        behaviour: {},
    };
}

describe('createThreeSixtyRuntime', () => {
    it('exposes the JSON-iDevice engine contract', () => {
        const runtime = createThreeSixtyRuntime();
        expect(runtime.cssClass).toBe('three-sixty-viewer');
        expect(runtime.SCHEMA_VERSION).toBe(2);
        expect(typeof runtime.renderView).toBe('function');
        expect(typeof runtime.renderBehaviour).toBe('function');
        expect(typeof runtime.init).toBe('function');
        runtime.init(); // engine no-op hook must be callable
    });

    it('renderView renders v1 data through migration', () => {
        const runtime = createThreeSixtyRuntime();
        const html = runtime.renderView(V1_DATA, null, '{content}');
        expect(html).toContain('aria-label="A scene"');
    });

    it('renderView announces unsupported future versions instead of guessing', () => {
        const runtime = createThreeSixtyRuntime();
        const html = runtime.renderView({ version: 3, scenes: [] }, null, '{content}');
        expect(html).toContain('newer version of eXeLearning');
        // And hydrateDocument reports it faithfully.
        const result = runtime.hydrateDocument({ version: 3 });
        expect(result.status).toBe('unsupported-version');
    });

    it('renderBehaviour attaches a viewer to the identified node', () => {
        const { three } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const runtime = createThreeSixtyRuntime({ webglAvailable: () => true });
        const node = document.createElement('div');
        node.id = 'idev-run';
        document.body.appendChild(node);
        stubRect(node, { width: 640, height: 360 });
        node.innerHTML = runtime.renderView(v2Data('idev-run'), null, '{content}');
        runtime.renderBehaviour(v2Data('idev-run'));
        expect(node.querySelector('canvas')).toBeTruthy();
        runtime.destroyAll();
        // destroyAll leaves no live canvas loops; a second call is a no-op.
        runtime.destroyAll();
    });

    it('renderBehaviour without a matching node or id is a no-op', () => {
        const runtime = createThreeSixtyRuntime();
        runtime.renderBehaviour(v2Data('missing-node'));
        runtime.renderBehaviour(null);
    });

    it('supports two independent viewers on the same page', () => {
        const { three } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const runtime = createThreeSixtyRuntime({ webglAvailable: () => true });
        for (const id of ['idev-a', 'idev-b']) {
            const node = document.createElement('div');
            node.id = id;
            document.body.appendChild(node);
            stubRect(node, { width: 320, height: 180 });
            node.innerHTML = runtime.renderView(v2Data(id), null, '{content}');
            runtime.renderBehaviour(v2Data(id));
        }
        expect(document.querySelectorAll('canvas')).toHaveLength(2);
        runtime.destroyAll();
    });

    it('renderOne renders directly into a node and extractState reads JSON islands', () => {
        const runtime = createThreeSixtyRuntime();
        const node = document.createElement('div');
        node.setAttribute('data-idevice-json-data', JSON.stringify(v2Data('x')));
        const fromAttr = runtime.extractState(node);
        expect(fromAttr.startSceneId).toBe('s1');

        const scriptNode = document.createElement('div');
        const script = document.createElement('script');
        script.type = 'application/json';
        script.className = 'three-sixty-viewer-data';
        script.textContent = JSON.stringify(V1_DATA);
        scriptNode.appendChild(script);
        const fromScript = runtime.extractState(scriptNode);
        expect(fromScript.scenes[0]?.src).toBe('asset://pano.jpg');

        // Broken JSON and no data both fall back to a default document.
        const broken = document.createElement('div');
        broken.setAttribute('data-idevice-json-data', '{nope');
        expect(runtime.extractState(broken).scenes).toHaveLength(1);

        const renderTarget = document.createElement('div');
        document.body.appendChild(renderTarget);
        // Without three.js renderOne falls back but never throws.
        expect(runtime.renderOne(renderTarget, v2Data('y'))).toBeNull();
        expect(renderTarget.querySelector('.three-sixty-viewer-fallback')).toBeTruthy();
    });

    it('normalize returns the serialized v2 wire form (legacy helper)', () => {
        const runtime = createThreeSixtyRuntime();
        const normalized = runtime.normalize(V1_DATA) as {
            version: number;
            scenes: Array<{ src: string; initialView: { yaw: number } }>;
            behaviour: { autorotate: { enabled: boolean; speed: number }; zoomEnabled: boolean };
            startSceneId: string;
        };
        expect(normalized.version).toBe(2);
        expect(normalized.scenes).toHaveLength(1);
        expect(normalized.scenes[0]?.src).toBe('asset://pano.jpg');
        expect(normalized.scenes[0]?.initialView.yaw).toBe(30);
        expect(normalized.behaviour.autorotate).toEqual({ enabled: true, speed: 2 });
        expect(normalized.behaviour.zoomEnabled).toBe(false);
        expect(normalized.startSceneId).toBe('scene-1');
    });
});
