import { test, expect, type Frame, type Page } from '@playwright/test';
import {
    BASE_PATH,
    CONTENT_PROXY,
    createGuestProject,
    PROXY_APP,
    PROXY_APP_ORIGIN,
    PROXY_HOST_PATTERN,
} from '../helpers/content-domain';
import { addTextIdevice, selectFirstPage, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Author content through a content proxy (EXE_CONTENT_PROXY).
 *
 * The application (`http://exe-app.localhost:3004/exe`) has no content domain of its
 * own. It names a content proxy (`exe-proxy.localhost:3005`, src/content-proxy/index.ts),
 * which fetches the content from the application and serves each item on its own
 * origin, `http://x<hash of the source URL>.exe-proxy.localhost:3005`. Both run from
 * playwright.config.ts. The self-hosted content domain is covered by content-domain-*.spec.ts.
 */

/** Log in as a guest, create a project and publish it. Returns its public view id. */
async function publishProject(page: Page, title: string): Promise<string> {
    const uuid = await createGuestProject(page, title, PROXY_APP);
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
    await page.goto(`${PROXY_APP}/view/${publicViewId}`);
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

/** The source URL a proxied URL stands for. */
function sourceOf(proxied: URL): string {
    const [, prefix, ...rest] = proxied.pathname.split('/');
    return Buffer.from(prefix, 'base64url').toString('utf8') + rest.join('/');
}

/**
 * Add a text iDevice whose main text is `html`, and save it. The content goes to the
 * editor of the first textarea of the new iDevice, never to `tinymce.activeEditor`, which
 * can be the feedback editor.
 */
async function addTextIdeviceWithHtml(page: Page, html: string): Promise<void> {
    await addTextIdevice(page);
    const mainEditor = () => {
        const nodes = document.querySelectorAll('#node-content article .idevice_node.text');
        const node = nodes[nodes.length - 1];
        const textarea = node?.querySelector('textarea');
        const editor = textarea?.id ? (window as any).tinymce?.get(textarea.id) : null;
        return editor?.initialized && !editor.removed ? editor : null;
    };
    await page.waitForFunction(mainEditor, undefined, { timeout: 15000 });
    await page.evaluate(
        ([find, content]) => {
            const editor = new Function(`return (${find})()`)();
            editor.setContent(content);
            editor.fire('change');
            editor.setDirty(true);
        },
        [mainEditor.toString(), html],
    );
    const node = page.locator('#node-content article .idevice_node.text').last();
    await node.locator('.btn-save-idevice').click();
    await expect(node).not.toHaveAttribute('mode', 'edition', { timeout: 20000 });
}

/** An author script that records what it can reach in an attribute of its own document. */
const AUTHOR_SCRIPT = `<script>
(async function () {
    var out = { origin: String(window.origin) };
    var reach = function (name, read) {
        try { out[name] = String(read()); } catch (e) { out[name] = 'blocked:' + e.name; }
    };
    reach('topTitle', function () { return window.top.document.title; });
    reach('topApp', function () { return typeof window.top.eXeLearning; });
    reach('topCookie', function () { return window.top.document.cookie; });
    reach('opener', function () { return window.top.opener === null ? 'none' : 'window'; });
    out.cookie = document.cookie;
    try {
        var response = await fetch(${JSON.stringify(`${PROXY_APP}/api/session/check`)}, { credentials: 'include' });
        out.session = response.status + ':' + (await response.text()).slice(0, 200);
    } catch (e) { out.session = 'blocked:' + e.name; }
    out.controlled = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    document.documentElement.setAttribute('data-author-probe', JSON.stringify(out));
})();
</script>`;

test.describe('Author content through a content proxy', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(testInfo.project.name.includes('static'), 'Needs the server');
        test.skip(!!process.env.E2E_BASE_URL, 'Needs the content-proxy servers started by playwright.config.ts');
    });

    test('published content runs on the origin derived from its source and cannot reach the application', async ({
        page,
        context,
    }) => {
        const publicViewId = await publishProject(page, 'Content proxy project');
        const { frame, src } = await openPublicView(page, publicViewId);

        // The iframe points at the proxy; the path names the opaque content route of the application.
        expect(src.host).toMatch(PROXY_HOST_PATTERN);
        expect(sourceOf(src)).toBe(`${PROXY_APP}/view/${publicViewId}/_/index.html`);

        const sandbox = (await page.locator('#viewer-iframe').getAttribute('sandbox')) ?? '';
        expect(sandbox).toContain('allow-same-origin');
        expect(sandbox).not.toContain('allow-top-navigation');

        const appCookies = await context.cookies(PROXY_APP);
        expect(appCookies.some(cookie => cookie.name === 'auth')).toBe(true);

        const probe = await frame.evaluate(async app => {
            const out = { origin: String(window.origin), parentBlocked: false, cookie: document.cookie, session: '' };
            try {
                void window.parent.location.href;
            } catch {
                out.parentBlocked = true;
            }
            try {
                const response = await fetch(`${app}/api/session/check`, { credentials: 'include' });
                out.session = await response.text();
            } catch (error) {
                out.session = `blocked: ${(error as Error).name}`;
            }
            return out;
        }, PROXY_APP);

        expect(probe.origin).toBe(src.origin);
        expect(probe.origin).not.toBe(PROXY_APP_ORIGIN);
        expect(probe.parentBlocked).toBe(true);
        expect(probe.cookie).toBe('');
        expect(probe.session).not.toContain('"authenticated":true');

        // On the content origin the proxy applies the policy the application asked for.
        const headers = (await page.goto(src.href))?.headers() ?? {};
        expect(headers['content-security-policy']).toContain('allow-same-origin');
        expect(headers['content-security-policy']).toContain(`frame-ancestors 'self' ${PROXY_APP_ORIGIN}`);
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['set-cookie']).toBeUndefined();
        expect(headers['x-exe-content-proxy']).toBeUndefined();
    });

    test('each published project has its own origin and its own storage', async ({ page }) => {
        const first = await publishProject(page, 'Proxy storage A');
        const second = await publishProject(page, 'Proxy storage B');

        const a = await openPublicView(page, first);
        await a.frame.evaluate(() => localStorage.setItem('exe-content-proxy-probe', 'from A'));

        const b = await openPublicView(page, second);
        expect(b.src.origin).not.toBe(a.src.origin);
        expect(await b.frame.evaluate(() => localStorage.getItem('exe-content-proxy-probe'))).toBeNull();

        const again = await openPublicView(page, first);
        expect(again.src.origin).toBe(a.src.origin);
        expect(await again.frame.evaluate(() => localStorage.getItem('exe-content-proxy-probe'))).toBe('from A');
    });

    test('an origin serves only its own source', async ({ page }) => {
        const first = await publishProject(page, 'Proxy routing A');
        const second = await publishProject(page, 'Proxy routing B');
        const a = await openPublicView(page, first);
        const b = await openPublicView(page, second);

        expect(await statusOf(page, a.src.href)).toBe(200);

        // Project A's source on project B's origin, and the reverse.
        expect(await statusOf(page, b.src.origin + a.src.pathname)).toBe(404);
        expect(await statusOf(page, a.src.origin + b.src.pathname)).toBe(404);

        // Leaving the source through the path: the other project, and application pages.
        const [, prefix] = a.src.pathname.split('/');
        for (const rest of [`..%2f..%2f${second}%2f_%2findex.html`, '..%2f..%2f..%2flogin', '%2e%2e/%2e%2e/login']) {
            expect(await statusOf(page, `${a.src.origin}/${prefix}/${rest}`), rest).toBe(404);
        }

        // An application page is not a content source, whatever origin is derived for it.
        const login = await page.evaluate(
            async ([app, proxy]) => {
                const source = `${app}/`;
                const digest = await crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(`exe-content-proxy-v1\n${source}`),
                );
                const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
                const token = btoa(source).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                return `http://x${hex.slice(0, 40)}.${proxy}/${token}/login`;
            },
            [PROXY_APP, CONTENT_PROXY],
        );
        expect(await statusOf(page, login)).toBe(502);
    });

    test('the source stays opaque when it is opened on the application host', async ({ page }) => {
        const publicViewId = await publishProject(page, 'Proxy opaque source');

        const opaque = await page.goto(`${PROXY_APP}/view/${publicViewId}/_/index.html`);
        expect(opaque?.status()).toBe(200);
        const csp = opaque?.headers()['content-security-policy'] ?? '';
        expect(csp).toContain('sandbox allow-scripts');
        expect(csp).not.toContain('allow-same-origin');
        expect(await page.evaluate(() => String(window.origin))).toBe('null');

        // So does the preview host page: sandboxed without scripts, it does nothing there.
        const host = await page.goto(`${PROXY_APP}/preview-host/00000000-0000-0000-0000-000000000000/host.html`);
        expect(host?.status()).toBe(200);
        expect(host?.headers()['content-security-policy']).toBe('sandbox');
        expect(await page.evaluate(() => String(window.origin))).toBe('null');
    });

    test('shows an error instead of falling back when the proxy does not answer', async ({ page }) => {
        const publicViewId = await publishProject(page, 'Proxy no downgrade');

        const requested: string[] = [];
        page.on('request', request => requested.push(request.url()));
        await page.route(`http://*.${CONTENT_PROXY}/**`, route => route.abort('connectionrefused'));

        await page.goto(`${PROXY_APP}/view/${publicViewId}`);

        await expect(page.locator('#loader-text')).toHaveAttribute('role', 'alert');
        await expect(page.locator('#viewer-iframe')).toHaveCount(0);
        expect(requested.some(url => url.startsWith(`${PROXY_APP}/view/${publicViewId}/_/`))).toBe(false);
    });

    test('the workarea preview runs on the content origin of the project', async ({ page }) => {
        const uuid = await createGuestProject(page, 'Content proxy preview', PROXY_APP);
        await page.goto(`${PROXY_APP}/workarea?project=${uuid}`);
        await waitForAppReady(page);

        const hostUrl = new URL(
            await page.evaluate(() => (window as any).eXeLearning.config.previewContentHostUrl as string),
        );
        expect(hostUrl.host).toMatch(PROXY_HOST_PATTERN);
        expect(sourceOf(hostUrl)).toBe(`${PROXY_APP}/preview-host/${uuid}/host.html`);
        expect(BASE_PATH).toBe('/exe');

        await selectFirstPage(page);
        await addTextIdeviceWithHtml(page, `<p>Author content marker</p>${AUTHOR_SCRIPT}`);

        await page.click('#head-bottom-preview');
        await expect(page.locator('#previewsidenav')).toBeVisible();
        await expect(page.locator('#preview-iframe')).toHaveAttribute('src', hostUrl.href);
        const content = page.frameLocator('#preview-iframe').frameLocator('#preview-content');
        await expect(content.getByText('Author content marker')).toBeVisible({ timeout: 30000 });

        const root = content.locator('html');
        await expect(root).toHaveAttribute('data-author-probe', /origin/, { timeout: 15000 });
        const probe = JSON.parse((await root.getAttribute('data-author-probe')) ?? '{}');

        expect(probe.origin).toBe(hostUrl.origin);
        expect(probe.controlled).toBe(true);
        expect(probe.topTitle).toMatch(/^blocked:/);
        expect(probe.topApp).toMatch(/^blocked:/);
        expect(probe.topCookie).toMatch(/^blocked:/);
        expect(probe.cookie).toBe('');
        expect(probe.session).not.toContain('"authenticated":true');

        await page.click('#preview-refresh-button');
        await expect(content.getByText('Author content marker')).toBeVisible({ timeout: 30000 });

        // In a new tab: an empty page of the editor origin with the same host page in a
        // sandboxed frame. The content stays on its origin and gets no reference to the editor.
        const [tab] = await Promise.all([page.waitForEvent('popup'), page.click('#preview-extract-button')]);
        await expect(tab.locator('iframe')).toHaveAttribute('src', hostUrl.href);
        expect(await tab.evaluate(() => window.origin)).toBe(PROXY_APP_ORIGIN);
        const tabContent = tab.frameLocator('iframe').frameLocator('#preview-content');
        const tabRoot = tabContent.locator('html');
        const readTabProbe = async () => {
            await expect(tabContent.getByText('Author content marker')).toBeVisible({ timeout: 30000 });
            await expect(tabRoot).toHaveAttribute('data-author-probe', /origin/, { timeout: 15000 });
            return JSON.parse((await tabRoot.getAttribute('data-author-probe')) ?? '{}');
        };
        const tabProbe = await readTabProbe();
        expect(tabProbe.origin).toBe(hostUrl.origin);
        expect(tabProbe.controlled).toBe(true);
        expect(tabProbe.topApp).toMatch(/^blocked:/);
        expect(tabProbe.opener).toBe('none');

        // A reloaded tab is filled again by the editor.
        await tab.reload();
        expect((await readTabProbe()).origin).toBe(hostUrl.origin);
    });
});
