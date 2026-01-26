/**
 * Import Map Service
 * Generates import maps for ES modules based on runtime configuration.
 *
 * Import maps allow using bare module specifiers (like 'yjs' or '@exe/core/')
 * that resolve to the correct URLs with version prefixes.
 */

export interface ImportMapOptions {
    basePath: string;
    version: string;
}

export interface ImportMap {
    imports: Record<string, string>;
}

/**
 * Generate an import map for the application.
 *
 * @param options - Configuration options
 * @returns Import map object suitable for JSON serialization
 *
 * @example
 * // In template.ts:
 * const importMap = generateImportMap({ basePath: '/web/exe', version: 'v1.0.0' });
 * // Result:
 * // {
 * //   "imports": {
 * //     "yjs": "/web/exe/v1.0.0/libs/yjs/yjs.min.js",
 * //     "@exe/": "/web/exe/v1.0.0/app/",
 * //     ...
 * //   }
 * // }
 */
export function generateImportMap(options: ImportMapOptions): ImportMap {
    const { basePath, version } = options;

    /**
     * Resolve a path to a full URL with basePath and version.
     * @param path - Path relative to public/ (e.g., 'libs/yjs/yjs.min.js')
     */
    const resolve = (path: string): string => {
        const versionPrefix = version ? `/${version}` : '';
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return basePath ? `${basePath}${versionPrefix}/${cleanPath}` : `${versionPrefix}/${cleanPath}`;
    };

    return {
        imports: {
            // ================================================================
            // External libraries (loaded as ES modules via import map)
            // ================================================================

            // jQuery 3.x (still using UMD - will be upgraded to jQuery 4 ESM later)
            // Note: jQuery is loaded as a regular script, not via import map
            // 'jquery': resolve('libs/jquery/jquery.esm.min.js'),

            // Bootstrap 5 (ESM build)
            // Note: Bootstrap is loaded as a regular script with jQuery dependency
            // 'bootstrap': resolve('libs/bootstrap/bootstrap.bundle.min.js'),

            // Yjs ecosystem (ESM compatible)
            'yjs': resolve('libs/yjs/yjs.min.js'),
            'y-indexeddb': resolve('libs/yjs/y-indexeddb.min.js'),
            'y-websocket': resolve('libs/yjs/y-websocket.min.js'),

            // Compression library
            'fflate': resolve('libs/fflate/fflate.umd.js'),

            // Markdown converter
            'showdown': resolve('libs/showdown/showdown.min.js'),

            // Drag and drop library
            'interactjs': resolve('libs/interact/interact.min.js'),

            // ================================================================
            // Application module aliases
            // These allow clean imports like: import { PathResolver } from '@exe/core/PathResolver.js'
            // ================================================================

            // Root app alias
            '@exe/': resolve('app/'),

            // Submodule aliases for convenience
            '@exe/core/': resolve('app/core/'),
            '@exe/yjs/': resolve('app/yjs/'),
            '@exe/common/': resolve('app/common/'),
            '@exe/workarea/': resolve('app/workarea/'),
            '@exe/rest/': resolve('app/rest/'),
            '@exe/locate/': resolve('app/locate/'),
            '@exe/editor/': resolve('app/editor/'),
        },
    };
}

/**
 * Generate an import map for static mode (relative paths).
 * Used in build-static-bundle.ts for offline/PWA distribution.
 *
 * @returns Import map object with relative paths (starting with './')
 */
export function generateStaticImportMap(): ImportMap {
    const resolve = (path: string): string => {
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `./${cleanPath}`;
    };

    return {
        imports: {
            // Yjs ecosystem
            'yjs': resolve('libs/yjs/yjs.min.js'),
            'y-indexeddb': resolve('libs/yjs/y-indexeddb.min.js'),
            'y-websocket': resolve('libs/yjs/y-websocket.min.js'),

            // Compression
            'fflate': resolve('libs/fflate/fflate.umd.js'),

            // Utilities
            'showdown': resolve('libs/showdown/showdown.min.js'),
            'interactjs': resolve('libs/interact/interact.min.js'),

            // Application aliases
            '@exe/': resolve('app/'),
            '@exe/core/': resolve('app/core/'),
            '@exe/yjs/': resolve('app/yjs/'),
            '@exe/common/': resolve('app/common/'),
            '@exe/workarea/': resolve('app/workarea/'),
            '@exe/rest/': resolve('app/rest/'),
            '@exe/locate/': resolve('app/locate/'),
            '@exe/editor/': resolve('app/editor/'),
        },
    };
}

/**
 * Serialize an import map to JSON for embedding in HTML.
 *
 * @param importMap - The import map object
 * @param pretty - Whether to format with indentation (default: true)
 * @returns JSON string
 */
export function serializeImportMap(importMap: ImportMap, pretty: boolean = true): string {
    return JSON.stringify(importMap, null, pretty ? 4 : 0);
}
