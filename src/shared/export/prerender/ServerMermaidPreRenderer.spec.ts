/**
 * ServerMermaidPreRenderer Unit Tests
 *
 * Note: Mermaid rendering requires full SVG capabilities that jsdom doesn't provide.
 * These tests verify the detection logic and graceful fallback behavior.
 * In production, Mermaid pre-rendering may fail, in which case the Mermaid
 * library will be included in the export for client-side rendering.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'bun:test';
import {
    ServerMermaidPreRenderer,
    escapeHtmlAttribute,
    decodeHtmlEntities,
    configure,
    resetDependencies,
    type MermaidAPI,
} from './ServerMermaidPreRenderer';

describe('ServerMermaidPreRenderer', () => {
    let renderer: ServerMermaidPreRenderer;

    beforeAll(() => {
        renderer = new ServerMermaidPreRenderer();
    });

    afterAll(() => {
        // Clean up resources
        if (renderer) {
            renderer.destroy();
        }
    });

    describe('hasMermaid', () => {
        it('should detect <pre class="mermaid">', () => {
            expect(renderer.hasMermaid('<pre class="mermaid">graph TD; A-->B</pre>')).toBe(true);
        });

        it('should detect mermaid with other classes', () => {
            expect(renderer.hasMermaid('<pre class="code mermaid">graph TD; A-->B</pre>')).toBe(true);
        });

        it('should detect mermaid with attributes', () => {
            expect(renderer.hasMermaid('<pre id="diagram" class="mermaid">graph TD; A-->B</pre>')).toBe(true);
        });

        it('should return false for plain text', () => {
            expect(renderer.hasMermaid('Hello world')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(renderer.hasMermaid('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(renderer.hasMermaid(null as unknown as string)).toBe(false);
            expect(renderer.hasMermaid(undefined as unknown as string)).toBe(false);
        });

        it('should return false for pre without mermaid class', () => {
            expect(renderer.hasMermaid('<pre class="code">some code</pre>')).toBe(false);
        });

        it('should return false for mermaid in text', () => {
            expect(renderer.hasMermaid('This is a mermaid diagram')).toBe(false);
        });
    });

    describe('preRender', () => {
        it('should detect mermaid in HTML and set hasMermaid flag', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            const result = await renderer.preRender(html);

            // hasMermaid should be true even if rendering fails
            expect(result.hasMermaid).toBe(true);
            // mermaidRendered may be true or false depending on SVG support
            // In jsdom, it will likely fail and return false
        });

        it('should return unchanged HTML if no mermaid diagrams', async () => {
            const html = '<p>Hello world</p>';
            const result = await renderer.preRender(html);

            expect(result.hasMermaid).toBe(false);
            expect(result.mermaidRendered).toBe(false);
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        it('should preserve original HTML when rendering fails', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            const result = await renderer.preRender(html);

            // If rendering fails (due to jsdom limitations), HTML should be preserved
            if (!result.mermaidRendered) {
                expect(result.html).toBe(html);
            }
        });

        it('should handle already processed diagrams', async () => {
            const html = '<pre class="mermaid" data-processed="true">graph TD; A-->B</pre>';
            const result = await renderer.preRender(html);

            // Already processed diagrams should be skipped
            expect(result.mermaidRendered).toBe(false);
        });

        it('should detect mermaid in JSON data attributes', async () => {
            // Create HTML with mermaid in JSON data attribute
            const jsonData = {
                textContent: '<pre class="mermaid">graph TD; X-->Y</pre>',
            };
            const encodedJson = JSON.stringify(jsonData)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const html = `<div data-idevice-json-data="${encodedJson}">Content</div>`;
            const result = await renderer.preRender(html);

            expect(result.hasMermaid).toBe(true);
        });

        it('should handle multiple mermaid diagrams', async () => {
            const html = `
                <pre class="mermaid">graph TD; A-->B</pre>
                <pre class="mermaid">graph TD; C-->D</pre>
            `;
            const result = await renderer.preRender(html);

            expect(result.hasMermaid).toBe(true);
            // Count may be 0 if rendering fails, or 2 if it succeeds
            expect(result.count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('destroy', () => {
        it('should clean up resources without error', () => {
            const localRenderer = new ServerMermaidPreRenderer();
            expect(() => localRenderer.destroy()).not.toThrow();
        });

        it('should allow multiple destroy calls', () => {
            const localRenderer = new ServerMermaidPreRenderer();
            expect(() => {
                localRenderer.destroy();
                localRenderer.destroy();
            }).not.toThrow();
        });
    });

    describe('graceful fallback', () => {
        it('should handle initialization failure gracefully', async () => {
            // Force a new renderer to test initialization
            const newRenderer = new ServerMermaidPreRenderer();

            // Attempt to render - should not throw even if SVG rendering fails
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            let error: Error | null = null;

            try {
                await newRenderer.preRender(html);
            } catch (e) {
                error = e as Error;
            }

            // Should not throw - graceful fallback
            expect(error).toBeNull();

            newRenderer.destroy();
        });
    });
});

describe('escapeHtmlAttribute', () => {
    it('should escape ampersands', () => {
        expect(escapeHtmlAttribute('a & b')).toBe('a &amp; b');
    });

    it('should escape double quotes', () => {
        expect(escapeHtmlAttribute('a "b" c')).toBe('a &quot;b&quot; c');
    });

    it('should escape less than signs', () => {
        expect(escapeHtmlAttribute('a < b')).toBe('a &lt; b');
    });

    it('should escape greater than signs', () => {
        expect(escapeHtmlAttribute('a > b')).toBe('a &gt; b');
    });

    it('should escape multiple special characters', () => {
        expect(escapeHtmlAttribute('<div class="test">a & b</div>')).toBe(
            '&lt;div class=&quot;test&quot;&gt;a &amp; b&lt;/div&gt;',
        );
    });

    it('should return empty string for empty input', () => {
        expect(escapeHtmlAttribute('')).toBe('');
    });

    it('should handle already escaped content', () => {
        expect(escapeHtmlAttribute('&amp;')).toBe('&amp;amp;');
    });
});

describe('decodeHtmlEntities', () => {
    it('should decode &lt; to <', () => {
        expect(decodeHtmlEntities('a &lt; b')).toBe('a < b');
    });

    it('should decode &gt; to >', () => {
        expect(decodeHtmlEntities('a &gt; b')).toBe('a > b');
    });

    it('should decode &amp; to &', () => {
        expect(decodeHtmlEntities('a &amp; b')).toBe('a & b');
    });

    it('should decode &quot; to "', () => {
        expect(decodeHtmlEntities('a &quot;b&quot; c')).toBe('a "b" c');
    });

    it('should decode &#39; to single quote', () => {
        expect(decodeHtmlEntities('a &#39;b&#39; c')).toBe("a 'b' c");
    });

    it('should decode &nbsp; to space', () => {
        expect(decodeHtmlEntities('a&nbsp;b')).toBe('a b');
    });

    it('should decode multiple entities', () => {
        expect(decodeHtmlEntities('&lt;div&gt;a &amp; b&lt;/div&gt;')).toBe('<div>a & b</div>');
    });

    it('should return empty string for empty input', () => {
        expect(decodeHtmlEntities('')).toBe('');
    });
});

describe('ServerMermaidPreRenderer with mock', () => {
    let mockRenderer: ServerMermaidPreRenderer;
    let mockMermaid: MermaidAPI;

    beforeEach(() => {
        // Reset dependencies to ensure test isolation
        resetDependencies();

        mockRenderer = new ServerMermaidPreRenderer();
        mockMermaid = {
            initialize: () => {},
            render: async (id: string, code: string) => {
                return { svg: `<svg data-code="${code}">mock svg for ${id}</svg>` };
            },
        };
        mockRenderer.setMermaidForTesting(mockMermaid);
    });

    afterEach(() => {
        mockRenderer.destroy();
        resetDependencies();
    });

    it('should render mermaid diagram successfully with mock', async () => {
        const html = '<pre class="mermaid">graph TD; A-->B</pre>';
        const result = await mockRenderer.preRender(html);

        expect(result.hasMermaid).toBe(true);
        expect(result.mermaidRendered).toBe(true);
        expect(result.count).toBe(1);
        expect(result.html).toContain('exe-mermaid-rendered');
        expect(result.html).toContain('data-mermaid');
        expect(result.html).toContain('<svg');
    });

    it('should render multiple diagrams', async () => {
        const html = `
            <pre class="mermaid">graph TD; A-->B</pre>
            <p>Some text</p>
            <pre class="mermaid">graph TD; C-->D</pre>
        `;
        const result = await mockRenderer.preRender(html);

        expect(result.count).toBe(2);
        expect(result.mermaidRendered).toBe(true);
    });

    it('should skip short code blocks', async () => {
        const html = '<pre class="mermaid">ab</pre>';
        const result = await mockRenderer.preRender(html);

        // Code less than 5 characters is skipped
        expect(result.mermaidRendered).toBe(false);
        expect(result.count).toBe(0);
    });

    it('should handle render errors gracefully', async () => {
        const errorMermaid: MermaidAPI = {
            initialize: () => {},
            render: async () => {
                throw new Error('Render failed');
            },
        };
        mockRenderer.setMermaidForTesting(errorMermaid);

        const html = '<pre class="mermaid">graph TD; A-->B</pre>';
        const result = await mockRenderer.preRender(html);

        // Should not throw, but rendering should fail
        expect(result.hasMermaid).toBe(true);
        expect(result.mermaidRendered).toBe(false);
        expect(result.count).toBe(0);
    });

    it('should render mermaid in JSON data attributes', async () => {
        const jsonData = {
            textContent: '<pre class="mermaid">graph TD; X-->Y</pre>',
        };
        const encodedJson = JSON.stringify(jsonData)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const html = `<div data-idevice-json-data="${encodedJson}">Content</div>`;
        const result = await mockRenderer.preRender(html);

        expect(result.hasMermaid).toBe(true);
        expect(result.mermaidRendered).toBe(true);
        expect(result.count).toBe(1);
    });

    it('should decode HTML entities in mermaid code', async () => {
        const html = '<pre class="mermaid">graph TD; A--&gt;B</pre>';
        const result = await mockRenderer.preRender(html);

        expect(result.mermaidRendered).toBe(true);
        // The decoded code should be "graph TD; A-->B"
        expect(result.html).toContain('data-mermaid');
    });

    it('should preserve data-mermaid attribute with original code (escaped)', async () => {
        const code = 'graph TD; A-->B';
        const html = `<pre class="mermaid">${code}</pre>`;
        const result = await mockRenderer.preRender(html);

        // The code should be escaped in the data-mermaid attribute
        // > becomes &gt;
        expect(result.html).toContain('data-mermaid="graph TD; A--&gt;B"');
    });

    it('should escape special characters in data-mermaid attribute', async () => {
        const code = 'graph TD; A-->"B & C"';
        const html = `<pre class="mermaid">${code}</pre>`;
        const result = await mockRenderer.preRender(html);

        // Should escape quotes and ampersands
        expect(result.html).toContain('data-mermaid=');
        expect(result.html).toContain('&amp;');
        expect(result.html).toContain('&quot;');
    });
});

describe('configure and resetDependencies', () => {
    afterEach(() => {
        resetDependencies();
    });

    it('should allow overriding loadMermaid', async () => {
        let called = false;
        configure({
            loadMermaid: async () => {
                called = true;
                throw new Error('Custom error');
            },
        });

        const renderer = new ServerMermaidPreRenderer();
        await renderer.preRender('<pre class="mermaid">graph TD; A-->B</pre>');

        expect(called).toBe(true);
        renderer.destroy();
    });

    it('should reset to default dependencies', async () => {
        let customCalled = false;
        configure({
            loadMermaid: async () => {
                customCalled = true;
                throw new Error('Custom');
            },
        });

        resetDependencies();

        // After reset, default implementation should be used
        const renderer = new ServerMermaidPreRenderer();
        await renderer.preRender('<pre class="mermaid">graph TD; A-->B</pre>');

        // Custom function should not have been called after reset
        expect(customCalled).toBe(false);
        renderer.destroy();
    });
});
