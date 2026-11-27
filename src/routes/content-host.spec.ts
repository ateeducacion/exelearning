import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import type { Project } from '../db/types';
import { CONTENT_DOMAIN_SANDBOX, PUBLIC_VIEW_SANDBOX } from '../shared/security/publicViewSandbox';
import { encodeAppOrigin } from '../utils/content-domain';
import { contentLabel } from '../utils/content-label';
import {
    type ContentHostDeps,
    contentHostGuard,
    createContentHostHandler,
    previewContentHostUrl,
    publicViewContentUrl,
} from './content-host';

const APP = 'http://app.test';
const CONTENT_DOMAIN = { host: 'content.test', port: null };
const ENV_KEYS = ['EXE_CONTENT_DOMAIN', 'BASE_PATH', 'TRUSTED_PROXIES'] as const;

const projects: Record<string, Partial<Project>> = {
    'pub-1': { id: 1, public_view_id: 'pub-1', public_view_enabled: 1 },
    'pub-2': { id: 2, public_view_id: 'pub-2', public_view_enabled: 1 },
    'pub-off': { id: 3, public_view_id: 'pub-off', public_view_enabled: 0 },
};

function createDeps(overrides: Partial<ContentHostDeps> = {}): ContentHostDeps & { warnings: string[] } {
    const warnings: string[] = [];
    return {
        db: {} as ContentHostDeps['db'],
        findProjectByPublicViewId: async (_db, id) => projects[id] as Project | undefined,
        isPublicViewFeatureEnabled: async () => true,
        getPublicViewFile: async (project, relPath) =>
            relPath === 'missing.html'
                ? null
                : {
                      content: new TextEncoder().encode(`${project.public_view_id}:${relPath}`),
                      contentType: 'text/html; charset=utf-8',
                  },
        warn: message => warnings.push(message),
        warnings,
        ...overrides,
    };
}

/** URL of a public view file on the content host derived for it. */
function contentUrl(publicViewId: string, file = 'index.html', appOrigin = APP): string {
    return publicViewContentUrl(CONTENT_DOMAIN, appOrigin, publicViewId).replace(/index\.html$/, file);
}

describe('content host handler', () => {
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ENV_KEYS) saved[key] = process.env[key];
        process.env.EXE_CONTENT_DOMAIN = 'content.test';
        delete process.env.BASE_PATH;
        delete process.env.TRUSTED_PROXIES;
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    });

    describe('mode off', () => {
        it('does not handle any request, whatever its host', async () => {
            delete process.env.EXE_CONTENT_DOMAIN;
            const handle = createContentHostHandler(createDeps());

            expect(await handle(new Request(contentUrl('pub-1')))).toBeUndefined();
            expect(await handle(new Request('http://app.test/login'))).toBeUndefined();
            expect(await handle(new Request('http://anything.content.test/'))).toBeUndefined();
        });
    });

    describe('application host', () => {
        it('lets every request through untouched', async () => {
            const deps = createDeps();
            const handle = createContentHostHandler(deps);

            expect(await handle(new Request('http://app.test/login'))).toBeUndefined();
            expect(await handle(new Request('http://app.test/view/pub-1/_/index.html'))).toBeUndefined();
            expect(await handle(new Request('http://xcontent.test/'))).toBeUndefined();
            expect(deps.warnings).toEqual([]);
        });

        it('warns once when the content domain is a subdomain of the application host', async () => {
            const deps = createDeps();
            const handle = createContentHostHandler(deps);

            expect(await handle(new Request('http://test/login'))).toBeUndefined();
            expect(await handle(new Request('http://test/workarea'))).toBeUndefined();

            expect(deps.warnings).toHaveLength(1);
            expect(deps.warnings[0]).toContain('subdomain of the application host');
        });
    });

    describe('content host', () => {
        it('serves the content whose label matches the host, on its own origin', async () => {
            const handle = createContentHostHandler(createDeps());
            const url = contentUrl('pub-1');
            expect(new URL(url).hostname).toBe(`${contentLabel('view', 'pub-1', APP)}.content.test`);

            const res = await handle(new Request(url));

            expect(res?.status).toBe(200);
            expect(await res?.text()).toBe('pub-1:index.html');
            expect(res?.headers.get('Content-Type')).toBe('text/html; charset=utf-8');

            const csp = res?.headers.get('Content-Security-Policy') ?? '';
            expect(csp).toContain(`sandbox ${CONTENT_DOMAIN_SANDBOX};`);
            expect(csp).toContain(`frame-ancestors 'self' ${APP}`);
            expect(csp).toContain("object-src 'none'");
            expect(res?.headers.get('X-Content-Type-Options')).toBe('nosniff');
            expect(res?.headers.get('Permissions-Policy')).toContain('camera=()');
            expect(res?.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
            expect(res?.headers.get('Access-Control-Allow-Origin')).toBe(APP);
            expect(res?.headers.get('Cache-Control')).toBe('no-store');
        });

        it('serves nested files', async () => {
            const handle = createContentHostHandler(createDeps());
            const res = await handle(new Request(contentUrl('pub-1', 'html/page.html')));
            expect(await res?.text()).toBe('pub-1:html/page.html');
        });

        it('returns 404 when the host label belongs to other content', async () => {
            const handle = createContentHostHandler(createDeps());
            const onOtherLabel = contentUrl('pub-1').replace(
                contentLabel('view', 'pub-1', APP),
                contentLabel('view', 'pub-2', APP),
            );

            const res = await handle(new Request(onOtherLabel));

            expect(res?.status).toBe(404);
            expect(res?.headers.get('Content-Security-Policy')).toBeNull();
        });

        it('returns 404 when the application origin in the path is not the one bound into the label', async () => {
            const handle = createContentHostHandler(createDeps());
            const forged = contentUrl('pub-1').replace(encodeAppOrigin(APP), encodeAppOrigin('https://evil.example'));

            expect((await handle(new Request(forged)))?.status).toBe(404);
        });

        it('returns 404 when the application origin segment is not a canonical origin', async () => {
            const handle = createContentHostHandler(createDeps());
            const label = contentLabel('view', 'pub-1', 'not-an-origin');
            const url = `http://${label}.content.test/content/${encodeAppOrigin('not-an-origin')}/view/pub-1/index.html`;

            expect((await handle(new Request(url)))?.status).toBe(404);
        });

        it.each([
            '/',
            '/login',
            '/workarea',
            '/admin',
            '/api/auth/login',
            '/api/v1/projects',
            '/api/session/check',
            '/yjs/project-abc',
            '/view/pub-1',
            '/view/pub-1/_/index.html',
            '/preview-sw.js',
            '/app/app.bundle.js',
            '/files/tmp/x',
            '/health',
        ])('returns 404 for the application route %s', async path => {
            const handle = createContentHostHandler(createDeps());
            const { origin } = new URL(contentUrl('pub-1'));

            const res = await handle(new Request(origin + path));

            expect(res?.status).toBe(404);
            expect(await res?.text()).toBe('Not found');
        });

        it('returns 404 for methods other than GET', async () => {
            const handle = createContentHostHandler(createDeps());
            for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
                expect((await handle(new Request(contentUrl('pub-1'), { method })))?.status).toBe(404);
            }
        });

        it('returns 404 for the bare content domain and for hosts that are not a content label, and warns once', async () => {
            const deps = createDeps();
            const handle = createContentHostHandler(deps);

            expect((await handle(new Request('http://content.test/login')))?.status).toBe(404);
            expect((await handle(new Request('http://app.content.test/login')))?.status).toBe(404);
            const nested = contentUrl('pub-1').replace('http://', 'http://sub.');
            expect((await handle(new Request(nested)))?.status).toBe(404);

            expect(deps.warnings).toHaveLength(1);
            expect(deps.warnings[0]).toContain('must not be the application host or a parent of it');
        });

        it('returns 404 for unknown, disabled and site-disabled public views and for missing files', async () => {
            const handle = createContentHostHandler(createDeps());
            expect((await handle(new Request(contentUrl('unknown'))))?.status).toBe(404);
            expect((await handle(new Request(contentUrl('pub-off'))))?.status).toBe(404);
            expect((await handle(new Request(contentUrl('pub-1', 'missing.html'))))?.status).toBe(404);

            const siteDisabled = createContentHostHandler(
                createDeps({ isPublicViewFeatureEnabled: async () => false }),
            );
            expect((await siteDisabled(new Request(contentUrl('pub-1'))))?.status).toBe(404);
        });

        it('returns 500 when the export build throws', async () => {
            const handle = createContentHostHandler(
                createDeps({
                    getPublicViewFile: async () => {
                        throw new Error('build failed');
                    },
                }),
            );
            const originalError = console.error;
            console.error = () => {};
            try {
                expect((await handle(new Request(contentUrl('pub-1'))))?.status).toBe(500);
            } finally {
                console.error = originalError;
            }
        });

        it('ignores the session: a request with credentials gets the same response and no cookie', async () => {
            const handle = createContentHostHandler(createDeps());
            const anonymous = await handle(new Request(contentUrl('pub-1')));
            const withSession = await handle(
                new Request(contentUrl('pub-1'), {
                    headers: { Cookie: 'auth=some.jwt.token', Authorization: 'Bearer some.jwt.token' },
                }),
            );

            expect(withSession?.status).toBe(200);
            expect(await withSession?.text()).toBe(await anonymous?.text());
            expect([...(withSession?.headers.keys() ?? [])]).toEqual([...(anonymous?.headers.keys() ?? [])]);
            expect(withSession?.headers.get('Set-Cookie')).toBeNull();
            expect(withSession?.headers.getSetCookie()).toEqual([]);
        });
    });

    describe('workarea preview host', () => {
        const hostUrl = (projectUuid = 'project-uuid-1', appOrigin = APP) =>
            previewContentHostUrl(CONTENT_DOMAIN, appOrigin, projectUuid);
        const fileUrl = (file: string, projectUuid?: string) => hostUrl(projectUuid).replace(/host\.html$/, file);

        it('serves the host page on the origin derived for the project, framed only by the application', async () => {
            const handle = createContentHostHandler(createDeps());
            expect(new URL(hostUrl()).hostname).toBe(`${contentLabel('preview', 'project-uuid-1', APP)}.content.test`);

            const res = await handle(new Request(hostUrl()));

            expect(res?.status).toBe(200);
            expect(res?.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
            expect(res?.headers.get('Content-Security-Policy')).toContain(`frame-ancestors ${APP}`);
            expect(res?.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
            expect(res?.headers.get('Set-Cookie')).toBeNull();
            const html = (await res?.text()) ?? '';
            expect(html).toContain(`data-app-origin="${APP}"`);
            expect(html).toContain('<script type="module" src="preview-host.js?v=');
            expect(html).toContain('<iframe id="preview-content"');
        });

        it('serves the host script and the preview Service Worker next to it', async () => {
            const handle = createContentHostHandler(createDeps());

            const script = await handle(new Request(fileUrl('preview-host.js?v=1')));
            expect(script?.status).toBe(200);
            expect(script?.headers.get('Content-Type')).toBe('application/javascript; charset=utf-8');
            expect(await script?.text()).toContain('startPreviewHost');

            const worker = await handle(new Request(fileUrl('preview-sw.js?v=1')));
            expect(worker?.status).toBe(200);
            expect(worker?.headers.get('Content-Type')).toBe('application/javascript; charset=utf-8');
            expect(worker?.headers.get('Cache-Control')).toContain('no-store');
            expect(await worker?.text()).toContain('SET_CONTENT');
        });

        it('serves nothing else there: the previewed files only exist in the Service Worker', async () => {
            const handle = createContentHostHandler(createDeps());
            for (const file of ['', 'viewer/index.html', 'app.bundle.js', '../host.html', 'preview-sw.js/x']) {
                expect((await handle(new Request(fileUrl(file))))?.status, file).toBe(404);
            }
        });

        it('returns 404 when the label belongs to another project, another origin or a public view', async () => {
            const handle = createContentHostHandler(createDeps());
            const own = contentLabel('preview', 'project-uuid-1', APP);
            const swap = (label: string) => hostUrl().replace(own, label);

            expect((await handle(new Request(swap(contentLabel('preview', 'project-uuid-2', APP)))))?.status).toBe(404);
            expect(
                (await handle(new Request(swap(contentLabel('preview', 'project-uuid-1', 'https://evil.example')))))
                    ?.status,
            ).toBe(404);
            expect((await handle(new Request(swap(contentLabel('view', 'project-uuid-1', APP)))))?.status).toBe(404);
            expect(
                (await handle(new Request(hostUrl().replace(encodeAppOrigin(APP), encodeAppOrigin('not-an-origin')))))
                    ?.status,
            ).toBe(404);
        });

        it('escapes the application origin it writes into the page', async () => {
            // A canonical origin cannot contain these characters; this guards the template itself.
            const handle = createContentHostHandler(createDeps());
            const html = (await (await handle(new Request(hostUrl())))?.text()) ?? '';
            expect(html).not.toContain('data-app-origin=""');
            expect(html.match(/data-app-origin="([^"]*)"/)?.[1]).toBe(APP);
        });

        it('keeps the base path in the host page URL', async () => {
            process.env.BASE_PATH = '/exe';
            const handle = createContentHostHandler(createDeps());
            expect(new URL(hostUrl()).pathname).toBe(
                `/exe/content/${encodeAppOrigin(APP)}/preview/project-uuid-1/host.html`,
            );
            expect((await handle(new Request(hostUrl())))?.status).toBe(200);
        });
    });

    describe('BASE_PATH', () => {
        it('serves content below the base path and builds URLs that include it', async () => {
            process.env.BASE_PATH = '/aplicaciones/exe';
            const handle = createContentHostHandler(createDeps());
            const url = contentUrl('pub-1');

            expect(new URL(url).pathname).toBe(
                `/aplicaciones/exe/content/${encodeAppOrigin(APP)}/view/pub-1/index.html`,
            );
            expect((await handle(new Request(url)))?.status).toBe(200);
            expect((await handle(new Request(`${new URL(url).origin}/aplicaciones/exe/login`)))?.status).toBe(404);
        });
    });

    describe('effective host behind a reverse proxy', () => {
        const server = { requestIP: () => ({ address: '10.0.0.5' }) };

        it('uses X-Forwarded-Host from a trusted proxy to recognize the content host', async () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const handle = createContentHostHandler(createDeps());
            const { host, pathname } = new URL(contentUrl('pub-1'));

            const res = await handle(
                new Request(`http://127.0.0.1:8080${pathname}`, { headers: { 'X-Forwarded-Host': host } }),
                server,
            );
            expect(res?.status).toBe(200);

            const appRoute = await handle(
                new Request('http://127.0.0.1:8080/login', { headers: { 'X-Forwarded-Host': host } }),
                server,
            );
            expect(appRoute?.status).toBe(404);
        });

        it('ignores X-Forwarded-Host from an untrusted client', async () => {
            const handle = createContentHostHandler(createDeps());
            const { host, pathname } = new URL(contentUrl('pub-1'));

            // Not trusted: the request stays an application-host request.
            expect(
                await handle(
                    new Request(`http://app.test${pathname}`, { headers: { 'X-Forwarded-Host': host } }),
                    server,
                ),
            ).toBeUndefined();
        });

        it('never lets a forwarded host turn a content host into the application host', async () => {
            const handle = createContentHostHandler(createDeps());
            const request = () =>
                new Request(`${new URL(contentUrl('pub-1')).origin}/login`, {
                    headers: { 'X-Forwarded-Host': 'app.test' },
                });

            expect((await handle(request(), server))?.status).toBe(404);
            // Not even when the sender is a trusted proxy.
            process.env.TRUSTED_PROXIES = 'private_ranges';
            expect((await handle(request(), server))?.status).toBe(404);
        });
    });

    describe('as the first hook of the application', () => {
        let reachedApp: string[] = [];
        let listening: { stop: () => void; port: number };

        // Same order as src/index.ts: the guard first, then everything else.
        const app = new Elysia()
            .use(contentHostGuard(createDeps()))
            .use(cors({ origin: true, credentials: true }))
            .onRequest(({ request }) => {
                reachedApp.push(new URL(request.url).pathname);
            })
            .get('/login', ({ cookie }) => {
                cookie.auth.set({ value: 'session', httpOnly: true });
                return 'login page';
            })
            .get('/view/:id/_/*', () => new Response('opaque', { headers: { 'Content-Security-Policy': 'sandbox' } }))
            .ws('/yjs/:room', { message() {} });

        beforeAll(() => {
            app.listen(0);
            listening = { stop: () => app.stop(), port: app.server?.port ?? 0 };
        });

        afterAll(() => {
            listening.stop();
        });

        beforeEach(() => {
            reachedApp = [];
        });

        it('keeps the application host working, cookies included', async () => {
            const res = await app.handle(new Request('http://app.test/login'));
            expect(res.status).toBe(200);
            expect(res.headers.get('Set-Cookie')).toContain('auth=session');
            expect(reachedApp).toEqual(['/login']);
        });

        it('keeps the opaque-origin route of the application host', async () => {
            const res = await app.handle(new Request('http://app.test/view/pub-1/_/index.html'));
            expect(await res.text()).toBe('opaque');
            expect(res.headers.get('Content-Security-Policy')).toBe('sandbox');
            expect(PUBLIC_VIEW_SANDBOX).not.toContain('allow-same-origin');
        });

        it('answers a content host before any other hook or route runs, without cookies', async () => {
            const { origin } = new URL(contentUrl('pub-1'));

            const login = await app.handle(
                new Request(`${origin}/login`, { headers: { Cookie: 'auth=session', Origin: 'https://evil.example' } }),
            );
            const content = await app.handle(new Request(contentUrl('pub-1'), { headers: { Cookie: 'auth=session' } }));

            expect(login.status).toBe(404);
            expect(login.headers.get('Set-Cookie')).toBeNull();
            expect(login.headers.get('Access-Control-Allow-Credentials')).toBeNull();
            expect(content.status).toBe(200);
            expect(content.headers.get('Set-Cookie')).toBeNull();
            expect(content.headers.get('Access-Control-Allow-Credentials')).toBeNull();
            expect(content.headers.get('Access-Control-Allow-Origin')).toBe(APP);
            expect(reachedApp).toEqual([]);
        });

        it('refuses a WebSocket upgrade on a content host and accepts it on the application host', async () => {
            const open = (host: string) =>
                new Promise<string>(resolve => {
                    // Bun's WebSocket accepts request headers; the DOM typings do not know that.
                    const socket = new (WebSocket as unknown as new (url: string, init: object) => WebSocket)(
                        `ws://127.0.0.1:${listening.port}/yjs/project-1`,
                        { headers: { Host: host } },
                    );
                    socket.onopen = () => {
                        socket.close();
                        resolve('open');
                    };
                    socket.onerror = () => resolve('refused');
                });

            expect(await open(`app.test:${listening.port}`)).toBe('open');
            expect(await open(new URL(contentUrl('pub-1')).host)).toBe('refused');
            expect(reachedApp).toEqual(['/yjs/project-1']);
        });
    });
});
