import { test, expect } from '../fixtures/static.fixture';
import { waitForAppReady, openElpFile } from '../helpers/workarea-helpers';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/really-simple-test-project.elpx');
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('DOWNLOAD-03: real download contains edited metadata and exact asset bytes and can be reimported', async ({
    staticPage: page,
    browser,
}, info) => {
    await waitForAppReady(page);
    await openElpFile(page, FIXTURE);
    await page.evaluate(async bytes => {
        const bridge = (window as any).eXeLearning.app.project._yjsBridge;
        const assetUrl = await bridge.assetManager.insertImage(
            new File([new Uint8Array(bytes)], 'receipt.png', { type: 'image/png' }),
        );
        bridge.documentManager.getMetadata().set('title', 'Download receipt test');
        bridge.documentManager.getMetadata().set('description', assetUrl);
    }, Array.from(PNG));
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#head-top-save-button').click();
    const download = await downloadEvent;
    const output = info.outputPath('receipt.elpx');
    await download.saveAs(output);
    expect(await download.failure()).toBeNull();
    const entries = unzipSync(readFileSync(output));
    expect(strFromU8(entries['content.xml'])).toContain('Download receipt test');
    expect(
        Object.entries(entries).some(([name, bytes]) => name.includes('resources/') && hash(bytes) === hash(PNG)),
    ).toBe(true);
    await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);
    expect(await page.evaluate(() => (window as any).UnsavedChangesHelper.hasUnsavedChanges())).toBe(true);

    // A fresh browser context proves reimport from the downloaded package, not
    // a stale Y.Doc or an existing Cache API entry in the exporting session.
    const context = await browser.newContext();
    try {
        const reopened = await context.newPage();
        await reopened.goto(new URL('/', page.url()).href);
        await waitForAppReady(reopened);
        await openElpFile(reopened, output);
        const imported = await reopened.evaluate(async () => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            const asset = bridge.assetManager
                .getAllAssetsMetadata()
                .find((item: any) => item.filename === 'receipt.png');
            const blob = asset && (await bridge.assetManager.getBlob(asset.id));
            return {
                title: metadata.get('title'),
                description: metadata.get('description'),
                assetBytes: blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : null,
                text: JSON.stringify(bridge.documentManager.getDoc().getArray('navigation').toJSON()),
            };
        });
        expect(imported.title).toBe('Download receipt test');
        expect(imported.description).toContain('asset://');
        expect(imported.assetBytes).toEqual(Array.from(PNG));
        expect(imported.text).toContain('Lorem ipsum');
    } finally {
        await context.close();
    }
});

test('LEAVE-13: cancelling the controlled Electron bridge keeps the original project and warning', async ({
    staticPage: page,
}) => {
    await waitForAppReady(page);
    await page.waitForFunction(
        () => (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager?._initialized,
    );
    await page.evaluate(() => {
        const bridge = (window as any).eXeLearning.app.project._yjsBridge;
        bridge.documentManager.getMetadata().set('title', 'Keep this project');
        // This is a controlled IPC double, not a native picker or permission test.
        (window as any).electronAPI = { saveBuffer: async () => ({ saved: false, canceled: true }) };
    });
    await page.locator('#dropdownFile').click();
    await page.locator('#navbar-button-new').click();
    const modal = page.locator('#modalSessionLogout');
    await expect(modal).toBeVisible();
    await modal.locator('button.session-logout-save').click();
    await expect(page.locator('#modalAlert')).toBeVisible();
    const state = await page.evaluate(() => {
        const bridge = (window as any).eXeLearning.app.project._yjsBridge;
        return {
            title: bridge.documentManager.getMetadata().get('title'),
            dirty: bridge.documentManager.isDirty,
            guarded: !!(window as any).UnsavedChangesHelper._beforeUnloadHandler,
        };
    });
    expect(state).toEqual({ title: 'Keep this project', dirty: true, guarded: true });
    await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);
});
