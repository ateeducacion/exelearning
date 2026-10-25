/** LearningML authoring, preview and offline SCORM 1.2 package acceptance. */
import { test, expect } from '../fixtures/auth.fixture';
import {
    gotoWorkarea,
    waitForAppReady,
    selectFirstPage,
    addIdevice,
    saveIdevice,
    editIdevice,
    openPreviewPanel,
    getPreviewFrame,
} from '../helpers/workarea-helpers';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

async function exported(page: Page, format: string): Promise<Record<string, Uint8Array>> {
    const base64 = await page.evaluate(async format => {
        const w = window as any;
        const bridge = w.eXeLearning.app.project._yjsBridge;
        const result = await w.SharedExporters.quickExport(
            format,
            bridge.documentManager,
            bridge.assetCache || null,
            bridge.resourceFetcher || null,
            {},
            bridge.assetManager || null,
        );
        if (!result.success) throw new Error(result.error);
        const bytes = new Uint8Array(result.data);
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
    }, format);
    return unzipSync(new Uint8Array(Buffer.from(base64, 'base64')));
}

test('authors, previews and grades a LearningML text classifier in an offline SCORM 1.2 package', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const uuid = await createProject(page, 'LearningML acceptance');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'learningml');

    const author = page.locator('.lml-author');
    await author.locator('[data-field="title"]').fill('Greetings');
    await author.locator('[data-field="instructions"]').fill('Teach the model to tell greetings from farewells.');
    const rows = author.locator('.lml-author-class');
    await rows.nth(0).locator('[data-class-field="name"]').fill('Hello');
    await rows.nth(0).locator('[data-class-field="examples"]').fill('hello friend\ngood morning');
    await rows.nth(0).locator('[data-class-field="tests"]').fill('hello there\ngood morning teacher');
    await rows.nth(1).locator('[data-class-field="name"]').fill('Bye');
    await rows.nth(1).locator('[data-class-field="examples"]').fill('goodbye friend');
    await rows.nth(1).locator('[data-class-field="tests"]').fill('see you tomorrow\ngoodbye');
    await author.locator('[data-field="graded"]').check();
    await author.locator('[data-field="weight"]').fill('50');
    const id = await page.locator('.idevice_node.learningml').getAttribute('id');
    await saveIdevice(page, id!);
    await expect
        .poll(() =>
            page.evaluate(id => {
                const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(id);
                return typeof component?.jsonProperties === 'string'
                    ? JSON.parse(component.jsonProperties)
                    : component?.jsonProperties;
            }, id),
        )
        .toMatchObject({ title: 'Greetings', graded: true, weight: 50, classes: [{ name: 'Hello' }, { name: 'Bye' }] });
    await expect(page.locator('.idevice_node.learningml .lml-column h4')).toHaveText([
        '1. Training data',
        '2. Train',
        '3. Result',
    ]);

    await editIdevice(page, id!);
    await expect(author.locator('[data-field="title"]')).toHaveValue('Greetings');
    await expect(rows.nth(1).locator('[data-class-field="tests"]')).toHaveValue('see you tomorrow\ngoodbye');
    await saveIdevice(page, id!);

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await openPreviewPanel(page);
    const preview = await getPreviewFrame(page);
    await expect(preview.locator('.lml-activity .lml-column')).toHaveCount(3);
    await page.locator('#previewsidenavclose').click();

    const files = await exported(page, 'scorm12');
    expect(files['imsmanifest.xml']).toBeDefined();
    expect(files['idevices/learningml/learningml.js']).toBeDefined();
    expect(Object.keys(files).some(name => name.includes('learningml') && name.includes('/edition/'))).toBe(false);

    const offline = await page.context().newPage();
    const missing: string[] = [];
    offline.on('pageerror', error => errors.push(error.message));
    await offline.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'learningml.test') {
            missing.push(url.href);
            return route.abort();
        }
        if (url.pathname === '/launch')
            return route.fulfill({
                contentType: 'text/html',
                body: '<script src="/scorm-again.js"></script><script>window.API=new Scorm12API({autocommit:false,logLevel:5});</script><iframe src="/lms/package/index.html"></iframe>',
            });
        if (url.pathname === '/scorm-again.js')
            return route.fulfill({
                contentType: 'text/javascript',
                body: readFileSync('node_modules/scorm-again/dist/scorm12.min.js'),
            });
        const name = decodeURIComponent(url.pathname.replace('/lms/package/', ''));
        const data = files[name];
        if (!data) {
            missing.push(name);
            return route.fulfill({ status: 404, body: 'Missing package resource' });
        }
        const contentType = name.endsWith('.js')
            ? 'text/javascript'
            : name.endsWith('.css')
              ? 'text/css'
              : name.endsWith('.svg')
                ? 'image/svg+xml'
                : name.endsWith('.html')
                  ? 'text/html'
                  : 'application/octet-stream';
        return route.fulfill({ contentType, body: Buffer.from(data) });
    });
    await offline.goto('https://learningml.test/launch');
    const activity = offline.frameLocator('iframe').locator('.lml-activity');
    await expect(activity.locator('.lml-column')).toHaveCount(3);
    await expect.poll(() => offline.evaluate(() => (window as any).API.cmi.core.lesson_status)).toBe('incomplete');

    await activity.getByLabel('New example for Bye').fill('see you later');
    await activity.getByLabel('New example for Bye').press('Enter');
    await expect(activity.locator('.lml-class').nth(1).locator('li')).toHaveCount(2);
    await activity.getByRole('button', { name: 'Train the model', exact: true }).click();
    await expect(activity.locator('.lml-status')).toHaveText('Model trained with 4 examples.');
    await activity.getByLabel('Example to classify').fill('see you soon');
    await activity.getByRole('button', { name: 'Classify', exact: true }).click();
    await expect(activity.locator('.lml-prediction')).toHaveText('The model says: Bye');
    await activity.getByRole('button', { name: 'Check my model', exact: true }).click();
    await expect(activity.locator('.lml-score')).toHaveText('Score: 100/100. Passed.');
    await expect.poll(() => offline.evaluate(() => Number((window as any).API.cmi.core.score.raw))).toBe(100);
    await expect.poll(() => offline.evaluate(() => (window as any).API.cmi.core.lesson_status)).toBe('passed');

    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
    await offline.close();
});
