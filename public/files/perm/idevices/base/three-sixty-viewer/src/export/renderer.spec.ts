import { afterEach, describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import type { ThreeSixtyDocumentV2 } from '../shared/types';
import { createThreeMock, installThreeGlobal, stubRect } from '../test/helpers';
import {
    buildViewer,
    createInstanceRegistry,
    destroyAllInstances,
    disposeInstancesWithin,
    registerInstance,
    renderViewHtml,
} from './renderer';

let uninstallThree: (() => void) | null = null;

afterEach(() => {
    uninstallThree?.();
    uninstallThree = null;
    document.body.innerHTML = '';
});

function docWith(src: string): ThreeSixtyDocumentV2 {
    const result = hydrateDocument(
        { version: 2, startSceneId: 's1', scenes: [{ id: 's1', src, alt: 'Alt text' }] },
        createSequentialIdGenerator(),
    );
    if (result.status !== 'ok') throw new Error('fixture');
    return result.document;
}

describe('renderViewHtml', () => {
    it('fills the template with an escaped, labelled region wrapper', () => {
        const html = renderViewHtml(docWith('a.jpg'), '<article>{content}</article>');
        expect(html).toContain('<article>');
        expect(html).toContain('class="three-sixty-viewer-wrapper"');
        expect(html).toContain('role="region"');
        expect(html).toContain('aria-label="Alt text"');
    });

    it('escapes the alt text and defaults the template and label', () => {
        const result = hydrateDocument(
            { version: 2, scenes: [{ id: 's1', src: 'x.jpg', alt: '"quoted" <alt>' }] },
            createSequentialIdGenerator(),
        );
        if (result.status !== 'ok') throw new Error('fixture');
        const html = renderViewHtml(result.document, undefined);
        expect(html).toContain('aria-label="&quot;quoted&quot; &lt;alt&gt;"');
        const noAlt = hydrateDocument({ version: 2, scenes: [{ id: 's1', src: 'x.jpg' }] }, createSequentialIdGenerator());
        if (noAlt.status !== 'ok') throw new Error('fixture');
        expect(renderViewHtml(noAlt.document, undefined)).toContain('aria-label="360° panorama"');
    });
});

describe('buildViewer', () => {
    it('renders the (no image) fallback without a source', () => {
        const registry = createInstanceRegistry();
        const node = document.createElement('div');
        const instance = buildViewer(node, docWith(''), { registry });
        expect(instance).toBeNull();
        expect(node.querySelector('.three-sixty-viewer-fallback')?.textContent).toBe('(no image)');
    });

    it('falls back to alt text when WebGL is unavailable', () => {
        const { three } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const registry = createInstanceRegistry();
        const node = document.createElement('div');
        const instance = buildViewer(node, docWith('a.jpg'), { registry, webglAvailable: () => false });
        expect(instance).toBeNull();
        expect(node.querySelector('.three-sixty-viewer-fallback')?.textContent).toBe('Alt text');
    });

    it('falls back when three.js is missing', () => {
        const registry = createInstanceRegistry();
        const node = document.createElement('div');
        const instance = buildViewer(node, docWith('a.jpg'), { registry, webglAvailable: () => true });
        expect(instance).toBeNull();
        expect(node.querySelector('.three-sixty-viewer-fallback')?.textContent).toBe('Alt text');
    });

    it('creates, registers and starts an instance when capabilities allow', () => {
        const { three } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const registry = createInstanceRegistry();
        const node = document.createElement('div');
        document.body.appendChild(node);
        stubRect(node, { width: 640, height: 360 });
        const instance = buildViewer(node, docWith('a.jpg'), { registry, webglAvailable: () => true });
        expect(instance).not.toBeNull();
        expect(registry.wrappers.size).toBe(1);
        expect(node.querySelector('canvas')).toBeTruthy();
        instance?.destroy();
    });

    it('re-rendering a node disposes the previous instance first', () => {
        const { three, state } = createThreeMock();
        uninstallThree = installThreeGlobal(three);
        const registry = createInstanceRegistry();
        const node = document.createElement('div');
        document.body.appendChild(node);
        buildViewer(node, docWith('a.jpg'), { registry, webglAvailable: () => true });
        buildViewer(node, docWith('b.jpg'), { registry, webglAvailable: () => true });
        expect(registry.wrappers.size).toBe(1);
        // The first renderer was disposed when the node re-rendered.
        expect(state.renderers[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(node.querySelectorAll('canvas')).toHaveLength(1);
        destroyAllInstances(registry);
    });

    it('registry helpers dispose within a node and destroy everything', () => {
        const registry = createInstanceRegistry();
        const outer = document.createElement('div');
        const wrapper = document.createElement('div');
        outer.appendChild(wrapper);
        let destroyed = 0;
        registerInstance(registry, {
            wrapper,
            start: () => {},
            goToScene: () => {},
            destroy: () => {
                destroyed += 1;
            },
        });
        disposeInstancesWithin(registry, outer);
        expect(destroyed).toBe(1);
        expect(registry.wrappers.size).toBe(0);

        registerInstance(registry, {
            wrapper,
            start: () => {},
            goToScene: () => {},
            destroy: () => {
                throw new Error('boom');
            },
        });
        // A failing destroy still clears the registry.
        destroyAllInstances(registry);
        expect(registry.wrappers.size).toBe(0);
    });
});
