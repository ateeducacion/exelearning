/**
 * Content proxy protocol: the part shared by the proxy (`worker.ts`) and by an
 * application that publishes content through one (`EXE_CONTENT_PROXY`).
 *
 * A content proxy gives every content source its own origin. A source is a URL
 * prefix on some web server, for example `https://app.example/view/<id>/_/`. The
 * proxy answers
 *
 *     https://<label>.<proxy domain>/<base64url(prefix)>/<path>
 *
 * with the response of `<prefix><path>`, and only when `<label>` is the hash of
 * `<prefix>`. Everything a browser sees on one origin therefore comes from one
 * prefix. No secret, DNS record or account is shared with the proxy: whoever
 * serves a prefix owns the origin derived from it, and no other.
 *
 * A source opts in per response with `X-Exe-Content-Proxy: 1`. The responses stay
 * safe when the source URL is opened directly (the application keeps sending its
 * opaque `Content-Security-Policy: sandbox`); the policy meant for the content
 * origin travels in `X-Exe-Content-Proxy-CSP` and the proxy puts it in place.
 *
 * This file must not import application code: it is bundled into the proxy.
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

/** Response header a source sets to allow the proxy to serve the response. */
export const SOURCE_HEADER = 'X-Exe-Content-Proxy';

/** Response header with the Content-Security-Policy to use on the content origin. */
export const SOURCE_CSP_HEADER = 'X-Exe-Content-Proxy-CSP';

/** Matches any label the proxy answers: a version letter plus 160 bits of SHA-256 in hex. */
export const CONTENT_PROXY_LABEL_PATTERN = /^x[0-9a-f]{40}$/;

/** The DNS label of the origin that serves the source at `prefix`. */
export function contentProxyLabel(prefix: string): string {
    return `x${createHash('sha256').update(`exe-content-proxy-v1\n${prefix}`).digest('hex').slice(0, 40)}`;
}

/** Encode a source prefix as a single URL path segment. */
export function encodeSourcePrefix(prefix: string): string {
    return Buffer.from(prefix, 'utf8').toString('base64url');
}

/**
 * Decode a path segment produced by {@link encodeSourcePrefix}. Returns null unless
 * it is a canonical `https:` URL that ends with a slash and has no credentials,
 * query or fragment. `http:` is accepted only when `allowHttp` is set.
 */
export function decodeSourcePrefix(token: string, allowHttp = false): string | null {
    if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    let url: URL;
    try {
        url = new URL(decoded);
    } catch {
        return null;
    }
    const scheme = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
    const plain = !url.username && !url.password && !/[?#]/.test(decoded);
    return scheme && plain && url.href === decoded && decoded.endsWith('/') ? decoded : null;
}
