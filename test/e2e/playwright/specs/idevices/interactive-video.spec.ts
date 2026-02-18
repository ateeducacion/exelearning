import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    reloadPage,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    addIdevice,
} from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for Interactive Video iDevice
 *
 * Tests the Interactive Video iDevice functionality including:
 * - Basic operations (add, upload local video, save)
 * - Opening the interactive video editor
 * - Creating a cover (frontpage)
 * - Creating slides with different content types
 * - Saving editor changes and persistence after reload
 * - Preview rendering
 * - Configuration API
 */

const TEST_DATA = {
    videoFixture: 'test/fixtures/sample-video-480-900kb.webm',
    coverTitle: 'Welcome to Interactive Video',
    coverIntro: 'This is an interactive video with slides and questions.',
    textSlideContent: '<p>This is a text slide with important information.</p>',
    questionText: 'What is 2 + 2?',
    questionAnswers: ['3', '4', '5', '6'],
    correctAnswer: 1,
};

/**
 * Helper to upload a video file via the file picker
 */
async function uploadVideoFile(page: Page, fixturePath: string): Promise<void> {
    const localRadio = page.locator('#interactiveVideoType-local');
    await localRadio.check();
    await page.waitForTimeout(300);

    const fileInput = page.locator('#interactiveVideoFile');
    await fileInput.waitFor({ state: 'visible', timeout: 5000 });

    const pickButton = page.locator('#interactiveVideoFile + .exe-pick-any-file, #interactiveVideoFile + button');
    if ((await pickButton.count()) > 0) {
        await pickButton.first().click();
    } else {
        await fileInput.click();
    }

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    const uploadInput = page.locator('#modalFileManager .media-library-upload-input');
    await uploadInput.setInputFiles(fixturePath);

    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 30000 });
    await mediaItem.click();
    await page.waitForTimeout(300);

    const insertBtn = page.locator(
        '#modalFileManager .media-library-insert-btn, #modalFileManager button:has-text("Insert"), #modalFileManager button:has-text("Insertar")',
    );
    await insertBtn.first().click();

    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#modalFileManager');
            return !modal || modal.getAttribute('data-open') !== 'true';
        },
        undefined,
        { timeout: 10000 },
    );
}

/**
 * Helper to close any alert modals that might be blocking interactions
 */
async function closeAlertModals(page: Page): Promise<void> {
    const modal = page.locator('#modalAlert[data-open="true"]');
    if ((await modal.count()) > 0) {
        const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .btn-primary').first();
        if ((await okBtn.count()) > 0) {
            await okBtn.click();
            await page.waitForTimeout(300);
        }
    }
}

/**
 * Helper to save the interactive-video iDevice
 */
async function saveInteractiveVideoIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.interactive-video').last();
    const saveBtn = block.locator('.btn-save-idevice');

    try {
        await saveBtn.click({ timeout: 5000 });
    } catch {
        await closeAlertModals(page);
        await saveBtn.click();
    }

    await page
        .waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.interactive-video');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to open the interactive video editor and wait for it to load
 */
async function openVideoEditor(page: Page): Promise<FrameLocator> {
    const editorBtn = page.locator('#interactiveVideoOpenEditor');
    await editorBtn.waitFor({ state: 'visible', timeout: 5000 });
    await editorBtn.click();

    await page.waitForSelector('#modalGenericIframeContainer.show', { state: 'visible', timeout: 10000 });

    const editorIframe = page.frameLocator('#modalGenericIframeContainer iframe');
    await editorIframe.locator('#admin-content').waitFor({ state: 'attached', timeout: 15000 });

    await page.waitForFunction(
        () => {
            const iframe = document.querySelector('#modalGenericIframeContainer iframe') as HTMLIFrameElement;
            if (!iframe?.contentDocument?.body) return false;
            const bodyStyle = window.getComputedStyle(iframe.contentDocument.body);
            return bodyStyle.display !== 'none';
        },
        undefined,
        { timeout: 15000 },
    );

    await editorIframe.locator('#controls').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(300);

    return editorIframe;
}

/**
 * Helper to create a cover (frontpage) in the editor
 */
async function createCover(page: Page, editorIframe: FrameLocator, title: string, intro: string): Promise<void> {
    const coverLink = editorIframe.locator('#frontpage-link');
    await coverLink.waitFor({ state: 'visible', timeout: 10000 });
    await coverLink.evaluate(el => (el as HTMLElement).click());

    await page.waitForTimeout(500);

    await page.waitForFunction(
        () => {
            const iframe = document.querySelector('#modalGenericIframeContainer iframe') as HTMLIFrameElement;
            const block = iframe?.contentDocument?.getElementById('frontpage-block');
            if (!block) return false;
            const style = window.getComputedStyle(block);
            return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.5;
        },
        undefined,
        { timeout: 15000 },
    );

    await editorIframe.locator('#frontpage-title').waitFor({ state: 'visible', timeout: 5000 });

    const titleInput = editorIframe.locator('#frontpage-title');
    await titleInput.clear();
    await titleInput.fill(title);

    const tinyMceWrapper = editorIframe
        .locator('#frontpage-content')
        .locator('xpath=..')
        .locator('.tox-tinymce')
        .first();
    await tinyMceWrapper.waitFor({ state: 'visible', timeout: 15000 });
    const tinyMceIframe = tinyMceWrapper.locator('iframe').first();
    await tinyMceIframe.waitFor({ state: 'visible', timeout: 5000 });

    const tinyMceBody = tinyMceIframe.contentFrame().locator('body');
    await tinyMceBody.click();
    await tinyMceBody.fill(intro);
    await tinyMceBody.page().waitForTimeout(300);

    const submitBtn = editorIframe.locator('#frontpage-submit');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();

    try {
        await editorIframe.locator('#frontpage-form-msg').waitFor({ state: 'visible', timeout: 5000 });
        await editorIframe.locator('#frontpage-form-msg').page().waitForTimeout(300);
    } catch {
        await editorIframe.locator('#frontpage-block').page().waitForTimeout(300);
    }
}

/**
 * Helper to create a text slide in the editor
 */
async function createTextSlide(editorIframe: FrameLocator, content: string): Promise<void> {
    const createLink = editorIframe.locator('a[href="#add-block"]');
    await createLink.click();
    await editorIframe.locator('#add-block').waitFor({ state: 'visible', timeout: 5000 });

    const textLink = editorIframe.locator('a[href="#text-block"]');
    await textLink.click();
    await editorIframe.locator('#text-block').waitFor({ state: 'visible', timeout: 5000 });

    const tinyMceWrapper = editorIframe
        .locator('#text-block-content')
        .locator('xpath=..')
        .locator('.tox-tinymce')
        .first();
    await tinyMceWrapper.waitFor({ state: 'visible', timeout: 15000 });
    const tinyMceIframe = tinyMceWrapper.locator('iframe').first();
    await tinyMceIframe.waitFor({ state: 'visible', timeout: 5000 });

    const tinyMceBody = tinyMceIframe.contentFrame().locator('body');
    await tinyMceBody.click();
    await tinyMceBody.fill(content);

    const submitBtn = editorIframe.locator('#text-block-submit');
    await submitBtn.click();
    await editorIframe
        .locator('#text-block-msg')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => {});
}

/**
 * Helper to save the editor and close it
 */
async function saveAndCloseEditor(page: Page, editorIframe: FrameLocator): Promise<void> {
    const saveLink = editorIframe.locator('#actions li.save a').first();
    await saveLink.waitFor({ state: 'visible', timeout: 5000 });
    await saveLink.click();
    await page.waitForTimeout(300);

    const acceptBtn = editorIframe
        .locator('button')
        .filter({ hasText: /Accept|Aceptar/i })
        .first();
    if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
        await page.waitForTimeout(300);
    }

    page.once('dialog', async dialog => {
        await dialog.accept();
    });

    const exitLink = editorIframe.locator('#actions li.exit a').first();
    await exitLink.click();

    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#modalGenericIframeContainer');
            if (!modal) return true;
            const style = getComputedStyle(modal);
            return style.display === 'none' || !document.body.contains(modal);
        },
        undefined,
        { timeout: 15000 },
    );
}

test.describe('Interactive Video iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add iDevice, upload video, and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Interactive Video Workflow Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'interactive-video');

            // Wait for the file input to be ready
            await page
                .waitForFunction(() => document.querySelector('#interactiveVideoFile') !== null, undefined, {
                    timeout: 10000,
                })
                .catch(() => {});

            // Verify iDevice was added with form elements
            const interactiveVideoIdevice = page
                .locator('#node-content article .idevice_node.interactive-video')
                .first();
            await expect(interactiveVideoIdevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#interactiveVideoFile')).toBeVisible({ timeout: 5000 });

            // Upload video file and verify asset:// URL
            await uploadVideoFile(page, TEST_DATA.videoFixture);
            const filePath = await page.locator('#interactiveVideoFile').inputValue();
            expect(filePath.startsWith('asset://')).toBe(true);
            expect(filePath).toMatch(/^asset:\/\/[a-f0-9-]+\.webm$/);

            // Save and verify view mode shows the video container
            await saveInteractiveVideoIdevice(page);
            await expect(page.locator('#node-content .interactive-video .exe-interactive-video')).toBeAttached({
                timeout: 10000,
            });

            await workarea.save();
        });
    });

    test.describe('Editor Workflow', () => {
        // Skip on Firefox — jQuery click handlers in iframes don't fire reliably in Firefox
        test.skip(
            ({ browserName }) => browserName === 'firefox',
            'Firefox has issues with jQuery click handlers in iframes',
        );

        test('should open editor, create cover, save, and persist after reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Interactive Video Editor Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'interactive-video');
            await page
                .waitForFunction(() => document.querySelector('#interactiveVideoFile') !== null, undefined, {
                    timeout: 10000,
                })
                .catch(() => {});

            await uploadVideoFile(page, TEST_DATA.videoFixture);

            // Open the editor, create cover and text slide
            const editorIframe = await openVideoEditor(page);
            await createCover(page, editorIframe, TEST_DATA.coverTitle, TEST_DATA.coverIntro);
            await createTextSlide(editorIframe, TEST_DATA.textSlideContent);
            await saveAndCloseEditor(page, editorIframe);

            await saveInteractiveVideoIdevice(page);
            await expect(page.locator('#node-content .interactive-video .exe-interactive-video')).toBeAttached({
                timeout: 10000,
            });

            // Save and reload to verify persistence
            await workarea.save();
            await reloadPage(page);
            await selectFirstPage(page);

            // Verify iDevice and cover content persisted
            const videoContainer = page.locator('#node-content .interactive-video .exe-interactive-video');
            await expect(videoContainer).toBeAttached({ timeout: 15000 });
            await expect(videoContainer).toContainText(TEST_DATA.coverTitle, { timeout: 10000 });
        });
    });

    test.describe('Preview Panel', () => {
        // Skip on Firefox — depends on createCover which has Firefox issues
        test.skip(
            ({ browserName }) => browserName === 'firefox',
            'Firefox has issues with jQuery click handlers in iframes',
        );

        test('should display interactive video correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Interactive Video Preview Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'interactive-video');
            await page
                .waitForFunction(() => document.querySelector('#interactiveVideoFile') !== null, undefined, {
                    timeout: 10000,
                })
                .catch(() => {});

            await uploadVideoFile(page, TEST_DATA.videoFixture);
            const editorIframe = await openVideoEditor(page);
            await createCover(page, editorIframe, TEST_DATA.coverTitle, TEST_DATA.coverIntro);
            await createTextSlide(editorIframe, TEST_DATA.textSlideContent);
            await saveAndCloseEditor(page, editorIframe);
            await saveInteractiveVideoIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const previewIframe = page.frameLocator('#preview-iframe');
            await previewIframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await expect(previewIframe.locator('.exe-interactive-video').first()).toBeAttached({ timeout: 10000 });
        });
    });

    test.describe('Configuration API', () => {
        test('should have eXeLearning.config defined after page load', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Config API Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            const configAPI = await page.evaluate(() => {
                const config = (window as any).eXeLearning?.config;
                return {
                    exists: config !== undefined,
                    hasBaseURL: config?.baseURL !== undefined,
                    hasBasePath: config?.basePath !== undefined,
                    hasFullURL: config?.fullURL !== undefined,
                };
            });

            expect(configAPI.exists).toBe(true);
            expect(configAPI.hasBaseURL).toBe(true);
            expect(configAPI.hasBasePath).toBe(true);
            expect(configAPI.hasFullURL).toBe(true);

            const hasResolveAssetUrl = await page.evaluate(() => {
                return typeof (window as any).eXeLearningAssetResolver?.resolve === 'function';
            });
            expect(hasResolveAssetUrl).toBe(true);
        });
    });
});
