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
 * E2E Tests for External Website iDevice
 *
 * Tests the External Website iDevice functionality including:
 * - Basic operations (add, set URL, select frame height, save)
 * - URL validation (empty, invalid, valid)
 * - Preview rendering with iframe and correct height
 * - Edit mode (loading and updating previous values)
 * - Persistence after reload
 */

const TEST_DATA = {
    validUrl: 'https://example.com',
    alternativeUrl: 'https://www.wikipedia.org',
};

/**
 * Helper to wait for the URL input to be ready after addIdevice
 */
async function waitForUrlInput(page: Page): Promise<void> {
    await page
        .waitForFunction(() => document.querySelector('#websiteUrl') !== null, undefined, { timeout: 10000 })
        .catch(() => {});
}

/**
 * Helper to set the URL in the iDevice form
 */
async function setWebsiteUrl(page: Page, url: string): Promise<void> {
    const urlInput = page.locator('#websiteUrl');
    await urlInput.waitFor({ state: 'visible', timeout: 5000 });
    await urlInput.clear();
    await urlInput.fill(url);
}

/**
 * Helper to set the frame height option
 */
async function setFrameHeight(page: Page, option: 'small' | 'medium' | 'large' | 'super-size'): Promise<void> {
    const sizeSelector = page.locator('#sizeSelector');
    await sizeSelector.waitFor({ state: 'visible', timeout: 5000 });
    const optionValue = { small: '1', medium: '2', large: '3', 'super-size': '4' }[option];
    await sizeSelector.selectOption(optionValue);
}

/**
 * Helper to close any alert modals
 */
async function closeAlertModals(page: Page): Promise<void> {
    const modal = page.locator('#modalAlert[data-open="true"]');
    if ((await modal.count()) > 0) {
        // The modalAlert footer button has class btn-secondary and text "Accept"/"Aceptar"
        const okBtn = modal.locator('.modal-footer button').first();
        if ((await okBtn.count()) > 0) {
            await okBtn.click();
            // Wait for modal to fully close (not just animation start)
            await page
                .waitForFunction(
                    () => {
                        const m = document.querySelector('#modalAlert');
                        return !m || m.getAttribute('data-open') !== 'true';
                    },
                    undefined,
                    { timeout: 5000 },
                )
                .catch(() => {});
        }
    }
}

/**
 * Helper to save the external-website iDevice
 */
async function saveExternalWebsiteIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.external-website').last();
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
                const idevice = document.querySelector('#node-content article .idevice_node.external-website');
                const iframe = document.querySelector('#node-content .external-website #iframeWebsiteIdevice iframe');
                return (idevice && idevice.getAttribute('mode') !== 'edition') || iframe !== null;
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to verify the embedded iframe in preview
 */
async function verifyIframeInPreview(
    iframe: FrameLocator,
    expectedUrl: string,
    expectedHeight?: number,
): Promise<void> {
    await iframe.locator('#iframeWebsiteIdevice').first().waitFor({ state: 'visible', timeout: 10000 });

    const embeddedIframe = iframe.locator('#iframeWebsiteIdevice iframe').first();
    await expect(embeddedIframe).toBeVisible({ timeout: 10000 });
    expect(await embeddedIframe.getAttribute('src')).toBe(expectedUrl);

    if (expectedHeight) {
        expect(await embeddedIframe.getAttribute('height')).toBe(String(expectedHeight));
    }
}

test.describe('External Website iDevice', () => {
    test.describe('Workflow', () => {
        test('should add iDevice, set URL with frame heights, save, and verify view mode', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website Workflow Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'external-website');
            await waitForUrlInput(page);

            // Verify form elements and default size (medium = 2)
            const externalWebsiteIdevice = page.locator('#node-content article .idevice_node.external-website').first();
            await expect(externalWebsiteIdevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#websiteUrl')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#sizeSelector')).toBeVisible({ timeout: 5000 });
            expect(await page.locator('#sizeSelector').inputValue()).toBe('2');

            // Set URL and verify saved iFrame (medium = default)
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await saveExternalWebsiteIdevice(page);
            const iframeContainer = page.locator('#node-content .external-website #iframeWebsiteIdevice');
            await expect(iframeContainer).toBeAttached({ timeout: 10000 });
            expect(
                await page.locator('#node-content .external-website #iframeWebsiteIdevice iframe').getAttribute('src'),
            ).toBe(TEST_DATA.validUrl);

            // Edit: set small height (200px), save, verify
            const editBtn = page.locator('#node-content .external-website button:has-text("Edit")').first();
            await editBtn.click();
            await waitForUrlInput(page);
            await setFrameHeight(page, 'small');
            await saveExternalWebsiteIdevice(page);
            expect(
                await page
                    .locator('#node-content .external-website #iframeWebsiteIdevice iframe')
                    .getAttribute('height'),
            ).toBe('200');

            // Edit: set large height (500px), save, verify
            await editBtn.click();
            await waitForUrlInput(page);
            await setFrameHeight(page, 'large');
            await saveExternalWebsiteIdevice(page);
            expect(
                await page
                    .locator('#node-content .external-website #iframeWebsiteIdevice iframe')
                    .getAttribute('height'),
            ).toBe('500');

            // Edit: set super-size height (800px), save, verify
            await editBtn.click();
            await waitForUrlInput(page);
            await setFrameHeight(page, 'super-size');
            await saveExternalWebsiteIdevice(page);
            expect(
                await page
                    .locator('#node-content .external-website #iframeWebsiteIdevice iframe')
                    .getAttribute('height'),
            ).toBe('800');
        });

        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Persist Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'external-website');
            await waitForUrlInput(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await saveExternalWebsiteIdevice(page);
            await workarea.save();

            await reloadPage(page);
            await selectFirstPage(page);

            const iframeContainer = page.locator('#node-content .external-website #iframeWebsiteIdevice');
            await expect(iframeContainer).toBeAttached({ timeout: 15000 });
            expect(
                await page.locator('#node-content .external-website #iframeWebsiteIdevice iframe').getAttribute('src'),
            ).toBe(TEST_DATA.validUrl);
        });
    });

    test.describe('URL Validation', () => {
        test('should show error for empty URL', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website Empty URL Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'external-website');
            await waitForUrlInput(page);

            const block = page.locator('#node-content article .idevice_node.external-website').last();
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();
            await expect(page.locator('#modalAlert[data-open="true"], .modal.show')).toBeVisible({ timeout: 5000 });
            await closeAlertModals(page);
        });

        test('should show error for invalid URL and save successfully with valid HTTPS', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website URL Validation Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'external-website');
            await waitForUrlInput(page);

            // Set invalid URL and try to save — should show alert
            await setWebsiteUrl(page, 'not-a-valid-url');
            const block = page.locator('#node-content article .idevice_node.external-website').last();
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();
            await expect(page.locator('#modalAlert[data-open="true"], .modal.show')).toBeVisible({ timeout: 5000 });
            await closeAlertModals(page);

            // Set valid HTTPS URL — should save successfully
            await setWebsiteUrl(page, 'https://www.example.org');
            await saveExternalWebsiteIdevice(page);
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            await expect(iframe).toBeAttached({ timeout: 10000 });
            expect(await iframe.getAttribute('src')).toBe('https://www.example.org');
        });
    });

    test.describe('Preview Panel', () => {
        test('should display iframe with correct URL and height in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Preview Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'external-website');
            await waitForUrlInput(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await setFrameHeight(page, 'large');
            await saveExternalWebsiteIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Verify iframe has correct URL and height (500px for large)
            await verifyIframeInPreview(iframe, TEST_DATA.validUrl, 500);
        });
    });

    test.describe('Edit Mode', () => {
        test('should load previous URL and update URL when re-editing', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Edit Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'external-website');
            await waitForUrlInput(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await setFrameHeight(page, 'large');
            await saveExternalWebsiteIdevice(page);
            await workarea.save();

            // Edit and verify previous values are loaded
            const editBtn = page.locator('#node-content .external-website button:has-text("Edit")').first();
            await editBtn.click();
            await page.locator('#websiteUrl').waitFor({ state: 'visible', timeout: 10000 });
            expect(await page.locator('#websiteUrl').inputValue()).toBe(TEST_DATA.validUrl);
            expect(await page.locator('#sizeSelector').inputValue()).toBe('3'); // large = 3

            // Update the URL and re-save
            await setWebsiteUrl(page, TEST_DATA.alternativeUrl);
            await saveExternalWebsiteIdevice(page);
            expect(
                await page.locator('#node-content .external-website #iframeWebsiteIdevice iframe').getAttribute('src'),
            ).toBe(TEST_DATA.alternativeUrl);
        });
    });
});
