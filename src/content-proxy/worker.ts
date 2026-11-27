/**
 * Content proxy: serves content sources of any application, each on its own origin.
 *
 * See `protocol.ts` for the contract. This module only uses web-standard APIs, so
 * the same handler runs as a Cloudflare Worker (the default export, deployed with
 * `wrangler.toml`) and on Bun (`index.ts`).
 *
 * What it guarantees to every origin `<label>.<domain>`:
 * - a response is served only when `<label>` is the hash of the source prefix in
 *   the path, and the requested URL stays below that prefix;
 * - only `GET`; no cookie or credential is sent to the source, and no `Set-Cookie`
 *   reaches the browser (every origin here is the same site as every other one);
 * - a source is served only if it opted in, so the proxy cannot be used to mirror
 *   a site that does not take part.
 */
import {
    CONTENT_PROXY_LABEL_PATTERN,
    contentProxyLabel,
    decodeSourcePrefix,
    SOURCE_CSP_HEADER,
    SOURCE_HEADER,
} from './protocol';

export interface ContentProxyOptions {
    /** Domain the proxy answers under, without port: hosts are `<label>.<domain>`. */
    domain: string;
    /** Also proxy `http:` sources and hosts that are not public DNS names. Local development only. */
    allowHttp?: boolean;
    /** When not empty, only sources on these hosts are proxied (`host`, or `.suffix` for subdomains). */
    allowedHosts?: string[];
}

/** Request headers passed on to the source. Never cookies or credentials. */
const REQUEST_HEADERS = ['accept', 'accept-language', 'range', 'if-range', 'if-none-match', 'if-modified-since'];

/** Response headers passed on to the browser. */
const RESPONSE_HEADERS = [
    'content-type',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
    'cache-control',
    'expires',
    'content-disposition',
    'content-language',
    'access-control-allow-origin',
    'permissions-policy',
    'referrer-policy',
    'service-worker-allowed',
    'cross-origin-resource-policy',
    'timing-allow-origin',
];

function plain(status: number, message: string): Response {
    return new Response(message, {
        status,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store',
        },
    });
}

/** A DNS name with at least two labels: not an IP address, not a bare host name. */
function isPublicHostName(host: string): boolean {
    return host.includes('.') && !host.startsWith('[') && !/^[\d.]+$/.test(host);
}

function isAllowedHost(host: string, allowedHosts: string[]): boolean {
    return (
        allowedHosts.length === 0 ||
        allowedHosts.some(allowed => (allowed.startsWith('.') ? host.endsWith(allowed) : host === allowed))
    );
}

/** Answer one request. `fetchSource` is injectable for tests. */
export async function handleContentProxyRequest(
    request: Request,
    options: ContentProxyOptions,
    fetchSource: (input: string, init: RequestInit) => Promise<Response> = (input, init) => fetch(input, init),
): Promise<Response> {
    const url = new URL(request.url);
    const domain = options.domain.toLowerCase();
    const label = url.hostname.endsWith(`.${domain}`) ? url.hostname.slice(0, -(domain.length + 1)) : '';
    const path = /^\/([^/]+)\/(.*)$/.exec(url.pathname);
    if (!CONTENT_PROXY_LABEL_PATTERN.test(label) || !path) return plain(404, 'Not found');
    if (request.method !== 'GET') return plain(405, 'Method not allowed');

    const prefix = decodeSourcePrefix(path[1], options.allowHttp);
    if (!prefix || contentProxyLabel(prefix) !== label) return plain(404, 'Not found');

    const sourceHost = new URL(prefix).hostname;
    if (sourceHost === domain || sourceHost.endsWith(`.${domain}`)) return plain(404, 'Not found');
    if (!options.allowHttp && !isPublicHostName(sourceHost)) return plain(404, 'Not found');
    if (!isAllowedHost(sourceHost, options.allowedHosts ?? [])) return plain(403, 'This source is not allowed');

    // The URL parser already removed dot segments. Encoded separators and dots are refused
    // too, because the source may decode them and leave the prefix that names this origin.
    const rest = path[2];
    if (/\\|%2e|%2f|%5c/i.test(rest)) return plain(404, 'Not found');
    const target = new URL(prefix + rest + url.search);
    if (!target.href.startsWith(prefix)) return plain(404, 'Not found');

    const headers = new Headers();
    for (const name of REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }

    let source: Response;
    try {
        source = await fetchSource(target.href, { method: 'GET', headers, redirect: 'manual' });
    } catch {
        return plain(502, 'The content source did not answer');
    }

    if (source.status >= 400) return plain(source.status, 'The content source answered with an error');
    const cached = source.status === 304;
    if (!cached && source.status !== 200 && source.status !== 206) {
        return plain(502, 'The content source answered with a redirect or without content');
    }
    // A 304 has no body: the browser reuses a response this check already let through.
    if (!cached && !source.headers.has(SOURCE_HEADER)) {
        return plain(502, 'The address is not a content source');
    }

    const out = new Headers();
    for (const name of RESPONSE_HEADERS) {
        const value = source.headers.get(name);
        if (value) out.set(name, value);
    }
    // The response can only vary on what was passed on. Anything else is dropped, `Vary: *`
    // included: Firefox refuses to register a Service Worker whose script carries it.
    const vary = (source.headers.get('vary') ?? '')
        .split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => REQUEST_HEADERS.includes(name));
    if (vary.length) out.set('Vary', vary.join(', '));
    // The runtime decodes a compressed body, so its length no longer applies.
    const length = source.headers.get('content-length');
    if (length && !source.headers.has('content-encoding')) out.set('content-length', length);
    const policy = source.headers.get(SOURCE_CSP_HEADER);
    if (policy) out.set('Content-Security-Policy', policy);
    out.set('X-Content-Type-Options', 'nosniff');
    out.set('X-Robots-Tag', 'noindex');

    return new Response(cached ? null : source.body, { status: source.status, headers: out });
}

/** Options from environment variables: `CONTENT_PROXY_DOMAIN`, `ALLOWED_HOSTS` (comma separated), `ALLOW_HTTP`. */
export function contentProxyOptions(env: Record<string, string | undefined>): ContentProxyOptions {
    const domain = env.CONTENT_PROXY_DOMAIN?.trim();
    if (!domain) throw new Error('CONTENT_PROXY_DOMAIN is not set');
    return {
        domain,
        allowHttp: env.ALLOW_HTTP === 'true',
        allowedHosts: (env.ALLOWED_HOSTS ?? '')
            .split(',')
            .map(host => host.trim().toLowerCase())
            .filter(Boolean),
    };
}

export default {
    fetch(request: Request, env: Record<string, string | undefined>): Promise<Response> {
        return handleContentProxyRequest(request, contentProxyOptions(env));
    },
};
