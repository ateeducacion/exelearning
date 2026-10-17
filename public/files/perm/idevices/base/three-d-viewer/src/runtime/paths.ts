/**
 * Where the vendored libraries live, per execution context.
 *
 * Three.js, STLLoader, OrbitControls and model-viewer are shipped once under
 * `export/` and reused by the editor and by every exported package, so the only
 * thing that varies is the prefix. Four contexts need different prefixes:
 *
 *   static   PWA/offline build served from the deploy root
 *   server   running against an eXeLearning server (possibly in a subdirectory)
 *   export   a standalone HTML package (index.html, or html/<page>.html)
 *   preview  the workarea preview, which still has the symfony config
 *
 * Dynamic `import()` resolves relative specifiers against the *importing
 * module*, so the Three.js base URL is always absolute — a relative one would
 * be re-prefixed with the bundle's own directory.
 */

import { joinAppUrl } from '../shared/urls';

/** Path of the shared library directory relative to the application root. */
export const LIB_RELATIVE_PATH = 'files/perm/idevices/base/three-d-viewer/export/';

/** Path of the library directory inside an exported package, from index.html. */
const EXPORT_LIB_PATH = 'idevices/three-d-viewer/';

interface RuntimeConfig {
    isStaticMode?: boolean;
    isOfflineInstallation?: boolean;
    baseURL?: string;
    basePath?: string;
}

/** `eXeLearning.config`, parsed when it arrives as a JSON string. */
export function parseRuntimeConfig(): RuntimeConfig | null {
    const config = globalThis.eXeLearning?.config;
    if (typeof config !== 'string') {
        return config ?? null;
    }
    try {
        return JSON.parse(config) as RuntimeConfig;
    } catch {
        return null;
    }
}

/** True for the PWA/offline build, where paths must not repeat the base path. */
export function isStaticMode(): boolean {
    const config = parseRuntimeConfig();
    return Boolean(config?.isStaticMode || config?.isOfflineInstallation);
}

export interface ExecutionMode {
    isStaticMode: boolean;
    isServerMode: boolean;
    isExportMode: boolean;
    isOnIndexPage: boolean;
}

/**
 * Classify the current page. Exported HTML sets the root element id to
 * `exe-index` (or `exe-<pageId>`), which is what distinguishes a static package
 * from a server-rendered page.
 */
export function detectMode(): ExecutionMode {
    const config = parseRuntimeConfig();
    const documentId = typeof document !== 'undefined' ? document.documentElement.id : '';
    const isOnIndexPage = documentId === 'exe-index';
    return {
        isStaticMode: Boolean(config?.isStaticMode || config?.isOfflineInstallation),
        isServerMode: config?.baseURL !== undefined,
        isExportMode:
            isOnIndexPage ||
            (typeof document !== 'undefined' && document.querySelector('html[id^="exe-"]') !== null),
        isOnIndexPage,
    };
}

/** Build an application URL from the symfony base URL/path. */
export function resolveAppUrl(path: string): string {
    const symfony = globalThis.eXeLearning?.symfony ?? {};
    return joinAppUrl(symfony.baseURL, symfony.basePath, path);
}

/** The `content/resources/<ideviceId>/` prefix used by offline packages. */
export function getIdeviceResourcesBase(ideviceId: string): string {
    if (!ideviceId) {
        return '';
    }
    const onIndex = typeof document !== 'undefined' && document.documentElement.id === 'exe-index';
    return onIndex ? `content/resources/${ideviceId}/` : `../content/resources/${ideviceId}/`;
}

function withOrigin(url: string): string {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    const origin = globalThis.location?.origin ?? '';
    return origin + (url.startsWith('/') ? '' : '/') + url;
}

/**
 * Absolute base URL of the shared library directory, as seen from the workarea
 * editor. Static mode drops the base path, which the deploy URL already carries.
 */
export function getEditionLibBaseUrl(): string {
    if (isStaticMode()) {
        return `${globalThis.location?.origin ?? ''}/${LIB_RELATIVE_PATH}`;
    }
    const symfony = globalThis.eXeLearning?.symfony ?? {};
    const baseURL = String(symfony.baseURL ?? '').replace(/\/+$/g, '');
    const basePath = symfony.basePath ? `/${String(symfony.basePath).replace(/^\/+|\/+$/g, '')}` : '';
    return withOrigin(`${baseURL}${basePath}/${LIB_RELATIVE_PATH}`);
}

/** Absolute base URL of the shared library directory, as seen from an export. */
export function getExportLibBaseUrl(): string {
    const mode = detectMode();
    if (mode.isStaticMode) {
        return `${globalThis.location?.origin ?? ''}/${LIB_RELATIVE_PATH}`;
    }
    if (mode.isServerMode) {
        const config = parseRuntimeConfig();
        const baseURL = String(config?.baseURL || globalThis.location?.origin || '').replace(/\/+$/g, '');
        const basePath = config?.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}` : '';
        return `${baseURL}${basePath}/${LIB_RELATIVE_PATH}`;
    }
    if (mode.isExportMode) {
        const href = globalThis.location?.href ?? '';
        const pageBase = href.substring(0, href.lastIndexOf('/') + 1);
        return `${pageBase}${mode.isOnIndexPage ? '' : '../'}${EXPORT_LIB_PATH}`;
    }
    const symfony = globalThis.eXeLearning?.symfony ?? {};
    const baseURL = String(symfony.baseURL || globalThis.location?.origin || '').replace(/\/+$/g, '');
    const basePath = symfony.basePath ? `/${String(symfony.basePath).replace(/^\/+|\/+$/g, '')}` : '';
    return `${baseURL}${basePath}/${LIB_RELATIVE_PATH}`;
}

/** URL of the model-viewer bundle, as seen from the workarea editor. */
export function getEditionModelViewerUrl(): string {
    const path = `${LIB_RELATIVE_PATH}model-viewer.min.js`;
    // Static mode resolves `./files/...` against the document, which already
    // carries the deploy prefix; prepending the base path would duplicate it.
    return isStaticMode() ? `./${path}` : resolveAppUrl(path);
}

/** URL of the model-viewer bundle, as seen from an exported package. */
export function getExportModelViewerUrl(): string {
    const mode = detectMode();
    const path = `${LIB_RELATIVE_PATH}model-viewer.min.js`;
    if (mode.isStaticMode) {
        return `./${path}`;
    }
    if (mode.isServerMode) {
        return resolveAppUrl(path);
    }
    if (mode.isExportMode) {
        return `${mode.isOnIndexPage ? './' : '../'}${EXPORT_LIB_PATH}model-viewer.min.js`;
    }
    return resolveAppUrl(path);
}
