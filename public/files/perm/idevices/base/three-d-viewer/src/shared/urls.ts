/**
 * URL safety and path helpers.
 *
 * Two distinct questions live here and must not be confused:
 *
 *  - `stripUnsafeUrl` decides what may be PERSISTED. It rejects the ephemeral
 *    schemes (`blob:`, `data:`) alongside the executable ones, because a stored
 *    blob URL 404s on reload and a stored data: URL bloats the document.
 *  - `safeUrl` decides what may be RENDERED. `blob:` is fine at render time
 *    (the editor preview resolves `asset://` to one), executable schemes are not.
 */

const EXECUTABLE_SCHEME = /^\s*(javascript|vbscript):/i;
const EPHEMERAL_OR_EXECUTABLE_SCHEME = /^\s*(blob:|data:|javascript:|vbscript:)/i;
const ALLOWED_RENDER_SCHEME = /^(https?:|mailto:|tel:|asset:|blob:)/i;
const HAS_EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ABSOLUTE_URL = /^(https?:)?\/\//i;

/** Strip a URL that must never be persisted; returns '' when rejected. */
export function stripUnsafeUrl(value: unknown): string {
    const raw = typeof value === 'string' ? value : '';
    return EPHEMERAL_OR_EXECUTABLE_SCHEME.test(raw) ? '' : raw.trim();
}

/**
 * Allow only schemes that are safe to put in an `href`/`src` at render time.
 * Scheme-less values are treated as relative URLs and pass through.
 */
export function safeUrl(value: unknown): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
        return '';
    }
    if (EXECUTABLE_SCHEME.test(raw)) {
        return '';
    }
    if (ALLOWED_RENDER_SCHEME.test(raw)) {
        return raw;
    }
    return HAS_EXPLICIT_SCHEME.test(raw) ? '' : raw;
}

/** True for `//host/...` and `http(s)://host/...`. */
export function isAbsoluteUrl(value: string): boolean {
    return ABSOLUTE_URL.test(value);
}

/** Trim, unify slashes and drop the leading slash; absolute URLs pass through. */
export function normalizePath(value: unknown): string {
    const clean = String(value ?? '')
        .trim()
        .replace(/\\+/g, '/');
    if (!clean) {
        return '';
    }
    return isAbsoluteUrl(clean) ? clean : clean.replace(/^\/+/, '');
}

/** Drop the query string and hash fragment from a path or URL. */
export function stripQueryAndHash(value: string): string {
    let out = value;
    const query = out.indexOf('?');
    if (query !== -1) {
        out = out.substring(0, query);
    }
    const hash = out.indexOf('#');
    if (hash !== -1) {
        out = out.substring(0, hash);
    }
    return out;
}

/**
 * Join an app-relative path onto the eXeLearning base URL/path.
 * Always returns a rooted URL so callers never build `foo//bar`.
 */
export function joinAppUrl(baseURL: unknown, basePath: unknown, path: unknown): string {
    const base = String(baseURL ?? '').replace(/\/+$/g, '');
    const prefixPath = basePath ? `/${String(basePath).replace(/^\/+|\/+$/g, '')}` : '';
    const prefix = `${base}${prefixPath}`.replace(/\/+$/g, '');
    const normalized = String(path ?? '').replace(/^\/+/, '');
    return prefix ? `${prefix}/${normalized}` : `/${normalized}`;
}
