import { describe, expect, it } from 'bun:test';
import { contentProxyLabel, encodeSourcePrefix, SOURCE_CSP_HEADER, SOURCE_HEADER } from './protocol';
import worker, { contentProxyOptions, handleContentProxyRequest } from './worker';

const DOMAIN = 'content.example';
const PREFIX = 'https://app.example/view/abc/_/';
const OTHER_PREFIX = 'https://app.example/view/other/_/';

/** URL on the proxy of `rest` below `prefix`, on the origin derived from `labelPrefix`. */
function proxied(rest: string, prefix = PREFIX, labelPrefix = prefix): string {
    return `https://${contentProxyLabel(labelPrefix)}.${DOMAIN}/${encodeSourcePrefix(prefix)}/${rest}`;
}

/** A source that records what it is asked and answers with `response`. */
function source(response: () => Response) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchSource = async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return response();
    };
    return { calls, fetchSource };
}

function contentResponse(extra: Record<string, string> = {}, status = 200): Response {
    return new Response('<p>content</p>', {
        status,
        headers: {
            'Content-Type': 'text/html',
            'Content-Security-Policy': 'sandbox allow-scripts',
            [SOURCE_HEADER]: '1',
            [SOURCE_CSP_HEADER]: "sandbox allow-scripts allow-same-origin; frame-ancestors 'self' https://app.example",
            ...extra,
        },
    });
}

describe('content proxy', () => {
    const options = { domain: DOMAIN };

    it('serves the source below the prefix with the content-origin policy', async () => {
        const { calls, fetchSource } = source(() =>
            contentResponse({
                'Set-Cookie': 'session=1; Domain=content.example',
                'Access-Control-Allow-Origin': 'https://app.example',
                'Content-Length': '14',
                'Strict-Transport-Security': 'max-age=1; includeSubDomains',
                Vary: 'Accept-Encoding, Accept, Origin',
            }),
        );
        const request = new Request(proxied('html/page.html?exe-teacher=1'), {
            headers: { Cookie: 'auth=secret', Authorization: 'Bearer x', Range: 'bytes=0-', Accept: 'text/html' },
        });

        const response = await handleContentProxyRequest(request, options, fetchSource);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('<p>content</p>');
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(`${PREFIX}html/page.html?exe-teacher=1`);
        expect(calls[0].init.redirect).toBe('manual');
        const sent = new Headers(calls[0].init.headers);
        expect(sent.get('range')).toBe('bytes=0-');
        expect(sent.get('accept')).toBe('text/html');
        expect(sent.has('cookie')).toBe(false);
        expect(sent.has('authorization')).toBe(false);

        expect(response.headers.get('content-security-policy')).toBe(
            "sandbox allow-scripts allow-same-origin; frame-ancestors 'self' https://app.example",
        );
        expect(response.headers.get('content-type')).toBe('text/html');
        expect(response.headers.get('content-length')).toBe('14');
        expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example');
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('x-robots-tag')).toBe('noindex');
        expect(response.headers.has('set-cookie')).toBe(false);
        expect(response.headers.has('strict-transport-security')).toBe(false);
        expect(response.headers.has(SOURCE_HEADER)).toBe(false);
        // Only what was passed on to the source can vary the response.
        expect(response.headers.get('vary')).toBe('accept');
    });

    it('sets no policy when the source names none, and drops `Vary: *` and the length of a compressed body', async () => {
        const { fetchSource } = source(
            () =>
                new Response('console.log(1)', {
                    headers: {
                        'Content-Type': 'application/javascript',
                        'Content-Security-Policy': 'sandbox',
                        'Content-Encoding': 'gzip',
                        'Content-Length': '5',
                        Vary: '*',
                        [SOURCE_HEADER]: '1',
                    },
                }),
        );

        const response = await handleContentProxyRequest(new Request(proxied('a.js')), options, fetchSource);

        expect(response.status).toBe(200);
        expect(response.headers.has('content-security-policy')).toBe(false);
        expect(response.headers.has('content-length')).toBe(false);
        // Firefox does not register a Service Worker whose script has `Vary: *`.
        expect(response.headers.has('vary')).toBe(false);
    });

    it('never serves a prefix on the origin of another prefix', async () => {
        const { calls, fetchSource } = source(() => contentResponse());

        const response = await handleContentProxyRequest(
            new Request(proxied('index.html', OTHER_PREFIX, PREFIX)),
            options,
            fetchSource,
        );

        expect(response.status).toBe(404);
        expect(calls).toHaveLength(0);
    });

    it.each([
        ['a parent directory', '../other/_/index.html'],
        ['an encoded parent directory', '%2e%2e/other/_/index.html'],
        ['an encoded slash', '..%2fother%2f_%2findex.html'],
        ['an encoded backslash', '..%5cother'],
        ['an upper-case encoded dot', 'a/%2E%2E%2Fother'],
    ])('does not leave the prefix through %s', async (_name, rest) => {
        const { calls, fetchSource } = source(() => contentResponse());

        const response = await handleContentProxyRequest(new Request(proxied(rest)), options, fetchSource);

        expect(response.status).toBe(404);
        expect(calls).toHaveLength(0);
    });

    it.each([
        ['another domain', `https://${contentProxyLabel(PREFIX)}.elsewhere.example/${encodeSourcePrefix(PREFIX)}/a`],
        ['the bare domain', `https://${DOMAIN}/${encodeSourcePrefix(PREFIX)}/a`],
        ['a label that is not a hash', `https://www.${DOMAIN}/${encodeSourcePrefix(PREFIX)}/a`],
        ['no path below the prefix', `https://${contentProxyLabel(PREFIX)}.${DOMAIN}/${encodeSourcePrefix(PREFIX)}`],
        ['an invalid prefix', `https://${contentProxyLabel(PREFIX)}.${DOMAIN}/nothing/a`],
    ])('answers 404 for %s', async (_name, url) => {
        const { calls, fetchSource } = source(() => contentResponse());

        const response = await handleContentProxyRequest(new Request(url), options, fetchSource);

        expect(response.status).toBe(404);
        expect(calls).toHaveLength(0);
    });

    it.each([
        ['an IP address', 'https://203.0.113.7/a/'],
        ['an IPv6 address', 'https://[2001:db8::1]/a/'],
        ['a bare host name', 'https://intranet/a/'],
        ['the proxy itself', `https://${contentProxyLabel(PREFIX)}.${DOMAIN}/a/`],
    ])('does not fetch %s', async (_name, prefix) => {
        const { calls, fetchSource } = source(() => contentResponse());

        const response = await handleContentProxyRequest(new Request(proxied('a', prefix)), options, fetchSource);

        expect(response.status).toBe(404);
        expect(calls).toHaveLength(0);
    });

    it('only answers GET', async () => {
        const { calls, fetchSource } = source(() => contentResponse());

        for (const method of ['POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
            const response = await handleContentProxyRequest(
                new Request(proxied('index.html'), { method }),
                options,
                fetchSource,
            );
            expect(response.status).toBe(405);
        }
        expect(calls).toHaveLength(0);
    });

    it('refuses a response that did not opt in', async () => {
        const { fetchSource } = source(
            () => new Response('<p>any site</p>', { headers: { 'Content-Type': 'text/html' } }),
        );

        const response = await handleContentProxyRequest(new Request(proxied('index.html')), options, fetchSource);

        expect(response.status).toBe(502);
        expect(await response.text()).not.toContain('any site');
    });

    it('does not follow or pass on redirects', async () => {
        const { fetchSource } = source(
            () =>
                new Response(null, {
                    status: 302,
                    headers: { Location: 'https://elsewhere.example/', [SOURCE_HEADER]: '1' },
                }),
        );

        const response = await handleContentProxyRequest(new Request(proxied('index.html')), options, fetchSource);

        expect(response.status).toBe(502);
        expect(response.headers.has('location')).toBe(false);
    });

    it('reports the status of a source error without its body', async () => {
        const { fetchSource } = source(() => new Response('<p>error page</p>', { status: 404 }));

        const response = await handleContentProxyRequest(new Request(proxied('missing.html')), options, fetchSource);

        expect(response.status).toBe(404);
        expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
        expect(await response.text()).not.toContain('error page');
    });

    it('passes on partial content and a not-modified answer', async () => {
        const partial = source(() =>
            contentResponse({ 'Content-Range': 'bytes 0-3/14', 'Accept-Ranges': 'bytes' }, 206),
        );
        const ranged = await handleContentProxyRequest(new Request(proxied('a.mp4')), options, partial.fetchSource);
        expect(ranged.status).toBe(206);
        expect(ranged.headers.get('content-range')).toBe('bytes 0-3/14');

        const notModified = source(() => new Response(null, { status: 304, headers: { ETag: '"1"' } }));
        const cached = await handleContentProxyRequest(new Request(proxied('a.css')), options, notModified.fetchSource);
        expect(cached.status).toBe(304);
        expect(cached.headers.get('etag')).toBe('"1"');
    });

    it('answers 502 when the source cannot be reached', async () => {
        const response = await handleContentProxyRequest(new Request(proxied('index.html')), options, async () => {
            throw new Error('connection refused');
        });

        expect(response.status).toBe(502);
    });

    it('proxies only allowed hosts when a list is set', async () => {
        const { calls, fetchSource } = source(() => contentResponse());
        const limited = { domain: DOMAIN, allowedHosts: ['app.example', '.school.example'] };
        const status = async (prefix: string) =>
            (await handleContentProxyRequest(new Request(proxied('a', prefix)), limited, fetchSource)).status;

        expect(await status(PREFIX)).toBe(200);
        expect(await status('https://moodle.school.example/a/')).toBe(200);
        expect(await status('https://school.example/a/')).toBe(403);
        expect(await status('https://evil.example/a/')).toBe(403);
        expect(calls).toHaveLength(2);
    });

    it('proxies http and local names only in development', async () => {
        const { fetchSource } = source(() => contentResponse());
        const prefix = 'http://exe-app.localhost:3004/exe/view/abc/_/';
        const url = `http://${contentProxyLabel(prefix)}.${DOMAIN}:3005/${encodeSourcePrefix(prefix)}/index.html`;

        expect((await handleContentProxyRequest(new Request(url), options, fetchSource)).status).toBe(404);
        const development = { domain: DOMAIN, allowHttp: true };
        expect((await handleContentProxyRequest(new Request(url), development, fetchSource)).status).toBe(200);
    });

    it('reads its options from the environment', () => {
        expect(() => contentProxyOptions({})).toThrow('CONTENT_PROXY_DOMAIN');
        expect(contentProxyOptions({ CONTENT_PROXY_DOMAIN: ' content.example ' })).toEqual({
            domain: 'content.example',
            allowHttp: false,
            allowedHosts: [],
        });
        expect(
            contentProxyOptions({
                CONTENT_PROXY_DOMAIN: 'content.example',
                ALLOW_HTTP: 'true',
                ALLOWED_HOSTS: 'App.Example, .school.example,',
            }),
        ).toEqual({ domain: 'content.example', allowHttp: true, allowedHosts: ['app.example', '.school.example'] });
    });

    it('is a Worker: the default export answers with the options of its environment', async () => {
        const response = await worker.fetch(new Request(`https://www.${DOMAIN}/`), { CONTENT_PROXY_DOMAIN: DOMAIN });

        expect(response.status).toBe(404);
    });
});
