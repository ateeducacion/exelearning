import { test, expect, type Page } from '@playwright/test';
import { APP, APP_ORIGIN, BASE_PATH, contentHostPattern, createGuestProject } from '../helpers/content-domain';
import { addTextIdevice, selectFirstPage, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Workarea preview on a content domain (EXE_CONTENT_DOMAIN).
 *
 * With the mode on, the preview iframe shows a host page on the content origin of the
 * open project (`http://p<hash>.exe-content.localhost:3003`). The workarea posts the
 * generated export to it over a MessageChannel and that origin's own Service Worker
 * serves it to a frame nested in the host page. Author scripts therefore run on the
 * content origin, not on the editor's.
 *
 * Runs against the second dynamic server declared in playwright.config.ts
 * (BASE_PATH=/exe). The mode-off preview is covered by the existing preview specs.
 */

/**
 * An author script, as a teacher could paste it. It records what it can reach in an
 * attribute of its own document, where the test reads it.
 */
const AUTHOR_SCRIPT = `<script>
(async function () {
    var out = { origin: String(window.origin) };
    var reach = function (name, read) {
        try { out[name] = String(read()); } catch (e) { out[name] = 'blocked:' + e.name; }
    };
    reach('topTitle', function () { return window.top.document.title; });
    reach('topBody', function () { return window.top.document.body.innerHTML.length; });
    reach('topApp', function () { return typeof window.top.eXeLearning; });
    reach('topCookie', function () { return window.top.document.cookie; });
    reach('opener', function () { return window.top.opener === null ? 'none' : 'window'; });
    out.cookie = document.cookie;
    try {
        var dbs = await indexedDB.databases();
        out.databases = dbs.map(function (db) { return db.name; });
    } catch (e) { out.databases = 'error:' + e.name; }
    try {
        var response = await fetch(${JSON.stringify(`${APP}/api/session/check`)}, { credentials: 'include' });
        out.session = response.status + ':' + (await response.text()).slice(0, 200);
    } catch (e) { out.session = 'blocked:' + e.name; }
    out.controlled = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    document.documentElement.setAttribute('data-author-probe', JSON.stringify(out));
})();
</script>`;

async function openWorkarea(page: Page, title: string): Promise<string> {
    const uuid = await createGuestProject(page, title);
    await page.goto(`${APP}/workarea?project=${uuid}`);
    await waitForAppReady(page);
    return uuid;
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

test.describe('Workarea preview on a content domain', () => {
    test.beforeEach(async ({}, testInfo) => {
        test.skip(testInfo.project.name.includes('static'), 'Needs the server');
        test.skip(!!process.env.E2E_BASE_URL, 'Needs the content-domain server started by playwright.config.ts');
    });

    test('an author script runs on the content origin and cannot read the editor', async ({ page }) => {
        await openWorkarea(page, 'Content domain preview');

        // The server gives the workarea the content origin of the open project.
        const hostUrl = new URL(
            await page.evaluate(() => (window as any).eXeLearning.config.previewContentHostUrl as string),
        );
        expect(hostUrl.host).toMatch(contentHostPattern('p'));
        expect(hostUrl.pathname.startsWith(`${BASE_PATH}/content/`)).toBe(true);

        await selectFirstPage(page);
        await addTextIdeviceWithHtml(page, `<p>Author content marker</p>${AUTHOR_SCRIPT}`);

        // Names of the editor's own databases, to compare with what the content can list.
        const editorDatabases = await page.evaluate(async () => (await indexedDB.databases()).map(db => db.name));
        expect(editorDatabases.length).toBeGreaterThan(0);

        await page.click('#head-bottom-preview');
        await expect(page.locator('#previewsidenav')).toBeVisible();

        // The preview iframe holds the host page; the content is the frame nested in it.
        const previewIframe = page.locator('#preview-iframe');
        await expect(previewIframe).toHaveAttribute('src', hostUrl.href);
        const content = page.frameLocator('#preview-iframe').frameLocator('#preview-content');
        await expect(content.getByText('Author content marker')).toBeVisible({ timeout: 30000 });

        const root = content.locator('html');
        await expect(root).toHaveAttribute('data-author-probe', /origin/, { timeout: 15000 });
        const probe = JSON.parse((await root.getAttribute('data-author-probe')) ?? '{}');

        // The script ran, on the project's content origin, served by that origin's worker.
        expect(probe.origin).toBe(hostUrl.origin);
        expect(probe.origin).not.toBe(APP_ORIGIN);
        expect(probe.controlled).toBe(true);

        // It cannot read the editor's DOM or globals.
        expect(probe.topTitle).toMatch(/^blocked:/);
        expect(probe.topBody).toMatch(/^blocked:/);
        expect(probe.topApp).toMatch(/^blocked:/);

        // Nor its cookies: none of its own, none through the editor window, none sent along.
        expect(probe.cookie).toBe('');
        expect(probe.topCookie).toMatch(/^blocked:/);
        expect(probe.session).not.toContain('"authenticated":true');

        // Nor its IndexedDB: the content origin has its own, without the editor's databases.
        expect(Array.isArray(probe.databases)).toBe(true);
        for (const name of editorDatabases) {
            expect(probe.databases).not.toContain(name);
        }

        // The viewer path of the editor origin was never used for this preview.
        const viewerUrl = await content.locator('html').evaluate(() => location.href);
        expect(new URL(viewerUrl).origin).toBe(hostUrl.origin);
        expect(new URL(viewerUrl).pathname).toContain('/viewer/');
    });

    test('the preview follows edits and survives a manual refresh', async ({ page }) => {
        await openWorkarea(page, 'Content domain preview updates');
        await selectFirstPage(page);
        await addTextIdeviceWithHtml(page, '<p>First version of the content</p>');

        await page.click('#head-bottom-preview');
        const content = page.frameLocator('#preview-iframe').frameLocator('#preview-content');
        await expect(content.getByText('First version of the content')).toBeVisible({ timeout: 30000 });

        await page.click('#preview-refresh-button');
        await expect(content.getByText('First version of the content')).toBeVisible({ timeout: 30000 });
    });

    test('the preview opens in a new tab, still on the content origin and without the editor', async ({ page }) => {
        await openWorkarea(page, 'Content domain preview tab');
        const hostUrl = new URL(
            await page.evaluate(() => (window as any).eXeLearning.config.previewContentHostUrl as string),
        );
        await selectFirstPage(page);
        await addTextIdeviceWithHtml(page, `<p>First version of the content</p>${AUTHOR_SCRIPT}`);
        await page.click('#head-bottom-preview');
        const panelContent = page.frameLocator('#preview-iframe').frameLocator('#preview-content');
        await expect(panelContent.getByText('First version of the content')).toBeVisible({ timeout: 30000 });

        const [tab] = await Promise.all([page.waitForEvent('popup'), page.click('#preview-extract-button')]);

        // The tab is an empty page of the editor origin. Its only element is a sandboxed frame
        // with the host page of the content origin, as in the panel.
        const frame = tab.locator('iframe');
        await expect(frame).toHaveAttribute('src', hostUrl.href);
        expect(tab.url()).toBe('about:blank');
        expect(await tab.evaluate(() => window.origin)).toBe(APP_ORIGIN);
        expect(await frame.getAttribute('sandbox')).toBe(await page.locator('#preview-iframe').getAttribute('sandbox'));
        expect(await frame.getAttribute('sandbox')).not.toContain('allow-top-navigation');
        expect(await frame.getAttribute('sandbox')).not.toContain('allow-popups-to-escape-sandbox');

        const content = tab.frameLocator('iframe').frameLocator('#preview-content');
        await expect(content.getByText('First version of the content')).toBeVisible({ timeout: 30000 });
        const readProbe = async () => {
            const root = content.locator('html');
            await expect(root).toHaveAttribute('data-author-probe', /origin/, { timeout: 15000 });
            return JSON.parse((await root.getAttribute('data-author-probe')) ?? '{}');
        };
        const probe = await readProbe();
        expect(probe.origin).toBe(hostUrl.origin);
        expect(probe.controlled).toBe(true);
        expect(probe.topTitle).toMatch(/^blocked:/);
        expect(probe.topApp).toMatch(/^blocked:/);
        expect(probe.topCookie).toMatch(/^blocked:/);
        expect(probe.cookie).toBe('');
        // The tab keeps no reference to the editor window that opened it.
        expect(probe.opener).toBe('none');
        expect(await tab.evaluate(() => window.opener)).toBeNull();

        // Reloading the tab empties it. The editor puts the preview back, with what was edited
        // meanwhile, although the panel is closed.
        await page.click('#previewsidenavclose');
        await expect(page.locator('#previewsidenav')).not.toHaveClass(/active/);
        await addTextIdeviceWithHtml(page, '<p>Second version of the content</p>');
        await tab.reload();
        await expect(content.getByText('Second version of the content')).toBeVisible({ timeout: 30000 });
        expect((await readProbe()).opener).toBe('none');

        // A refresh of the panel reaches the tab too.
        await addTextIdeviceWithHtml(page, '<p>Third version of the content</p>');
        await page.click('#head-bottom-preview');
        await expect(panelContent.getByText('Third version of the content')).toBeVisible({ timeout: 30000 });
        await expect(content.getByText('Third version of the content')).toBeVisible({ timeout: 30000 });
    });

    test('the workarea ignores preview messages that do not come from the content origin', async ({ page }) => {
        await openWorkarea(page, 'Content domain preview messages');
        await selectFirstPage(page);
        await addTextIdeviceWithHtml(page, '<p>Message test content</p>');
        await page.click('#head-bottom-preview');
        const content = page.frameLocator('#preview-iframe').frameLocator('#preview-content');
        await expect(content.getByText('Message test content')).toBeVisible({ timeout: 30000 });

        // A "ready" announcement posted by the editor itself (wrong source and origin) must
        // not become the preview channel: the next refresh sends nothing through its port.
        await page.evaluate(() => {
            const channel = new MessageChannel();
            (window as any).__forgedPortMessages = 0;
            channel.port2.onmessage = () => {
                (window as any).__forgedPortMessages += 1;
            };
            window.postMessage({ type: 'exe-preview-host-ready' }, location.origin, [channel.port1]);
        });
        const shownAgain = page.waitForEvent('framenavigated', frame => frame.url().includes('/viewer/index.html'));
        await page.click('#preview-refresh-button');
        await shownAgain;
        expect(await page.evaluate(() => (window as any).__forgedPortMessages)).toBe(0);
        await expect(content.getByText('Message test content')).toBeVisible();
    });
});
