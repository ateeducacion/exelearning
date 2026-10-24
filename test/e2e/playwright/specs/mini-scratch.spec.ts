/** Mini Scratch authoring and offline SCORM 1.2 package acceptance. */
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
    openElpFile,
    cloneCurrentPage,
} from '../helpers/workarea-helpers';
import { unzipSync } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

async function exported(page: Page, format: string, outputPath?: string): Promise<Record<string, Uint8Array>> {
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
    const data = new Uint8Array(Buffer.from(base64, 'base64'));
    if (outputPath) {
        writeFileSync(outputPath, data);
        console.info(`Mini Scratch sample SCORM package: ${data.length} bytes`);
    }
    return unzipSync(data);
}

test('creates, reopens, previews and exports a complete editable offline assignment', async ({
    authenticatedPage: page,
    createProject,
}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const uuid = await createProject(page, 'Mini Scratch acceptance');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'mini-scratch');
    const author = page.locator('.ms-author');
    await expect(author.getByRole('tab')).toHaveCount(4);
    await expect(author.getByRole('tab', { name: 'Activity', exact: true })).toHaveAttribute('aria-selected', 'true');
    await author.locator('[data-field="title"]').fill('Reach the flag');
    await author.locator('[data-field="instructions"]').fill('Reach the target at (4, 0).');
    await author.getByRole('tab', { name: 'Programming', exact: true }).click();
    await expect(author.locator('.blocklySvg')).toBeVisible();
    await author.getByRole('tab', { name: 'Assessment', exact: true }).click();
    await author.locator('[data-field="targetX"]').fill('4');
    await author.locator('[data-field="maxAttempts"]').fill('3');
    await author.locator('[data-field="weight"]').fill('25');
    const id = await page.locator('.idevice_node.mini-scratch').getAttribute('id');
    await author.getByRole('tab', { name: 'Preview', exact: true }).click();
    await author.getByRole('button', { name: 'Preview activity', exact: true }).click();
    await expect(author.locator('.ms-activity h3')).toHaveText('Reach the flag');
    await author.getByRole('button', { name: 'Close preview', exact: true }).click();
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
        .toMatchObject({ title: 'Reach the flag', targetX: 4, maxAttempts: 3 });
    await editIdevice(page, id!);
    await expect(author.locator('[data-field="title"]')).toHaveValue('Reach the flag');
    await author.getByRole('tab', { name: 'Assessment', exact: true }).click();
    await expect(author.locator('[data-field="targetX"]')).toHaveValue('4');
    await saveIdevice(page, id!);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await openPreviewPanel(page);
    const preview = await getPreviewFrame(page);
    await expect(preview.locator('.ms-activity .blocklySvg')).toBeVisible();
    await page.locator('#previewsidenavclose').click();
    await addIdevice(page, 'mini-scratch');
    await author.locator('[data-field="title"]').fill('Second activity');
    await author.getByRole('tab', { name: 'Assessment', exact: true }).click();
    await author.locator('[data-field="weight"]').fill('75');
    const secondId = await page.locator('.idevice_node.mini-scratch').last().getAttribute('id');
    await saveIdevice(page, secondId!);
    const files = await exported(page, 'scorm12', testInfo.outputPath('mini-scratch-scorm12.zip'));
    expect(files['imsmanifest.xml']).toBeDefined();
    expect(files['idevices/mini-scratch/mini-scratch.js']).toBeDefined();
    expect(files['idevices/mini-scratch/media/sprites.svg']).toBeDefined();
    expect(Object.keys(files).some(name => name.includes('/edition/') || name.includes('/src/'))).toBe(false);
    const script = Buffer.from(files['idevices/mini-scratch/mini-scratch.js']).toString();
    expect(script).not.toContain('Load example (replaces this form)');
    const offline = await page.context().newPage();
    const missing: string[] = [];
    offline.on('pageerror', error => errors.push(error.message));
    await offline.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'mini-scratch.test') {
            missing.push(url.href);
            return route.abort();
        }
        if (url.pathname === '/launch')
            return route.fulfill({
                contentType: 'text/html',
                body: '<script src="/scorm-again.js"></script><script>window.API=new Scorm12API({autocommit:false,logLevel:5});</script><iframe src="/nested/lms/package/index.html"></iframe>',
            });
        if (url.pathname === '/scorm-again.js')
            return route.fulfill({
                contentType: 'text/javascript',
                body: readFileSync('node_modules/scorm-again/dist/scorm12.min.js'),
            });
        const name = decodeURIComponent(url.pathname.replace('/nested/lms/package/', ''));
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
    await offline.goto('https://mini-scratch.test/launch');
    const sco = offline.frameLocator('iframe');
    await expect(sco.locator('.ms-activity .blocklySvg')).toHaveCount(2);
    const first = sco.locator('.ms-activity').first();
    const second = sco.locator('.ms-activity').last();
    await expect.poll(() => offline.evaluate(() => (window as any).API.cmi.core.lesson_status)).toBe('incomplete');
    const program = {
        blocks: {
            languageVersion: 0,
            blocks: [
                {
                    type: 'ms_start',
                    next: {
                        block: {
                            type: 'ms_move',
                            inputs: { VALUE: { block: { type: 'ms_number', fields: { NUM: 4 } } } },
                        },
                    },
                },
            ],
        },
    };
    await first.locator('.ms-workspace').evaluate((element, program) => {
        const Blockly = (window as any).Blockly;
        const ws = Blockly.common
            .getAllWorkspaces()
            .find((workspace: any) => !workspace.isFlyout && element.contains(workspace.getInjectionDiv?.()));
        if (!ws) throw new Error('Student workspace not found');
        Blockly.serialization.workspaces.load(program, ws);
    }, program);
    await first.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(first.locator('.ms-score')).toContainText('Practice score: 100');
    expect(await offline.evaluate(() => (window as any).API.cmi.core.score.raw)).toBe('');
    await first.getByRole('button', { name: /Submit attempt/ }).click();
    await expect(first.locator('.ms-score')).toContainText('Submitted score: 100');
    await expect.poll(() => offline.evaluate(() => Number((window as any).API.cmi.core.score.raw))).toBe(25);
    await expect.poll(() => offline.evaluate(() => (window as any).API.cmi.core.lesson_status)).toBe('incomplete');
    const secondProgram = structuredClone(program);
    secondProgram.blocks.blocks[0].next.block.inputs.VALUE.block.fields.NUM = 3;
    await second.locator('.ms-workspace').evaluate((element, program) => {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly.common
            .getAllWorkspaces()
            .find((w: any) => !w.isFlyout && element.contains(w.getInjectionDiv?.()));
        Blockly.serialization.workspaces.load(program, workspace);
    }, secondProgram);
    await second.getByRole('button', { name: /Submit attempt/ }).click();
    await expect(second.locator('.ms-score')).toContainText('Submitted score: 100');
    await expect.poll(() => offline.evaluate(() => Number((window as any).API.cmi.core.score.raw))).toBe(100);
    await expect.poll(() => offline.evaluate(() => (window as any).API.cmi.core.lesson_status)).toBe('passed');
    await first.getByRole('button', { name: /Submit attempt/ }).click();
    await expect(first.locator('.ms-feedback')).toContainText('Change your program');
    const attempts = await first.evaluate(root => {
        const id = root.closest('.idevice_node')!.id;
        return (window as any).exeScorm12.activities.get(id).answered;
    });
    expect(attempts).toBe(1);
    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
    await offline.close();
    const html = await exported(page, 'html5');
    expect(html['idevices/mini-scratch/mini-scratch.js']).toBeDefined();
});

test('preserves all teacher configuration and starter blocks through ELPX import and duplication', async ({
    authenticatedPage: page,
    createProject,
}, testInfo) => {
    const uuid = await createProject(page, 'Mini Scratch round trip');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'mini-scratch');
    const author = page.locator('.ms-author');
    await author.locator('[data-field="example"]').selectOption('calculation');
    await author.getByRole('button', { name: 'Load example (replaces this form)', exact: true }).click();
    await author.getByRole('tab', { name: 'Assessment', exact: true }).click();
    await author.locator('[data-field="expected"]').fill('30');
    await author.locator('[data-field="hint"]').fill('Use a loop and a numeric variable.');
    const id = await page.locator('.idevice_node.mini-scratch').getAttribute('id');
    await author.getByRole('tab', { name: 'Programming', exact: true }).click();
    await author.locator('.ms-workspace').evaluate(element => {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly.common
            .getAllWorkspaces()
            .find((w: any) => !w.isFlyout && element.contains(w.getInjectionDiv?.()));
        Blockly.serialization.workspaces.load(
            {
                blocks: {
                    languageVersion: 0,
                    blocks: [
                        {
                            type: 'ms_start',
                            next: {
                                block: {
                                    type: 'ms_set',
                                    fields: { NAME: 'result' },
                                    inputs: { VALUE: { shadow: { type: 'ms_number', fields: { NUM: 0 } } } },
                                },
                            },
                        },
                    ],
                },
            },
            workspace,
        );
    });
    await saveIdevice(page, id!);
    const before = await page.locator('[data-mini-scratch]').getAttribute('data-mini-scratch');
    const files = await exported(page, 'elpx');
    const { zipSync } = await import('fflate');
    const file = testInfo.outputPath('mini-scratch.elpx');
    writeFileSync(file, zipSync(files));
    await openElpFile(page, file);
    await selectFirstPage(page);
    await expect(page.locator('[data-mini-scratch]')).toHaveAttribute('data-mini-scratch', before!);
    const importedId = await page.locator('.idevice_node.mini-scratch').getAttribute('id');
    await editIdevice(page, importedId!);
    await author.getByRole('tab', { name: 'Assessment', exact: true }).click();
    await expect(author.locator('[data-field="expected"]')).toHaveValue('30');
    await expect(author.locator('[data-field="hint"]')).toHaveValue('Use a loop and a numeric variable.');
    await author.getByRole('tab', { name: 'Programming', exact: true }).click();
    const blockTypes = await author.locator('.ms-workspace').evaluate(element => {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly.common
            .getAllWorkspaces()
            .find((w: any) => !w.isFlyout && element.contains(w.getInjectionDiv?.()));
        return workspace
            .getAllBlocks(false)
            .map((b: any) => b.type)
            .sort();
    });
    expect(blockTypes).toEqual(['ms_number', 'ms_set', 'ms_start']);
    await saveIdevice(page, importedId!);
    await cloneCurrentPage(page);
    await expect(page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text')).toHaveCount(2);
    await expect(page.locator('[data-mini-scratch]')).toHaveAttribute('data-mini-scratch', before!);
});

test('keeps authoring tabs keyboard accessible and usable at narrow widths', async ({
    authenticatedPage: page,
    createProject,
}, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 960 });
    const uuid = await createProject(page, 'Mini Scratch authoring layout');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    const betaWarning = page.locator('#eXeBetaWarningCloseBtn');
    if (await betaWarning.isVisible()) await betaWarning.click();
    await selectFirstPage(page);
    await addIdevice(page, 'mini-scratch');
    const author = page.locator('.ms-author');
    const activity = author.getByRole('tab', { name: 'Activity', exact: true });
    await author.getByLabel('Activity title', { exact: true }).fill('A journey to the flag');
    await activity.focus();
    await page.keyboard.press('ArrowRight');
    await expect(author.getByRole('tab', { name: 'Programming', exact: true })).toBeFocused();
    await expect(author.getByRole('tabpanel', { name: 'Programming', exact: true })).toBeVisible();
    await expect(author.getByRole('tabpanel', { name: 'Activity', exact: true })).toBeHidden();
    await expect(author.locator('.blocklySvg')).toBeVisible();
    const workspace = await author.locator('.ms-workspace').boundingBox();
    expect(workspace!.width).toBeGreaterThan(300);
    expect(workspace!.height).toBeGreaterThan(300);
    const programmingImage = testInfo.outputPath('mini-scratch-programming.png');
    await author.screenshot({ path: programmingImage });
    await testInfo.attach('Programming tab', { path: programmingImage, contentType: 'image/png' });
    await author.locator('summary').click();
    await expect(author.getByRole('checkbox', { name: 'Move forward', exact: true })).toBeVisible();
    await author.getByRole('tab', { name: 'Assessment', exact: true }).click();
    await author.getByLabel('Challenge', { exact: true }).selectOption('sequence');
    await expect(author.getByRole('button', { name: 'Add action', exact: true })).toBeVisible();
    await author.getByRole('button', { name: 'Add action', exact: true }).click();
    await expect(author.locator('.ms-sequence-row')).toHaveCount(4);
    await author.getByRole('tab', { name: 'Preview', exact: true }).click();
    await expect(author.locator('.ms-activity h3')).toHaveText('A journey to the flag');
    await page.keyboard.press('Home');
    await expect(activity).toBeFocused();
    await expect(author.getByLabel('Activity title', { exact: true })).toHaveValue('A journey to the flag');
    await expect(author.locator('.ms-activity')).toHaveCount(0);
    const activityImage = testInfo.outputPath('mini-scratch-activity.png');
    await author.screenshot({ path: activityImage });
    await testInfo.attach('Activity tab', { path: activityImage, contentType: 'image/png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => author.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await author.getByRole('tab', { name: 'Assessment', exact: true }).click();
    await expect(author.getByRole('button', { name: 'Add action', exact: true })).toBeVisible();
    await expect.poll(() => author.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const narrowImage = testInfo.outputPath('mini-scratch-narrow.png');
    await author.screenshot({ path: narrowImage });
    await testInfo.attach('Narrow assessment tab', { path: narrowImage, contentType: 'image/png' });
});
