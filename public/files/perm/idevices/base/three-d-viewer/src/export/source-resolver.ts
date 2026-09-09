/**
 * Turning a persisted model source into a URL the exported page can fetch.
 *
 * The same document has to work in four places — the workarea view, the
 * service-worker preview, a static HTML package and a SCORM package — and each
 * of them stores its assets differently. This is the single place that mapping
 * happens.
 */

import { getAssetManager } from '../runtime/asset-resolver';
import { resolveAppUrl } from '../runtime/paths';
import { isAbsoluteUrl, normalizePath } from '../shared/urls';

/** The ODE session id, when the workarea has one. */
function getOdeSessionId(): string {
    const session = globalThis.eXeLearning?.app?.project?.odeSession;
    return typeof session === 'string' && session.trim().length >= 8 ? session.trim() : '';
}

/** `files/tmp/YYYY/MM/DD/<session>/` for session-scoped uploads. */
function sessionPrefix(sessionId: string): string {
    return `files/tmp/${sessionId.substring(0, 4)}/${sessionId.substring(4, 6)}/${sessionId.substring(6, 8)}/${sessionId}/`;
}

/**
 * Resolve a stored source for the current context.
 *
 * Returns '' when an `asset://` handle needs AssetManager but is not cached
 * yet; the caller then falls back to the async resolver.
 */
export function resolveRuntimeSrc(path: unknown): string {
    const clean = normalizePath(path);
    if (!clean) {
        return '';
    }
    if (isAbsoluteUrl(clean) || clean.startsWith('blob:')) {
        return clean;
    }
    if (clean.startsWith('files/tmp/')) {
        return resolveAppUrl(clean);
    }

    if (clean.startsWith('asset://')) {
        const assetManager = getAssetManager();
        if (assetManager) {
            // Preview/workarea: only a blob URL works here. Returning '' when
            // the asset is not cached yet lets the caller await the async path
            // instead of requesting a URL that would 404.
            return assetManager.resolveAssetURLSync?.(clean) || '';
        }
        // Offline package: the exporter copied the asset next to the page.
        const assetPath = clean.substring('asset://'.length);
        if (!assetPath) {
            return '';
        }
        const onIndex = typeof document !== 'undefined' && document.documentElement.id === 'exe-index';
        return `${onIndex ? 'content/resources/' : '../content/resources/'}${assetPath}`;
    }

    // Paths the export/preview pipeline already rewrote stay RELATIVE. Making
    // them absolute would send a preview served at `/viewer/index.html` to
    // `/content/resources/...`, missing the service-worker interceptor — the
    // 404 body then reaches STLLoader and crashes it.
    if (clean.startsWith('content/resources/') || clean.startsWith('../content/resources/')) {
        return clean;
    }

    const sessionId = getOdeSessionId();
    return resolveAppUrl(sessionId ? `${sessionPrefix(sessionId)}${clean}` : clean);
}
