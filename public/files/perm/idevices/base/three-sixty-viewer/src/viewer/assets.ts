/**
 * asset:// URL resolution against the eXeLearning asset manager, when the
 * viewer runs inside the workarea/preview. Outside eXeLearning (a published
 * export) sources are already plain relative URLs and pass through untouched.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

function assetManager(): ExeAssetManagerLike | null {
    if (typeof eXeLearning === 'undefined' || !eXeLearning) return null;
    return eXeLearning.app?.project?._yjsBridge?.assetManager ?? null;
}

/** Resolve `asset://` sources; anything else is returned as-is. */
export function resolveAssetSrc(src: string): string {
    if (!src || !src.startsWith('asset://')) return src;
    const manager = assetManager();
    if (!manager) return src;
    if (typeof manager.resolveAssetURLSync === 'function') {
        const resolved = manager.resolveAssetURLSync(src);
        if (typeof resolved === 'string' && resolved) return resolved;
    }
    if (typeof manager.resolveAssetURL === 'function') {
        // The async resolver cannot help a synchronous caller; kick it off so
        // the asset gets cached for the next render, but return the original.
        try {
            const pending = manager.resolveAssetURL(src) as { then?: unknown } | null;
            void pending;
        } catch {
            // Resolution failures fall back to the raw source.
        }
    }
    return src;
}
