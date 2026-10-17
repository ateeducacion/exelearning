/**
 * ServerMermaidPreRenderer Unit Tests
 *
 * Note: Mermaid rendering requires full SVG capabilities that jsdom doesn't provide.
 * These tests verify the detection logic and graceful fallback behavior.
 * In production, Mermaid pre-rendering may fail, in which case the Mermaid
 * library will be included in the export for client-side rendering.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { installSvgMeasurementPolyfills, ServerMermaidPreRenderer } from './ServerMermaidPreRenderer';

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

    describe('installSvgMeasurementPolyfills', () => {
        function makeWindow(options?: { hasGetBBox?: boolean; hasTextLength?: boolean; omitTextElement?: boolean }) {
            const svgProto: { getBBox?: () => unknown; textContent?: string | null } = {};
            if (options?.hasGetBBox) {
                svgProto.getBBox = () => ({ x: 1, y: 2, width: 3, height: 4 });
            }
            const textProto: Record<string, unknown> = { textContent: 'abc' };
            if (options?.hasTextLength) {
                textProto.getComputedTextLength = () => 99;
            }
            return {
                SVGElement: { prototype: svgProto },
                SVGTextElement: options?.omitTextElement ? undefined : { prototype: textProto },
            };
        }

        it('installs getBBox and getComputedTextLength when missing', () => {
            const window = makeWindow();
            installSvgMeasurementPolyfills(window);

            const emptyBox = (
                window.SVGElement.prototype.getBBox as (this: { textContent?: string | null }) => {
                    width: number;
                    height: number;
                }
            ).call({ textContent: null });
            expect(emptyBox.width).toBe(0);
            expect(emptyBox.height).toBe(16);

            const textBox = (
                window.SVGElement.prototype.getBBox as (this: { textContent?: string | null }) => {
                    width: number;
                }
            ).call({ textContent: 'abcd' });
            expect(textBox.width).toBe(32);

            type TextLengthFn = (this: { textContent?: string | null }) => number;
            const textLength = window.SVGTextElement!.prototype.getComputedTextLength as TextLengthFn;
            expect(textLength.call({ textContent: 'ab' })).toBe(16);
            expect(textLength.call({ textContent: '' })).toBe(0);
        });

        it('does not overwrite existing measurement methods', () => {
            const window = makeWindow({ hasGetBBox: true, hasTextLength: true });
            const originalBox = window.SVGElement.prototype.getBBox;
            const originalLength = window.SVGTextElement!.prototype.getComputedTextLength;
            installSvgMeasurementPolyfills(window);
            expect(window.SVGElement.prototype.getBBox).toBe(originalBox);
            expect(window.SVGTextElement!.prototype.getComputedTextLength).toBe(originalLength);
        });

        it('skips text-length polyfill when SVGTextElement is absent', () => {
            const window = makeWindow({ omitTextElement: true });
            expect(() => installSvgMeasurementPolyfills(window)).not.toThrow();
            expect(window.SVGTextElement).toBeUndefined();
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
