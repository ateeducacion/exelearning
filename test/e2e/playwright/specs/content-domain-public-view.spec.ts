import { test, expect, type Frame, type Page } from '@playwright/test';
import {
    APP,
    APP_ORIGIN,
    BASE_PATH,
    CONTENT_DOMAIN,
    contentHostPattern,
    createGuestProject,
} from '../helpers/content-domain';

/**
 * Public view on a content domain (EXE_CONTENT_DOMAIN).
 *
 * With the mode on, published author content is served from
 * `http://<label>.exe-content.localhost:3003`, a different site from the
 * application (`http://exe-app.localhost:3003`), with one label per published
 * project. These tests run against the second dynamic server declared in
 * playwright.config.ts, which also sets BASE_PATH=/exe. The default server keeps
 * the mode off; public-view-sandbox.spec.ts covers it unchanged.
 */
/** Log in as a guest, create a project and publish it. Returns its public view id. */
async function publishProject(page: Page, title: string): Promise<string> {
    const uuid = await createGuestProject(page, title);
    return page.evaluate(async projectUuid => {
        const published = await fetch(`api/projects/uuid/${projectUuid}/public-view`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true }),
        });
        return (await published.json()).publicViewId as string;
    }, uuid);
}

/** Open the public viewer and return the content frame and its URL. */
async function openPublicView(page: Page, publicViewId: string): Promise<{ frame: Frame; src: URL }> {
    await page.goto(`${APP}/view/${publicViewId}`);
    const iframe = page.locator('#viewer-iframe');
    await expect(iframe).toBeVisible();
    const src = new URL((await iframe.getAttribute('src')) ?? '');
    const frame = await (await iframe.elementHandle())?.contentFrame();
    if (!frame) throw new Error('The viewer iframe has no content frame');
    await frame.waitForLoadState('load');
    return { frame, src };
}

/** HTTP status the browser gets when it navigates to a URL. */
async function statusOf(page: Page, url: string): Promise<number | undefined> {
    return (await page.goto(url))?.status();
}

test.describe('Public view on a content domain', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(testInfo.project.name.includes('static'), 'Needs the server');
        test.skip(!!process.env.E2E_BASE_URL, 'Needs the content-domain server started by playwright.config.ts');
    });

    test('published content runs on its own origin and cannot reach the application', async ({ page, context }) => {
        const publicViewId = await publishProject(page, 'Content domain project');
        const { frame, src } = await openPublicView(page, publicViewId);

        // The iframe points at a label under the content domain, below BASE_PATH.
        expect(src.host).toMatch(contentHostPattern('v'));
        expect(src.pathname.startsWith(`${BASE_PATH}/content/`)).toBe(true);

        const iframe = page.locator('#viewer-iframe');
        const sandbox = (await iframe.getAttribute('sandbox')) ?? '';
        expect(sandbox).toContain('allow-same-origin');
        expect(sandbox).not.toContain('allow-top-navigation');
        expect(sandbox).not.toContain('allow-modals');
        expect(await iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');

        // The application session exists and is HttpOnly on the application host.
        const appCookies = await context.cookies(APP);
        expect(appCookies.some(cookie => cookie.name === 'auth')).toBe(true);

        const probe = await frame.evaluate(async () => {
            const out = {
                origin: String(window.origin),
                parentBlocked: false,
                cookie: document.cookie,
                nested: '',
                srcdoc: '',
            };
            try {
                void window.parent.location.href;
            } catch {
                out.parentBlocked = true;
            }
            // A frame nested in the content keeps a real origin (it would be 'null' in the opaque mode).
            const load = (configure: (frame: HTMLIFrameElement) => void) =>
                new Promise<string>(resolve => {
                    const nested = document.createElement('iframe');
                    nested.addEventListener('load', () => {
                        try {
                            resolve(String(nested.contentWindow?.origin));
                        } catch (error) {
                            resolve(`blocked: ${(error as Error).name}`);
                        }
                    });
                    configure(nested);
                    document.body.appendChild(nested);
                });
            out.nested = await load(nested => {
                nested.src = location.href;
            });
            out.srcdoc = await load(nested => {
                nested.srcdoc = '<p>nested</p>';
            });
            return out;
        });

        expect(probe.origin).toBe(src.origin);
        expect(probe.origin).not.toBe('null');
        expect(probe.origin).not.toBe(APP_ORIGIN);
        expect(probe.parentBlocked).toBe(true);
        expect(probe.cookie).not.toContain('auth');
        expect(probe.cookie).toBe('');
        expect(probe.nested).toBe(src.origin);
        expect(probe.srcdoc).toBe(src.origin);

        // The content response names the application origin as the only other allowed embedder.
        const headers = (await page.goto(src.href))?.headers() ?? {};
        expect(headers['content-security-policy']).toContain(`frame-ancestors 'self' ${APP_ORIGIN}`);
        expect(headers['content-security-policy']).toContain("object-src 'none'");
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['permissions-policy']).toContain('camera=()');
        expect(headers['set-cookie']).toBeUndefined();
    });

    test('localStorage works and is not shared between two published projects', async ({ page }) => {
        const first = await publishProject(page, 'Storage project A');
        const second = await publishProject(page, 'Storage project B');

        const a = await openPublicView(page, first);
        expect(
            await a.frame.evaluate(() => {
                localStorage.setItem('exe-content-domain-probe', 'from A');
                return localStorage.getItem('exe-content-domain-probe');
            }),
        ).toBe('from A');

        const b = await openPublicView(page, second);
        expect(b.src.origin).not.toBe(a.src.origin);
        expect(await b.frame.evaluate(() => localStorage.getItem('exe-content-domain-probe'))).toBeNull();

        // The value is still there for the project that wrote it.
        const again = await openPublicView(page, first);
        expect(again.src.origin).toBe(a.src.origin);
        expect(await again.frame.evaluate(() => localStorage.getItem('exe-content-domain-probe'))).toBe('from A');
    });

    test('a content host serves only its own content: label mismatch and application routes return 404', async ({
        page,
    }) => {
        const first = await publishProject(page, 'Routing project A');
        const second = await publishProject(page, 'Routing project B');
        const a = await openPublicView(page, first);
        const b = await openPublicView(page, second);

        // Sanity: each content URL answers on its own host.
        expect(await statusOf(page, a.src.href)).toBe(200);

        // Project A's content requested on project B's host, and the reverse.
        expect(await statusOf(page, b.src.origin + a.src.pathname)).toBe(404);
        expect(await statusOf(page, a.src.origin + b.src.pathname)).toBe(404);
        // A well-formed label nobody derived, and the bare content domain.
        expect(await statusOf(page, `http://v${'0'.repeat(40)}.${CONTENT_DOMAIN}${a.src.pathname}`)).toBe(404);
        expect(await statusOf(page, `http://${CONTENT_DOMAIN}${a.src.pathname}`)).toBe(404);

        // Application routes do not exist on a content host, with or without BASE_PATH.
        for (const route of [
            '/login',
            '/workarea',
            '/admin',
            '/api/session/check',
            '/api/v1/projects',
            `/view/${first}`,
            `/view/${first}/_/index.html`,
            '/preview-sw.js',
            '/app/app.bundle.js',
        ]) {
            expect(await statusOf(page, a.src.origin + BASE_PATH + route), route).toBe(404);
            expect(await statusOf(page, a.src.origin + route), route).toBe(404);
        }

        // Nor do WebSocket upgrades.
        await page.goto(a.src.href);
        const upgrade = await page.evaluate(
            path =>
                new Promise<string>(resolve => {
                    const socket = new WebSocket(`ws://${location.host}${path}`);
                    socket.onopen = () => resolve('open');
                    socket.onerror = () => resolve('refused');
                }),
            `${BASE_PATH}/yjs/project-00000000-0000-0000-0000-000000000000`,
        );
        expect(upgrade).toBe('refused');
    });

    test('the application host keeps its opaque-origin content route and has no content-domain route', async ({
        page,
    }) => {
        const publicViewId = await publishProject(page, 'Opaque route project');
        const { src } = await openPublicView(page, publicViewId);

        const opaque = await page.goto(`${APP}/view/${publicViewId}/_/index.html`);
        expect(opaque?.status()).toBe(200);
        const csp = opaque?.headers()['content-security-policy'] ?? '';
        expect(csp).toContain('sandbox allow-scripts');
        expect(csp).not.toContain('allow-same-origin');
        expect(await page.evaluate(() => String(window.origin))).toBe('null');

        // Content-domain URLs are not served by the application host.
        expect(await statusOf(page, APP_ORIGIN + src.pathname)).toBe(404);
    });

    test('shows an error instead of falling back when the content host does not answer', async ({ page }) => {
        const publicViewId = await publishProject(page, 'No downgrade project');

        const requested: string[] = [];
        page.on('request', request => requested.push(request.url()));
        await page.route(`http://*.${CONTENT_DOMAIN}/**`, route => route.abort('connectionrefused'));

        await page.goto(`${APP}/view/${publicViewId}`);

        await expect(page.locator('#loader-text')).toHaveAttribute('role', 'alert');
        await expect(page.locator('#loader-text')).not.toBeEmpty();
        await expect(page.locator('#viewer-iframe')).toHaveCount(0);
        // The content was never requested from the application origin.
        expect(requested.some(url => url.startsWith(`${APP}/view/${publicViewId}/_/`))).toBe(false);
    });
});
