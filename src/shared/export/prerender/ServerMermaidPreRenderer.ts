/**
 * ServerMermaidPreRenderer
 *
 * Pre-renders Mermaid diagrams to static SVG using isomorphic-mermaid.
 * This allows CLI exports to include pre-rendered diagrams without bundling Mermaid (~2.7MB).
 *
 * Output format:
 * <div class="exe-mermaid-rendered" data-mermaid="graph TD; A-->B">
 *   <svg>...rendered diagram...</svg>
 * </div>
 *
 * Uses isomorphic-mermaid which provides a pre-configured, server-friendly DOM
 * so we can render Mermaid diagrams in Node.js without a browser.
 */

import type { MermaidPreRenderResult, ServerMermaidPreRendererInterface } from './interfaces';

// Detection pattern for mermaid diagrams
const HAS_MERMAID_PATTERN = /<pre\s+[^>]*class="[^"]*\bmermaid\b[^"]*"/i;

// Counter for unique render IDs
let renderCounter = 0;

/**
 * Escape HTML special characters for use in attributes
 */
export function escapeHtmlAttribute(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Decode HTML entities in mermaid code
 */
export function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

/**
 * Mermaid API interface (minimal typing)
 */
export interface MermaidAPI {
    initialize(config: MermaidConfig): void;
    render(id: string, code: string): Promise<{ svg: string }>;
}

interface MermaidConfig {
    startOnLoad?: boolean;
    suppressErrorRendering?: boolean;
    logLevel?: string;
    securityLevel?: string;
    theme?: string;
    flowchart?: { useMaxWidth?: boolean; htmlLabels?: boolean };
    sequence?: { useMaxWidth?: boolean };
    gantt?: { useMaxWidth?: boolean };
}

/**
 * Dependencies for ServerMermaidPreRenderer
 */
export interface ServerMermaidPreRendererDeps {
    loadMermaid: () => Promise<MermaidAPI>;
}

/**
 * Default implementation to load isomorphic-mermaid
 */
async function defaultLoadMermaid(): Promise<MermaidAPI> {
    const mermaidModule = await import('isomorphic-mermaid');
    return mermaidModule.default as unknown as MermaidAPI;
}

const defaultDeps: ServerMermaidPreRendererDeps = {
    loadMermaid: defaultLoadMermaid,
};

// Current dependencies (can be overridden for testing)
let deps = { ...defaultDeps };

/**
 * Configure dependencies for testing
 */
export function configure(newDeps: Partial<ServerMermaidPreRendererDeps>): void {
    deps = { ...defaultDeps, ...newDeps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDependencies(): void {
    deps = { ...defaultDeps };
}

/**
 * Server-side Mermaid Pre-renderer using isomorphic-mermaid
 */
export class ServerMermaidPreRenderer implements ServerMermaidPreRendererInterface {
    private mermaid: MermaidAPI | null = null;
    private initialized = false;
    private initializationFailed = false;

    /**
     * Check if HTML contains Mermaid diagrams
     */
    hasMermaid(html: string): boolean {
        return !!(html && HAS_MERMAID_PATTERN.test(html));
    }

    /**
     * Set a mock mermaid instance for testing
     */
    setMermaidForTesting(mermaid: MermaidAPI): void {
        this.mermaid = mermaid;
        this.initialized = true;
        this.initializationFailed = false;
    }

    /**
     * Initialize the Mermaid library using isomorphic-mermaid
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Load isomorphic-mermaid which provides a server-friendly Mermaid
            this.mermaid = await deps.loadMermaid();

            // Configure mermaid for server-side rendering
            // Note: isomorphic-mermaid pre-configures with safe defaults
            this.mermaid.initialize({
                startOnLoad: false,
                suppressErrorRendering: true,
                securityLevel: 'strict',
                theme: 'default',
                flowchart: { useMaxWidth: true, htmlLabels: false },
                sequence: { useMaxWidth: true },
                gantt: { useMaxWidth: true },
            });

            this.initialized = true;
        } catch (error) {
            // Mermaid initialization may fail in some environments
            // In this case, pre-rendering will be skipped and Mermaid diagrams
            // will be included in export with the Mermaid library
            console.warn(
                '[ServerMermaidPreRenderer] Failed to initialize Mermaid library. ' +
                    'Mermaid diagrams will not be pre-rendered. Error:',
                error,
            );
            this.initialized = false;
            this.initializationFailed = true;
        }
    }

    /**
     * Render a single Mermaid diagram to SVG
     */
    private async renderMermaidToSvg(code: string): Promise<string> {
        if (!this.mermaid) {
            throw new Error('Mermaid not initialized');
        }

        // Generate unique ID for this render
        const id = `mermaid-server-${Date.now()}-${renderCounter++}`;

        try {
            // Use mermaid.render() API
            const result = await this.mermaid.render(id, code);
            return result.svg;
        } catch (error) {
            console.error('[ServerMermaidPreRenderer] Render error:', error);
            throw error;
        }
    }

    /**
     * Create the rendered wrapper HTML
     */
    private createRenderedWrapper(originalCode: string, svg: string): string {
        const escapedCode = escapeHtmlAttribute(originalCode.trim());
        return `<div class="exe-mermaid-rendered" data-mermaid="${escapedCode}">${svg}</div>`;
    }

    /**
     * Pre-render all Mermaid diagrams in HTML
     */
    async preRender(html: string): Promise<MermaidPreRenderResult> {
        // Quick check: any Mermaid at all?
        const hasMermaidInHtml = html && HAS_MERMAID_PATTERN.test(html);
        const hasMermaidInJson = html && /data-idevice-json-data="[^"]*mermaid/i.test(html);

        if (!hasMermaidInHtml && !hasMermaidInJson) {
            return {
                html,
                hasMermaid: false,
                mermaidRendered: false,
                count: 0,
            };
        }

        // Initialize if needed
        if (!this.initialized && !this.initializationFailed) {
            await this.initialize();
        }

        // If initialization failed, return HTML unchanged (Mermaid lib will be included in export)
        if (this.initializationFailed || !this.mermaid) {
            return {
                html,
                hasMermaid: hasMermaidInHtml || hasMermaidInJson,
                mermaidRendered: false,
                count: 0,
            };
        }

        // Pattern to match <pre class="mermaid">...</pre>
        const mermaidPattern = /<pre\s+([^>]*)class="([^"]*\bmermaid\b[^"]*)"([^>]*)>([\s\S]*?)<\/pre>/gi;

        let result = html;
        let renderedCount = 0;
        let errorCount = 0;

        // First, process JSON data attributes (for JSON iDevices)
        const jsonDataPattern = /data-idevice-json-data="([^"]*)"/g;
        let jsonMatch: RegExpExecArray | null;

        while ((jsonMatch = jsonDataPattern.exec(html)) !== null) {
            const encodedJson = jsonMatch[1];
            if (!encodedJson.includes('mermaid')) continue;

            try {
                // Decode HTML entities in the JSON string
                const decodedJson = decodeHtmlEntities(encodedJson);
                const jsonData = JSON.parse(decodedJson);

                let jsonUpdated = false;

                // Process each property that might contain mermaid
                for (const [key, value] of Object.entries(jsonData)) {
                    if (typeof value !== 'string' || !HAS_MERMAID_PATTERN.test(value)) {
                        continue;
                    }

                    // Process mermaid in this property
                    let propertyHtml = value;
                    let propertyMatch: RegExpExecArray | null;
                    const propertyPattern = /<pre\s+([^>]*)class="([^"]*\bmermaid\b[^"]*)"([^>]*)>([\s\S]*?)<\/pre>/gi;

                    while ((propertyMatch = propertyPattern.exec(value)) !== null) {
                        const fullMatch = propertyMatch[0];
                        const code = decodeHtmlEntities(propertyMatch[4].trim());

                        if (!code || code.length < 5) continue;

                        try {
                            const svg = await this.renderMermaidToSvg(code);
                            if (svg) {
                                const wrapper = this.createRenderedWrapper(code, svg);
                                propertyHtml = propertyHtml.replace(fullMatch, wrapper);
                                renderedCount++;
                                jsonUpdated = true;
                            }
                        } catch (err) {
                            console.warn('[ServerMermaidPreRenderer] Failed to render mermaid in JSON:', key, err);
                            errorCount++;
                        }
                    }

                    if (jsonUpdated) {
                        (jsonData as Record<string, unknown>)[key] = propertyHtml;
                    }
                }

                if (jsonUpdated) {
                    // Re-encode and escape the JSON
                    const newJson = JSON.stringify(jsonData);
                    const escapedNewJson = newJson
                        .replace(/&/g, '&amp;')
                        .replace(/"/g, '&quot;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');

                    result = result.replace(
                        `data-idevice-json-data="${encodedJson}"`,
                        `data-idevice-json-data="${escapedNewJson}"`,
                    );
                }
            } catch (err) {
                console.warn('[ServerMermaidPreRenderer] Failed to process JSON data:', err);
            }
        }

        // Then process direct <pre class="mermaid"> elements
        let match: RegExpExecArray | null;
        const processedMatches: Array<{ original: string; replacement: string }> = [];

        // Reset the pattern
        mermaidPattern.lastIndex = 0;

        while ((match = mermaidPattern.exec(result)) !== null) {
            const fullMatch = match[0];
            const code = decodeHtmlEntities(match[4].trim());

            if (!code || code.length < 5) continue;

            // Check if already processed
            if (match[0].includes('data-processed')) continue;

            try {
                const svg = await this.renderMermaidToSvg(code);
                if (svg) {
                    const wrapper = this.createRenderedWrapper(code, svg);
                    processedMatches.push({ original: fullMatch, replacement: wrapper });
                    renderedCount++;
                }
            } catch (err) {
                console.warn('[ServerMermaidPreRenderer] Failed to render:', code.substring(0, 50) + '...', err);
                errorCount++;
            }
        }

        // Apply replacements (from end to avoid index shifting)
        for (const { original, replacement } of processedMatches.reverse()) {
            result = result.replace(original, replacement);
        }

        return {
            html: result,
            hasMermaid: hasMermaidInHtml || hasMermaidInJson,
            mermaidRendered: renderedCount > 0,
            count: renderedCount,
        };
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.mermaid = null;
        this.initialized = false;
    }
}
