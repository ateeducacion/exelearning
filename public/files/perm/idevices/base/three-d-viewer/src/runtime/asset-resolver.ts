/**
 * Locating the live AssetManager and turning `asset://` handles into URLs the
 * browser can fetch.
 *
 * `asset://` is the only durable model reference: in the workarea and the
 * preview it resolves to a blob URL through AssetManager, and in an exported
 * package the export pipeline has already rewritten it to a
 * `content/resources/...` path. Blob URLs are never persisted.
 */

/** Read the AssetManager from this window, or from the parent for a preview iframe. */
export function getAssetManager(): ExeAssetManager | null {
    const project = globalThis.eXeLearning?.app?.project;
    const local = project?.assetManager ?? project?._yjsBridge?.assetManager;
    if (local) {
        return local;
    }
    try {
        const parentWindow = (globalThis as { parent?: { eXeLearning?: ExeLearningGlobal } }).parent;
        const parentProject = parentWindow?.eXeLearning?.app?.project;
        return parentProject?.assetManager ?? parentProject?._yjsBridge?.assetManager ?? null;
    } catch {
        // Cross-origin parent: this is a genuine export context, not an error.
        return null;
    }
}

/** True when an AssetManager is reachable (workarea or preview, not a static export). */
export function isPreviewContext(): boolean {
    return getAssetManager() !== null;
}

/**
 * Resolve a model source to a fetchable URL.
 *
 * `asset://` needs an AssetManager; without one the caller falls back to the
 * wrapper's already-rewritten path. Everything else passes through.
 */
export async function resolveModelSource(src: unknown, assetManager?: ExeAssetManager | null): Promise<string> {
    if (typeof src !== 'string') {
        return '';
    }
    const trimmed = src.trim();
    if (!trimmed) {
        return '';
    }
    if (!trimmed.startsWith('asset://')) {
        return trimmed;
    }
    const manager = assetManager ?? getAssetManager();
    if (!manager) {
        return '';
    }
    try {
        const sync = manager.resolveAssetURLSync?.(trimmed);
        if (sync) {
            return sync;
        }
        const resolved = await manager.resolveAssetURL?.(trimmed);
        return resolved ?? '';
    } catch {
        // A rejected resolution means "not available"; the caller shows the
        // empty state rather than a broken model.
        return '';
    }
}

/** Synchronous best effort: returns the cached blob URL, or the input unchanged. */
export function resolveMediaUrlSync(url: unknown, assetManager?: ExeAssetManager | null): string {
    const raw = typeof url === 'string' ? url.trim() : '';
    if (!raw || !raw.startsWith('asset://')) {
        return raw;
    }
    const manager = assetManager ?? getAssetManager();
    if (!manager?.resolveAssetURLSync) {
        return raw;
    }
    try {
        return manager.resolveAssetURLSync(raw) || raw;
    } catch {
        return raw;
    }
}

/**
 * Poll AssetManager until an `asset://` handle resolves or the deadline passes.
 * Used on the boot path, where the asset may still be downloading.
 */
export async function resolveAssetUrlAsync(
    assetUrl: string,
    timeoutMs = 10000,
    pollIntervalMs = 100,
): Promise<string | null> {
    if (!assetUrl.startsWith('asset://')) {
        return null;
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const resolved = await resolveModelSource(assetUrl);
        if (resolved) {
            return resolved;
        }
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    return null;
}

/**
 * Recover the canonical `asset://<id>.<ext>` reference behind a blob URL.
 *
 * The workarea resolves `asset://` → `blob:` when it reads the iDevice JSON, so
 * on re-open the stored source can arrive as an ephemeral blob URL. The reverse
 * blob cache plus the asset metadata rebuild the durable handle; without them
 * the source has to be dropped rather than persisted as a dead blob URL.
 */
export function recoverAssetRefFromBlob(blobUrl: unknown, assetManager?: ExeAssetManager | null): string {
    if (typeof blobUrl !== 'string' || !blobUrl.startsWith('blob:')) {
        return '';
    }
    const manager = assetManager ?? getAssetManager();
    const assetId = manager?.reverseBlobCache?.get?.(blobUrl);
    if (!assetId) {
        return '';
    }
    const filename = manager?.getAssetMetadata?.(assetId)?.filename ?? '';
    const dot = filename.lastIndexOf('.');
    const extension = dot !== -1 ? filename.substring(dot + 1).toLowerCase() : '';
    return extension ? `${assetId}.${extension}` : String(assetId);
}

/** Wait for an AssetManager to appear, e.g. while the workarea is still booting. */
export async function waitForAssetManager(timeoutMs = 5000, pollIntervalMs = 100): Promise<ExeAssetManager | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const manager = getAssetManager();
        if (manager) {
            return manager;
        }
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    return null;
}
