import { test, expect } from '../../fixtures/auth.fixture';
import {
    reloadPage,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    addIdevice,
} from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { FrameLocator } from '@playwright/test';

/**
 * E2E Tests for BeforeAfter iDevice
 *
 * Tests the BeforeAfter iDevice functionality including:
 * - Basic operations (add, upload image pairs)
 * - Multiple image pairs (2-3 pairs)
 * - Preview rendering (especially first image - tests cached image bug fix)
 * - Navigation between image pairs
 */

const TEST_FIXTURES = {
    beforeImage: 'test/fixtures/sample-2.jpg',
    afterImage: 'test/fixtures/sample-3.jpg',
};

/**
 * Helper to upload an image via the file picker input
 */
async function uploadImageViaFilePicker(
    page: import('@playwright/test').Page,
    inputSelector: string,
    fixturePath: string,
): Promise<void> {
    const input = page.locator(inputSelector);
    await input.waitFor({ state: 'visible', timeout: 5000 });

    const pickButton = page.locator(`${inputSelector} + .exe-pick-any-file, ${inputSelector} + .exe-pick-image`);

    if ((await pickButton.count()) > 0) {
        await pickButton.click();
    } else {
        await input.click();
    }

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 15000 });
    await mediaItem.click();

    const insertBtn = page.locator(
        '#modalFileManager .media-library-insert-btn, #modalFileManager button:has-text("Insert"), #modalFileManager button:has-text("Insertar")',
    );
    await insertBtn.first().click();

    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#modalFileManager');
            return !modal || !modal.classList.contains('show');
        },
        undefined,
        { timeout: 10000 },
    );
}

/**
 * Helper to fill the description field and upload Before/After images for a card
 */
async function fillCardData(
    page: import('@playwright/test').Page,
    description: string,
    beforeImagePath: string,
    afterImagePath: string,
): Promise<void> {
    const descInput = page.locator('#bfafEDescription');
    await descInput.waitFor({ state: 'visible', timeout: 5000 });
    await descInput.clear();
    await descInput.fill(description);

    await uploadImageViaFilePicker(page, '#bfafEURLImageBack', beforeImagePath);
    await uploadImageViaFilePicker(page, '#bfafEURLImage', afterImagePath);
}

/**
 * Helper to add a new card by clicking the Add button
 */
async function addNewCard(page: import('@playwright/test').Page): Promise<void> {
    const addBtn = page.locator('#bfafEAddC');
    await addBtn.click();
}

/**
 * Helper to save the BeforeAfter iDevice
 */
async function saveBeforeAfterIdevice(page: import('@playwright/test').Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.beforeafter').first();
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.beforeafter');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to verify that the first image rendered correctly in preview
 */
async function verifyFirstImageRendered(iframe: FrameLocator): Promise<void> {
    const container = iframe.locator('.BFAFP-ContainerBA').first();
    await container.waitFor({ state: 'visible', timeout: 15000 });

    const opacity = await container.evaluate(el => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.opacity);
    });
    expect(opacity).toBeGreaterThan(0);

    const beforeImg = iframe.locator('.BFAFP-ImageBefore').first();
    const afterImg = iframe.locator('[id^="bfafpImageAfter-"]').first();

    const beforeSrc = await beforeImg.getAttribute('src');
    const afterSrc = await afterImg.getAttribute('src');

    expect(beforeSrc).toBeTruthy();
    expect(afterSrc).toBeTruthy();
    expect(beforeSrc).toMatch(/^(blob:|content\/resources\/)/);
    expect(afterSrc).toMatch(/^(blob:|content\/resources\/)/);
}

test.describe('BeforeAfter iDevice', () => {
    test.describe('Workflow', () => {
        test('should add, fill image pairs, save, and persist after reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Workflow Test');
            await gotoWorkarea(page, projectUuid);

            // Add iDevice using centralized helpers
            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Interactive|Interactiv/i);
            await addIdevice(page, 'beforeafter');

            // Verify iDevice was added
            const idevice = page.locator('#node-content article .idevice_node.beforeafter').first();
            await expect(idevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#bfafEDescription')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#bfafEURLImageBack')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#bfafEURLImage')).toBeVisible({ timeout: 5000 });

            // Fill first card
            const uniqueDescription = `Persistence Test ${Date.now()}`;
            await fillCardData(page, uniqueDescription, TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            // Add second card
            await addNewCard(page);
            await fillCardData(
                page,
                'Second pair: Garden transformation',
                TEST_FIXTURES.afterImage,
                TEST_FIXTURES.beforeImage,
            );

            // Verify 2 cards
            const cardCounter = page.locator('#bfafENumCards');
            await expect(cardCounter).toHaveText('2', { timeout: 5000 });

            // Save the iDevice
            await saveBeforeAfterIdevice(page);

            const viewModeIdevice = page.locator(
                '#node-content article .idevice_node.beforeafter .beforeafter-IDevice',
            );
            await expect(viewModeIdevice).toBeVisible({ timeout: 10000 });

            // Save project and reload to verify persistence
            await workarea.save();

            await reloadPage(page);

            // Navigate to the page
            await selectFirstPage(page);

            const reloadedIdevice = page.locator('#node-content article .idevice_node.beforeafter').first();
            await expect(reloadedIdevice).toBeVisible({ timeout: 15000 });
            await expect(reloadedIdevice).toContainText(uniqueDescription, { timeout: 10000 });
        });
    });

    test.describe('Preview Panel', () => {
        test('should render first image correctly and navigate between images', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Preview Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Interactive|Interactiv/i);
            await addIdevice(page, 'beforeafter');

            // Fill first card
            await fillCardData(page, 'Test: First image render', TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            // Add second card
            await addNewCard(page);
            await fillCardData(page, 'Test: Second image', TEST_FIXTURES.afterImage, TEST_FIXTURES.beforeImage);

            // Add third card for navigation test
            await addNewCard(page);
            await fillCardData(page, 'Navigation Test Pair 3', TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            await saveBeforeAfterIdevice(page);
            await workarea.save();

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });
            await page.waitForTimeout(500); // BeforeAfter CSS opacity transition

            // CRITICAL TEST: Verify first image rendered correctly (cached image race condition bug)
            await verifyFirstImageRendered(iframe);

            // Verify starts at 1/3
            const numberInfo = iframe.locator('.BFAFP-NumberInfo').first();
            await expect(numberInfo).toContainText(/1.*3/, { timeout: 5000 });

            // Click Next and verify navigation
            const nextBtn = iframe.locator('[id^="bfafNext-"]').first();
            await nextBtn.click();
            await expect(numberInfo).toContainText(/2.*3/, { timeout: 5000 });

            // Verify opacity of image 2
            const container = iframe.locator('.BFAFP-ContainerBA').first();
            const opacity = await container.evaluate(el => {
                const style = window.getComputedStyle(el);
                return parseFloat(style.opacity);
            });
            expect(opacity).toBeGreaterThan(0);

            // Navigate to image 3 then back
            await nextBtn.click();
            await expect(numberInfo).toContainText(/3.*3/, { timeout: 5000 });

            const prevBtn = iframe.locator('[id^="bfafPrevious-"]').first();
            await prevBtn.click();
            await expect(numberInfo).toContainText(/2.*3/, { timeout: 5000 });
        });

        test('should display comparison slider', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Slider Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Interactive|Interactiv/i);
            await addIdevice(page, 'beforeafter');

            await fillCardData(page, 'Slider Test', TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);
            await saveBeforeAfterIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            const slider = iframe.locator('.BFAFP-Slider').first();
            await expect(slider).toBeVisible({ timeout: 10000 });

            const overlay = iframe.locator('.BFAFP-Overlay').first();
            await expect(overlay).toBeVisible({ timeout: 5000 });

            const overlayWidth = await overlay.evaluate(el => el.offsetWidth);
            expect(overlayWidth).toBeGreaterThan(0);
        });
    });
});
