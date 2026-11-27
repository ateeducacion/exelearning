/**
 * Optional content domain for untrusted author content (`EXE_CONTENT_DOMAIN`).
 *
 * When an operator sets `EXE_CONTENT_DOMAIN=host[:port]`, author content is
 * served from `https://<label>.<host>[:port]/…`, a different site from the
 * application, with one label per content item (see `content-label.ts`). When
 * the variable is unset nothing in this module is used and the application
 * behaves exactly as it does without the feature.
 *
 * The application has no setting that names its own public origin, so the
 * origin that embeds the content travels in the content URL
 * (`/content/<base64url(app origin)>/…`) and is bound into the keyed label.
 * The content host can therefore emit `frame-ancestors <app origin>` without
 * any shared state, and a client cannot choose that origin: changing it
 * changes the label, which only the server can derive.
 */

export interface ContentDomain {
    /** Lowercase host name, without port, wildcard or trailing dot. */
    host: string;
    /** Explicit port, or null when the scheme's default port is used. */
    port: string | null;
}

/** Leaves room for the longest label plus its dot within the 253-byte DNS name limit. */
const MAX_HOST_LENGTH = 253 - 64;
const HOST_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Parse an `EXE_CONTENT_DOMAIN` value. Throws an Error that says what is wrong;
 * the message is shown to the operator at boot.
 */
export function parseContentDomain(raw: string): ContentDomain {
    const value = raw.trim().toLowerCase();
    const match = /^([^:/\s]+)(?::(\d{1,5}))?$/.exec(value);
    if (!match) {
        throw new Error('expected host[:port], without a scheme, path or wildcard');
    }
    const [, host, port = null] = match;
    const labels = host.split('.');
    if (host.length > MAX_HOST_LENGTH || !labels.every(label => HOST_LABEL.test(label))) {
        throw new Error('the host is not a valid DNS name');
    }
    if (/^\d+$/.test(labels[labels.length - 1])) {
        throw new Error('the host must be a DNS name, not an IP address');
    }
    if (port !== null && (Number(port) < 1 || Number(port) > 65535)) {
        throw new Error('the port must be between 1 and 65535');
    }
    return { host, port };
}

/** The configured content domain, or null when the mode is off. Throws on an invalid value. */
export function getContentDomain(env: NodeJS.ProcessEnv = process.env): ContentDomain | null {
    const raw = env.EXE_CONTENT_DOMAIN;
    return raw?.trim() ? parseContentDomain(raw) : null;
}

/**
 * Returns an error message when the deployment must refuse to boot because
 * `EXE_CONTENT_DOMAIN` is set to an invalid value; otherwise `null`.
 */
export function contentDomainBootError(env: NodeJS.ProcessEnv = process.env): string | null {
    try {
        getContentDomain(env);
        return null;
    } catch (error) {
        return `[SECURITY] Invalid EXE_CONTENT_DOMAIN: ${(error as Error).message}. Refusing to start.`;
    }
}

export type HostRelation = 'same' | 'app-under-content' | 'content-under-app' | 'unrelated';

/** How an application host name relates to the content domain. */
export function relateHostToContentDomain(hostname: string, contentDomain: ContentDomain): HostRelation {
    const host = hostname.toLowerCase();
    if (host === contentDomain.host) return 'same';
    if (host.endsWith(`.${contentDomain.host}`)) return 'app-under-content';
    if (contentDomain.host.endsWith(`.${host}`)) return 'content-under-app';
    return 'unrelated';
}

/** Encode an application origin as a single URL path segment. */
export function encodeAppOrigin(appOrigin: string): string {
    return Buffer.from(appOrigin, 'utf8').toString('base64url');
}

/**
 * Decode a path segment produced by {@link encodeAppOrigin}. Returns null unless
 * it is a canonical `http(s)` origin, so the value is safe to place in a header.
 */
export function decodeAppOrigin(token: string): string | null {
    if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    try {
        const url = new URL(decoded);
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === decoded ? decoded : null;
    } catch {
        return null;
    }
}

/**
 * The origin that serves one content item. It uses the scheme of the
 * application origin, because both are reached through the same front end.
 */
export function contentOrigin(contentDomain: ContentDomain, label: string, appOrigin: string): string {
    const { protocol } = new URL(appOrigin);
    const port = contentDomain.port ? `:${contentDomain.port}` : '';
    // URL normalizes away a default port, so the result compares equal to `window.origin`.
    return new URL(`${protocol}//${label}.${contentDomain.host}${port}`).origin;
}
