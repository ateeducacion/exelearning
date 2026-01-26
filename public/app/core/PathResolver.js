/**
 * PathResolver - Centralized path resolution for all assets and resources.
 * This is the SINGLE SOURCE OF TRUTH for constructing URLs.
 *
 * Replaces the scattered basePath detection logic that was previously
 * done via regex parsing of script src attributes.
 *
 * Path patterns:
 * - Server mode: {basePath}/{version}/{path}
 *   Example: /web/exelearning/v1.0.0/app/common/common.js
 * - Static mode: ./{path}
 *   Example: ./app/common/common.js
 * - Electron mode: origin + {basePath}/{version}/{path}
 *   Example: http://localhost:3001/v1.0.0/app/common/common.js
 */
export class PathResolver {
    /**
     * Get the base path (URL prefix for subdirectory installations).
     * Empty string for root installations.
     * @returns {string}
     */
    static get basePath() {
        return window.eXeLearning?.config?.basePath ?? '';
    }

    /**
     * Get the application version (for cache busting).
     * @returns {string}
     */
    static get version() {
        return window.eXeLearning?.version ?? '';
    }

    /**
     * Check if running in static mode (PWA or Electron).
     * Uses the global flag set by build-static-bundle.ts.
     * @returns {boolean}
     */
    static get isStaticMode() {
        return window.__EXE_STATIC_MODE__ === true;
    }

    /**
     * Check if running in Electron.
     * @returns {boolean}
     */
    static get isElectron() {
        return typeof window.electronAPI !== 'undefined';
    }

    /**
     * Resolve a path to a full URL.
     * Handles all mode differences internally.
     *
     * @param {string} path - Path relative to public/ (e.g., 'app/common/common.js' or '/app/common/common.js')
     * @returns {string} - Fully resolved URL
     *
     * @example
     * // Server mode (basePath='/web/exe', version='v1.0.0'):
     * PathResolver.resolve('app/common/common.js') // '/web/exe/v1.0.0/app/common/common.js'
     * PathResolver.resolve('/libs/yjs/yjs.min.js') // '/web/exe/v1.0.0/libs/yjs/yjs.min.js'
     *
     * // Static mode:
     * PathResolver.resolve('app/common/common.js') // './app/common/common.js'
     */
    static resolve(path) {
        // Normalize: remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;

        // Static mode: use relative paths
        if (this.isStaticMode && !this.isElectron) {
            return `./${cleanPath}`;
        }

        // Server or Electron mode: use versioned path
        const versionPrefix = this.version ? `/${this.version}` : '';
        return `${this.basePath}${versionPrefix}/${cleanPath}`;
    }

    /**
     * Resolve a path for use in dynamic imports or script loading.
     * Same as resolve() but ensures absolute paths for module loading.
     *
     * @param {string} path - Path relative to public/
     * @returns {string} - Fully resolved URL
     */
    static resolveModule(path) {
        return this.resolve(path);
    }

    /**
     * Resolve a path for Yjs/collaborative editing resources.
     * Convenience method for the Yjs loader.
     *
     * @param {string} relativePath - Path relative to /app/yjs/ or /libs/yjs/
     * @returns {string}
     */
    static resolveYjs(relativePath) {
        return this.resolve(relativePath);
    }

    /**
     * Resolve a path for library resources.
     * Convenience method for third-party libraries.
     *
     * @param {string} lib - Library name (e.g., 'yjs', 'tinymce', 'bootstrap')
     * @param {string} file - File within the library (e.g., 'yjs.min.js')
     * @returns {string}
     */
    static resolveLib(lib, file) {
        return this.resolve(`libs/${lib}/${file}`);
    }

    /**
     * Resolve a path for app modules.
     * Convenience method for internal application modules.
     *
     * @param {string} modulePath - Path relative to /app/ (e.g., 'common/common.js')
     * @returns {string}
     */
    static resolveApp(modulePath) {
        return this.resolve(`app/${modulePath}`);
    }

    /**
     * Get the base URL for API calls.
     * @returns {string}
     */
    static getApiBaseUrl() {
        if (this.isStaticMode && !this.isElectron) {
            // Static mode: no API available
            return '';
        }
        return `${this.basePath}/api`;
    }

    /**
     * Get the WebSocket URL for collaboration.
     * @returns {string|null}
     */
    static getWebSocketUrl() {
        if (this.isStaticMode) {
            // Static and Electron modes don't use WebSocket collaboration
            return null;
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}${this.basePath}`;
    }

    /**
     * Build a complete asset URL from the import map aliases.
     * Used when dynamic imports are needed.
     *
     * @param {string} alias - Import map alias (e.g., '@exe/core/', 'yjs')
     * @param {string} [subpath] - Optional subpath after the alias
     * @returns {string}
     */
    static fromAlias(alias, subpath = '') {
        const aliasMap = {
            '@exe/': 'app/',
            '@exe/core/': 'app/core/',
            '@exe/yjs/': 'app/yjs/',
            '@exe/common/': 'app/common/',
            '@exe/workarea/': 'app/workarea/',
            'yjs': 'libs/yjs/yjs.min.js',
            'y-indexeddb': 'libs/yjs/y-indexeddb.min.js',
            'y-websocket': 'libs/yjs/y-websocket.min.js',
            'fflate': 'libs/fflate/fflate.umd.js',
        };

        const basePath = aliasMap[alias];
        if (!basePath) {
            console.warn(`[PathResolver] Unknown alias: ${alias}`);
            return alias + subpath;
        }

        return this.resolve(basePath + subpath);
    }
}

export default PathResolver;
