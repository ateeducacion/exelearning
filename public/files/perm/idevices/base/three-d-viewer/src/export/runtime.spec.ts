import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFixture, resetDom } from '../test/helpers';
import { createExportRuntime, buildAssetRef, ThreeDViewerExportObject, toDisplayConfig } from './runtime';

if (!customElements.get('model-viewer')) {
    customElements.define('model-viewer', class extends HTMLElement {});
}

beforeEach(() => {
    globalThis.eXeLearning = undefined;
    document.documentElement.id = '';
});

afterEach(() => {
    globalThis.eXeLearning = undefined;
    globalThis.eXe3DViewer = undefined;
    globalThis.$exeLibs = undefined;
    document.documentElement.id = '';
    document.head.innerHTML = '';
    resetDom();
    vi.restoreAllMocks();
});

describe('toDisplayConfig', () => {
    it('normalizes the persisted display fields', () => {
        expect(
            toDisplayConfig({ src: '/a.glb', alt: 'Cube', modelColor: '#ABC', autoRotateSpeed: '45' }),
        ).toMatchObject({
            src: 'a.glb',
            type: 'glb',
            alt: 'Cube',
            modelColor: '#aabbcc',
            autoRotateSpeed: 45,
            cameraControls: true,
            autoRotate: true,
        });
    });

    it('lets nav controls win over auto-rotation', () => {
        expect(toDisplayConfig({ showNavControls: true, autoRotate: true }).autoRotate).toBe(false);
    });

    it('falls back to 30 degrees per second for an unparsable speed', () => {
        expect(toDisplayConfig({ autoRotateSpeed: 'fast' }).autoRotateSpeed).toBe(30);
    });
});

describe('buildAssetRef', () => {
    it('strips the scheme from an asset:// source', () => {
        expect(buildAssetRef('asset://uuid.glb')).toBe('uuid.glb');
    });

    it('recovers the reference behind a blob URL through AssetManager', () => {
        globalThis.eXeLearning = {
            app: {
                project: {
                    assetManager: {
                        reverseBlobCache: { get: () => 'uuid' },
                        getAssetMetadata: () => ({ filename: 'Cube.GLB' }),
                    },
                },
            },
        };
        expect(buildAssetRef('blob:http://x/1')).toBe('uuid.glb');
    });

    it('is empty for anything else', () => {
        expect(buildAssetRef('content/resources/a.glb')).toBe('');
        expect(buildAssetRef('blob:http://x/1')).toBe('');
    });
});

describe('$threedviewer.renderView', () => {
    const runtime = createExportRuntime();

    it('renders a wrapper with the model element and the flat attributes', () => {
        const html = runtime.renderView(
            { ideviceId: 'idev-1', src: 'asset://a.glb', alt: 'Cube' },
            undefined,
            '{content}',
        );
        expect(html).toContain('class="three-d-viewer-wrapper"');
        expect(html).toContain('id="idev-1"');
        expect(html).toContain('<model-viewer');
        expect(html).toContain('data-model-src="asset://a.glb"');
        expect(html).toContain('data-model-asset-ref="a.glb"');
    });

    it('substitutes into the template, and returns bare markup without one', () => {
        expect(runtime.renderView({}, undefined, '<div>{content}</div>')).toContain('<div>');
        expect(runtime.renderView({})).toContain('three-d-viewer-wrapper');
    });

    it('generates an id when the engine did not supply one', () => {
        expect(runtime.renderView({}, undefined, '{content}')).toMatch(/id="three-d-viewer-\d+"/);
    });

    it('omits the interaction block when interactions are disabled', () => {
        const html = runtime.renderView({ src: 'asset://a.glb' }, undefined, '{content}');
        expect(html).not.toContain('tdv-interaction-data');
    });

    it('renders the interaction block, the fallback and the guided nav for a v2 document', () => {
        const html = runtime.renderView(readFixture('schema-v2/with-markers.json'), undefined, '{content}');
        expect(html).toContain('tdv-interaction-data');
        expect(html).toContain('tdv-fallback');
        expect(html).toContain('tdv-guided-nav');
        expect(html).toContain('Summit');
    });

    it('adds a modulepreload hint for the model-viewer library', () => {
        runtime.renderView({ src: 'asset://a.glb' }, undefined, '{content}');
        expect(document.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(1);
        // Repeated renders reuse the same hint.
        runtime.renderView({ src: 'asset://b.glb' }, undefined, '{content}');
        expect(document.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(1);
    });

    it('records the current iDevice id', () => {
        runtime.renderView({ ideviceId: 'idev-9' }, undefined, '{content}');
        expect(runtime.currentIdeviceId).toBe('idev-9');
    });

    it('tolerates a non-object payload', () => {
        expect(runtime.renderView(null, undefined, '{content}')).toContain('three-d-viewer-wrapper');
    });
});

describe('$threedviewer.renderBehaviour', () => {
    const runtime = createExportRuntime();

    it('returns true when there is nothing to boot', () => {
        expect(runtime.renderBehaviour({}, undefined, 'missing')).toBe(true);
    });

    it('boots the wrappers rendered by renderView', async () => {
        const host = document.createElement('div');
        host.innerHTML = runtime.renderView(
            { ideviceId: 'idev-1', src: 'content/resources/a.glb' },
            undefined,
            '{content}',
        );
        document.body.appendChild(host);
        expect(runtime.renderBehaviour({ ideviceId: 'idev-1' }, undefined)).toBe(true);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(document.querySelector<HTMLElement>('.three-d-viewer-wrapper')?.dataset.threedBooted).toBe('1');
    });

    it('accepts the iDevice id through either argument', () => {
        expect(runtime.renderBehaviour({}, undefined, 'idev-1')).toBe(true);
        expect(runtime.renderBehaviour(null, undefined, undefined)).toBe(true);
    });
});

describe('$threedviewer.resolveBootConfig', () => {
    it('reads the wrapper attributes and ignores the data argument', () => {
        const runtime = createExportRuntime();
        const wrapper = document.createElement('div');
        wrapper.dataset.modelSrc = 'a.stl';
        expect(runtime.resolveBootConfig({ src: 'ignored.glb' }, wrapper)).toMatchObject({ src: 'a.stl', type: 'stl' });
    });
});

describe('ThreeDViewerExportObject', () => {
    it('delegates serialization to the bound node', () => {
        const node = {
            get3DViewerJSON: vi.fn(() => ({ schemaVersion: 2 })),
            set3DViewerJSON: vi.fn(),
        };
        const helper = new ThreeDViewerExportObject();
        expect(helper.init(node, { files: [] })).toBe(true);
        expect(helper.toJSON()).toEqual({ schemaVersion: 2 });
        helper.fromJSON({ src: 'a.glb' });
        expect(node.set3DViewerJSON).toHaveBeenCalledWith({ src: 'a.glb' });
        expect(helper.getResources()).toEqual({ files: [] });
    });

    it('degrades to an empty object without a node', () => {
        const helper = new ThreeDViewerExportObject();
        helper.init(null);
        expect(helper.toJSON()).toEqual({});
        expect(() => helper.fromJSON(undefined)).not.toThrow();
    });
});
