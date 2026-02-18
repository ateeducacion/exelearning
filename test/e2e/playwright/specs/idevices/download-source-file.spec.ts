import { test, expect } from '../../fixtures/auth.fixture';
import {
    reloadPage,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    addIdevice,
} from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for Download Source File iDevice
 *
 * Tests the Download Source File iDevice functionality including:
 * - Basic operations (add, configure button text/color/font, save)
 * - Preview rendering with download link, ELPX functionality, and project info table
 * - Persistence after reload
 * - Edit mode (loading previous values)
 */

const TEST_DATA = {
    customButtonText: 'Get Project File',
    customBgColor: '#ff5500',
};

/**
 * Helper to set the button text via JS events (more reliable cross-browser)
 */
async function setButtonText(page: Page, text: string): Promise<void> {
    const buttonTextInput = page.locator('#dpiButtonText');
    await buttonTextInput.waitFor({ state: 'visible', timeout: 5000 });
    await buttonTextInput.evaluate((input, newText) => {
        const el = input as HTMLInputElement;
        el.value = newText;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
    await page.waitForTimeout(300);
}

/**
 * Helper to set button background color
 */
async function setButtonBgColor(page: Page, color: string): Promise<void> {
    const colorInput = page.locator('#dpiButtonBGcolor');
    await colorInput.waitFor({ state: 'visible', timeout: 5000 });
    await colorInput.fill(color);
    await page.waitForTimeout(300);
}

/**
 * Helper to set font size
 */
async function setFontSize(page: Page, option: '1' | '1.1' | '1.2' | '1.3' | '1.4' | '1.5'): Promise<void> {
    const fontSizeSelect = page.locator('#dpiButtonFontSize');
    await fontSizeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await fontSizeSelect.selectOption(option);
    await page.waitForTimeout(300);
}

/**
 * Helper to close any alert modals
 */
async function closeAlertModals(page: Page): Promise<void> {
    for (let i = 0; i < 3; i++) {
        const modal = page.locator('#modalAlert[data-open="true"], .modal.show');
        if ((await modal.count()) > 0) {
            await page.waitForTimeout(300);
            const closeBtn = modal
                .locator(
                    'button:has-text("Close"), button:has-text("Cerrar"), button:has-text("OK"), button:has-text("Aceptar"), .btn-secondary[data-dismiss="modal"], button.close[data-dismiss="modal"]',
                )
                .first();
            if ((await closeBtn.count()) > 0) {
                await closeBtn.click({ force: true });
                await page.waitForTimeout(300);
            } else {
                const xBtn = modal.locator('.modal-header .close').first();
                if ((await xBtn.count()) > 0) {
                    await xBtn.click({ force: true });
                    await page.waitForTimeout(300);
                }
            }
        } else {
            break;
        }
    }
}

/**
 * Helper to save the download-source-file iDevice
 */
async function saveDownloadSourceFileIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.download-source-file').last();
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
                const idevice = document.querySelector('#node-content article .idevice_node.download-source-file');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to verify download link in preview
 */
async function verifyDownloadLinkInPreview(
    iframe: FrameLocator,
    expectedButtonText?: string,
    expectedBgColor?: string,
): Promise<void> {
    const downloadLink = iframe.locator('.exe-download-package-link a').first();
    await downloadLink.waitFor({ state: 'visible', timeout: 10000 });

    if (expectedButtonText) {
        expect((await downloadLink.textContent())?.trim()).toBe(expectedButtonText);
    }

    if (expectedBgColor) {
        expect(await downloadLink.getAttribute('style')).toContain(expectedBgColor);
    }

    const onclick = await downloadLink.getAttribute('onclick');
    expect(onclick).toContain('downloadElpx');
}

test.describe('Download Source File iDevice', () => {
    test.describe('Workflow', () => {
        test('should add iDevice, configure button text, color, font size, and save', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Download Source File Workflow Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'download-source-file');

            // Wait for TinyMCE editor to be ready
            await page
                .waitForFunction(() => document.querySelector('.tox-editor-header') !== null, undefined, {
                    timeout: 15000,
                })
                .catch(() => {});

            // Verify form elements are visible
            const downloadIdevice = page.locator('#node-content article .idevice_node.download-source-file').first();
            await expect(downloadIdevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#dpiButtonText')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#dpiButtonBGcolor')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#dpiButtonTextColor')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#dpiButtonFontSize')).toBeVisible({ timeout: 5000 });

            // Configure button customizations
            await setButtonText(page, TEST_DATA.customButtonText);
            await setButtonBgColor(page, TEST_DATA.customBgColor);
            await setFontSize(page, '1.3');

            // Save and verify view mode
            await saveDownloadSourceFileIdevice(page);

            const downloadLink = page.locator('#node-content .download-source-file .exe-download-package-link a');
            await expect(downloadLink).toBeAttached({ timeout: 10000 });
            expect((await downloadLink.textContent())?.trim()).toBe(TEST_DATA.customButtonText);
            expect(await downloadLink.getAttribute('style')).toContain(TEST_DATA.customBgColor);
            expect(await downloadLink.getAttribute('style')).toContain('font-size:1.3em');
        });

        test('should persist custom button text after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Persist Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'download-source-file');
            await page
                .waitForFunction(() => document.querySelector('.tox-editor-header') !== null, undefined, {
                    timeout: 15000,
                })
                .catch(() => {});

            await setButtonText(page, TEST_DATA.customButtonText);
            await saveDownloadSourceFileIdevice(page);
            await workarea.save();

            await reloadPage(page);
            await selectFirstPage(page);

            const downloadLink = page.locator('#node-content .download-source-file .exe-download-package-link a');
            await expect(downloadLink).toBeAttached({ timeout: 15000 });
            expect((await downloadLink.textContent())?.trim()).toBe(TEST_DATA.customButtonText);
        });
    });

    test.describe('Preview Panel', () => {
        test('should display download link, ELPX functionality, and project info in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Preview Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'download-source-file');
            await page
                .waitForFunction(() => document.querySelector('.tox-editor-header') !== null, undefined, {
                    timeout: 15000,
                })
                .catch(() => {});

            await setButtonText(page, TEST_DATA.customButtonText);
            await setButtonBgColor(page, TEST_DATA.customBgColor);
            await saveDownloadSourceFileIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Verify download link with custom text and color
            await verifyDownloadLinkInPreview(iframe, TEST_DATA.customButtonText, TEST_DATA.customBgColor);

            // Verify ELPX download functionality (SW manifest or postMessage approach)
            const downloadInfo = await iframe.locator('html').evaluate(() => {
                const win = window as any;
                const fnSource = win.downloadElpx?.toString() || '';
                return {
                    hasDownloadElpx: typeof win.downloadElpx === 'function',
                    hasManifestLogic: fnSource.includes('__ELPX_MANIFEST__'),
                    hasPostMessageLogic: fnSource.includes('postMessage') && fnSource.includes('exe-download-elpx'),
                };
            });
            expect(downloadInfo.hasDownloadElpx).toBe(true);
            expect(downloadInfo.hasManifestLogic || downloadInfo.hasPostMessageLogic).toBe(true);

            // Verify project info table is present with headers
            const infoTable = iframe.locator('.exe-download-package-instructions .exe-package-info').first();
            await expect(infoTable).toBeVisible({ timeout: 10000 });
            const headerCount = await iframe.locator('.exe-download-package-instructions .exe-package-info th').count();
            expect(headerCount).toBeGreaterThanOrEqual(1);
        });
    });

    test.describe('Edit Mode', () => {
        test('should load previous values when editing', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Edit Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'download-source-file');
            await page
                .waitForFunction(() => document.querySelector('.tox-editor-header') !== null, undefined, {
                    timeout: 15000,
                })
                .catch(() => {});

            await setButtonText(page, TEST_DATA.customButtonText);
            await setButtonBgColor(page, TEST_DATA.customBgColor);
            await setFontSize(page, '1.2');
            await saveDownloadSourceFileIdevice(page);
            await workarea.save();

            // Enter edit mode
            const editBtn = page.locator('#node-content .download-source-file button:has-text("Edit")').first();
            await editBtn.click();
            await page.locator('#dpiButtonText').waitFor({ state: 'visible', timeout: 10000 });

            // Verify previous values are loaded
            expect(await page.locator('#dpiButtonText').inputValue()).toBe(TEST_DATA.customButtonText);
            expect(await page.locator('#dpiButtonFontSize').inputValue()).toBe('1.2');
        });
    });
});
