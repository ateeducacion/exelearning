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

    const author = page.locator('#learningmlIdeviceForm');
    const tab = (name: string) => author.locator('.exe-form-tabs a', { hasText: name }).click();
    await expect(author.locator('.exe-form-tabs a')).toHaveText([
        'General settings',
        'Classes',
        'Grading',
        'Custom texts',
    ]);
    await author.locator('[data-field="algorithm"]').selectOption('naive-bayes');
    await tab('Classes');
    const rows = author.locator('.lml-author-class');
    await rows.nth(0).locator('[data-class-field="name"]').fill('Hello');
    await rows.nth(0).locator('[data-class-field="examples"]').fill('hello friend\ngood morning');
    await rows.nth(0).locator('[data-class-field="tests"]').fill('hello there\ngood morning teacher');
    await rows.nth(1).locator('[data-class-field="name"]').fill('Bye');
    await rows.nth(1).locator('[data-class-field="examples"]').fill('goodbye friend');
    await rows.nth(1).locator('[data-class-field="tests"]').fill('see you tomorrow\ngoodbye');
    await tab('Grading');
    await author.locator('#eXeGameSCORMAutoSave').check();
    await author.locator('#eXeGameSCORMWeight').fill('50');
    await tab('Custom texts');
    await author.locator('#ci18n_msgCheck').fill('Check the model');
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
        .toMatchObject({
            algorithm: 'naive-bayes',
            isScorm: 1,
            weighted: 50,
            classes: [{ name: 'Hello' }, { name: 'Bye' }],
            msgs: { msgCheck: 'Check the model' },
        });
    await expect(page.locator('.idevice_node.learningml .lml-column h4')).toHaveText([
        '1. Training data',
        '2. Train',
        '3. Result',
    ]);

    await editIdevice(page, id!);
    await tab('Classes');
    await expect(rows.nth(1).locator('[data-class-field="tests"]')).toHaveValue('see you tomorrow\ngoodbye');
    await tab('Grading');
    await expect(author.locator('#eXeGameSCORMAutoSave')).toBeChecked();
    await saveIdevice(page, id!);

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await openPreviewPanel(page);
    const preview = await getPreviewFrame(page);
    await expect(preview.locator('.lml-activity .lml-column')).toHaveCount(3);
    await page.locator('#previewsidenavclose').click();

    const files = await exported(page, 'scorm12');
    expect(files['imsmanifest.xml']).toBeDefined();
    expect(files['idevices/learningml/learningml.js']).toBeDefined();
    expect(files['idevices/learningml/learningml-mobilenet.js']).toBeDefined();
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
    await activity.getByRole('button', { name: 'Check the model', exact: true }).click();
    await expect(activity.locator('.lml-score')).toHaveText('Score: 100/100. Passed.');
    await expect.poll(() => offline.evaluate(() => Number((window as any).API.cmi.core.score.raw))).toBe(100);
    await expect.poll(() => offline.evaluate(() => (window as any).API.cmi.core.lesson_status)).toBe('passed');

    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
    await offline.close();
});

test('loads the insects example and classifies photos offline with the MobileNet extractor', async ({
    authenticatedPage: page,
    createProject,
}, testInfo) => {
    const shot = async (locator: ReturnType<Page['locator']>, name: string) => {
        const path = testInfo.outputPath(`${name}.png`);
        await locator.screenshot({ path });
        await testInfo.attach(name, { path, contentType: 'image/png' });
    };
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const uuid = await createProject(page, 'LearningML images');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'learningml');
    const author = page.locator('#learningmlIdeviceForm');
    await author.locator('[data-field="algorithm"]').selectOption('knn');
    await author.locator('[data-field="example"]').selectOption('insectos');
    await author.locator('[data-action="load-example"]').click();
    await author.locator('.exe-form-tabs a', { hasText: 'Classes' }).click();
    await expect(author.locator('.lml-author-class')).toHaveCount(4);
    await expect(author.locator('.lml-author-class').first().locator('.lml-images img')).toHaveCount(11);
    await expect(author.locator('.lml-size')).toContainText('/ 280 kB');
    await shot(author, 'learningml-editor-classes');
    const id = await page.locator('.idevice_node.learningml').getAttribute('id');
    await saveIdevice(page, id!);

    const view = page.locator(`.idevice_node[id="${id}"] .lml-activity`);
    await expect(view.locator('.lml-class')).toHaveCount(4);
    const photo = await view.locator('.lml-class').first().locator('img').first().getAttribute('src');
    await view.getByRole('button', { name: 'Train the model', exact: true }).click();
    await expect(view.locator('.lml-status')).toHaveText('Model trained with 32 examples.', { timeout: 30000 });
    await view.getByLabel('Image to classify').setInputFiles({
        name: 'probe.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(photo!.split(',')[1], 'base64'),
    });
    await expect(view.locator('.lml-prediction')).toHaveText('The model says: hormiga');
    await expect(view.locator('.lml-bar')).toHaveCount(4);
    await view.getByRole('button', { name: 'Check my model', exact: true }).click();
    await expect(view.locator('.lml-score')).toContainText('Score: ');
    await shot(view, 'learningml-images-learner');
    expect(errors).toEqual([]);
});
