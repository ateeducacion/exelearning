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
import type { Page } from '@playwright/test';

/**
 * E2E Tests for UDL Content (Contenido DUA) iDevice
 *
 * Tests the UDL Content iDevice functionality including:
 * - Basic operations (add, edit content, UDL type selection, save, persist)
 * - Multiple content tabs (main, simplified, audio, visual)
 * - Multiple blocks (add, edit)
 * - Preview rendering and interaction
 * - Audio player rendering (with MEJS double-init check)
 */

const TEST_DATA = {
    mainContent: 'This is the main content for UDL iDevice',
    buttonText: 'Learn More',
};

/**
 * Helper to wait for TinyMCE to initialize and type content into it
 */
async function enterEditMode(page: Page): Promise<void> {
    await page.locator('.tox-menubar').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Helper to save the UDL Content iDevice and wait for edition mode to end
 */
async function saveIdevice(page: Page): Promise<void> {
    const saveBtn = page
        .locator('#node-content article .idevice_node.udl-content button')
        .filter({ hasText: /^Save$/ })
        .first();
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const tinyMce = document.querySelector('#node-content article .idevice_node.udl-content .tox-menubar');
            return !tinyMce;
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to type content in the active TinyMCE editor
 */
async function typeInTinyMCE(page: Page, text: string): Promise<void> {
    await page.waitForFunction(
        () => {
            const editor = (window as any).tinymce?.activeEditor;
            return !!editor && editor.initialized;
        },
        null,
        { timeout: 15000 },
    );

    await page.evaluate(content => {
        const editor = (window as any).tinymce?.activeEditor;
        if (!editor) return;
        editor.setContent(content);
        editor.fire('change');
        editor.fire('input');
        editor.setDirty(true);
    }, text);

    await page.waitForFunction(() => {
        const editor = (window as any).tinymce?.activeEditor;
        return !!editor && editor.isDirty();
    });
}

/**
 * Helper to select a UDL type (engagement, representation, expression)
 */
async function selectUdlType(page: Page, type: 'engagement' | 'representation' | 'expression'): Promise<void> {
    await page.locator(`#udlContentTypeOptions input[value="${type}"]`).click();
}

/**
 * Helper to set button text for a block
 */
async function setButtonText(page: Page, text: string, blockIndex: number = 0): Promise<void> {
    const buttonTextInput = page.locator('.udlContentFormBlockButtonTxt input[type="text"]').nth(blockIndex);
    await buttonTextInput.fill(text);
}

/**
 * Helper to add a new UDL content block
 */
async function addBlock(page: Page): Promise<void> {
    const addBlockBtn = page.locator('#udlContentFormAddBlockWrapper a, #udlContentFormAddBlockWrapper button').first();
    await addBlockBtn.click();
    await page.waitForTimeout(300);
}

test.describe('UDL Content iDevice', () => {
    test.describe('Workflow', () => {
        test('should add iDevice, configure UDL type and content, and persist after reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'UDL Content Workflow Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'udl-content');

            // Verify iDevice was added
            await expect(page.locator('#node-content article .idevice_node.udl-content').first()).toBeVisible({
                timeout: 10000,
            });
            await enterEditMode(page);

            // Verify 4 content tabs are present with correct labels
            const tabs = page.locator('.udlContentFormTabs a');
            await expect(tabs).toHaveCount(4, { timeout: 10000 });
            await expect(tabs.nth(0)).toContainText(/Main content|Contenido principal/i);
            await expect(tabs.nth(1)).toContainText(/Easier to read|Lectura facilitada/i);
            await expect(tabs.nth(2)).toContainText(/Audio/i);
            await expect(tabs.nth(3)).toContainText(/Visual aid|Apoyo visual/i);
            await expect(tabs.nth(0)).toHaveClass(/active/);

            // Configure UDL type, button text, and content
            await selectUdlType(page, 'representation');
            await setButtonText(page, TEST_DATA.buttonText);
            const uniqueContent = `Unique UDL content ${Date.now()}`;
            await typeInTinyMCE(page, uniqueContent);
            await saveIdevice(page);

            // Verify representation class is applied and content is visible
            await expect(page.locator('.exe-udlContent').first()).toHaveClass(/exe-udlContent-representation/, {
                timeout: 10000,
            });
            await expect(page.locator('#node-content')).toContainText(TEST_DATA.buttonText, { timeout: 10000 });

            // Save and reload to verify persistence
            await workarea.save();
            await reloadPage(page);
            await selectFirstPage(page);

            await expect(page.locator('#node-content')).toContainText(uniqueContent, { timeout: 15000 });
        });
    });

    test.describe('Multiple Blocks', () => {
        test('should add multiple blocks with different content', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'UDL Multiple Blocks Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'udl-content');
            await enterEditMode(page);

            // Edit first block
            await setButtonText(page, 'Block 1', 0);
            await typeInTinyMCE(page, 'Content for block 1');

            // Add second block
            await addBlock(page);
            await page.locator('.udlContentFormBlock').nth(1).waitFor({ state: 'visible', timeout: 10000 });
            await setButtonText(page, 'Block 2', 1);

            // Type in second block's TinyMCE
            const secondBlockEditor = page
                .locator('.udlContentFormBlock')
                .nth(1)
                .locator('iframe.tox-edit-area__iframe');
            const frameEl = await secondBlockEditor.elementHandle();
            const frame = await frameEl?.contentFrame();
            if (frame) {
                await frame.focus('body');
                await frame.type('body', 'Content for block 2', { delay: 5 });
            }

            await saveIdevice(page);

            // Verify both blocks are rendered
            await expect(page.locator('.exe-udlContent-block')).toHaveCount(2, { timeout: 10000 });
            await expect(page.locator('#node-content')).toContainText('Block 1', { timeout: 10000 });
            await expect(page.locator('#node-content')).toContainText('Block 2', { timeout: 10000 });
        });
    });

    test.describe('Preview Panel', () => {
        test('should render correctly in preview with engagement type', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'UDL Preview Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'udl-content');
            await enterEditMode(page);

            await selectUdlType(page, 'engagement');
            await setButtonText(page, 'Click to Learn');
            await typeInTinyMCE(page, 'This is the main learning content');
            await saveIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Verify engagement class and button text
            await expect(iframe.locator('.exe-udlContent')).toHaveClass(/exe-udlContent-engagement/, {
                timeout: 10000,
            });
            const button = iframe.locator('.udl-btn, .udl-character').first();
            await expect(button).toBeVisible({ timeout: 10000 });
            await expect(button).toContainText('Click to Learn', { timeout: 5000 });

            // Click button to reveal content and verify
            await button.click();
            await page.waitForTimeout(300);
            const mainContent = iframe.locator('.exe-udlContent-content-main');
            await expect(mainContent).toBeVisible({ timeout: 10000 });
            await expect(mainContent).toContainText('main learning content', { timeout: 5000 });
        });
    });

    test.describe('Audio Player', () => {
        test('should render audio element with correct type and no double MEJS initialization', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'UDL Audio Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'udl-content');
            await enterEditMode(page);
            await page.waitForTimeout(300);

            // Insert audio element via TinyMCE API
            const audioHtml =
                '<p>Audio test for MEJS</p><audio class="mediaelement" controls type="audio/mpeg" src="data:audio/mpeg;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"></audio>';
            await page.evaluate(html => {
                const editor = (window as any).tinymce?.activeEditor;
                if (editor) editor.setContent(html);
            }, audioHtml);

            await setButtonText(page, 'Play Audio');
            await saveIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const previewIframe = page.frameLocator('#preview-iframe');
            await previewIframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Click button to reveal content
            const button = previewIframe.locator('.udl-btn, .udl-character').first();
            await expect(button).toBeVisible({ timeout: 10000 });
            await button.click();
            await page.waitForTimeout(300);

            // Verify audio exists (raw audio or MEJS wrapper)
            const mainContent = previewIframe.locator('.exe-udlContent-content-main');
            await expect(mainContent).toBeVisible({ timeout: 10000 });

            const audioElement = previewIframe.locator('.exe-udlContent-content-main audio');
            const mejsContainer = previewIframe.locator('.exe-udlContent-content-main .mejs-container');
            const audioCount = await audioElement.count();
            const mejsCount = await mejsContainer.count();
            expect(audioCount + mejsCount).toBeGreaterThan(0);

            // If raw audio, verify type attribute
            if (audioCount > 0) {
                const audioType = await audioElement.first().getAttribute('type');
                if (audioType) {
                    expect(audioType).toContain('audio/');
                }
            }

            // If MEJS, verify no double-init (mejs-audio without mejs-video)
            if (mejsCount > 0) {
                const mejsClass = await mejsContainer.first().getAttribute('class');
                const hasAudioClass = mejsClass?.includes('mejs-audio') ?? false;
                const hasVideoClass = mejsClass?.includes('mejs-video') ?? false;
                expect(hasAudioClass).toBe(true);
                expect(hasVideoClass).toBe(false);

                // Verify no cannotplay error
                expect(await previewIframe.locator('.me-cannotplay').count()).toBe(0);
            }
        });
    });
});
