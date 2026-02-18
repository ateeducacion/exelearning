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
 * E2E Tests for Relate iDevice
 *
 * Tests the Relate (matching pairs) iDevice functionality including:
 * - Adding pairs with text and images, save
 * - Preview rendering (canvas dimensions fix)
 * - Creating connections/arrows between pairs in preview
 * - Persistence after reload
 */

const TEST_FIXTURES = {
    image1: 'test/fixtures/sample-2.jpg',
    image2: 'test/fixtures/sample-3.jpg',
};

/**
 * Helper to upload an image via the file picker input
 */
async function uploadImageViaFilePicker(page: Page, inputSelector: string, fixturePath: string): Promise<void> {
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
    await page.waitForTimeout(500);

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

    await page.waitForTimeout(500);
}

/**
 * Helper to fill pair data (front and back) for Relate iDevice
 */
async function fillPairData(
    page: Page,
    frontText: string,
    frontImagePath: string | null,
    backText: string,
    backImagePath: string | null,
): Promise<void> {
    const frontTextInput = page.locator('#rclEText');
    await frontTextInput.waitFor({ state: 'visible', timeout: 5000 });
    await frontTextInput.clear();
    await frontTextInput.fill(frontText);

    if (frontImagePath) {
        await uploadImageViaFilePicker(page, '#rclEURLImage', frontImagePath);
    }

    const backTextInput = page.locator('#rclETextBack');
    await backTextInput.waitFor({ state: 'visible', timeout: 5000 });
    await backTextInput.clear();
    await backTextInput.fill(backText);

    if (backImagePath) {
        await uploadImageViaFilePicker(page, '#rclEURLImageBack', backImagePath);
    }
}

/**
 * Helper to add a new pair card
 */
async function addNewPair(page: Page): Promise<void> {
    const addBtn = page.locator('#rclEAddC');
    await addBtn.click();
    await page.waitForTimeout(500);
}

/**
 * Helper to save the Relate iDevice
 */
async function saveRelateIdevice(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.relate').first();
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.relate');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to verify canvas is properly initialized with correct dimensions
 */
async function verifyCanvasInitialized(iframe: FrameLocator): Promise<void> {
    const gameContainer = iframe.locator('[id^="rlcContainerGame-"]').first();
    await gameContainer.waitFor({ state: 'visible', timeout: 15000 });

    const canvas = iframe.locator('.RLCP-Canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const canvasDimensions = await canvas.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    });

    expect(canvasDimensions.width).toBeGreaterThan(0);
    expect(canvasDimensions.height).toBeGreaterThan(0);
}

test.describe('Relate iDevice', () => {
    test.describe('Workflow', () => {
        test('should add pairs with images and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Workflow Test');
            await gotoWorkarea(page, projectUuid);

            // Add relate iDevice using centralized helpers
            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Interactive|Interactiv/i);
            await addIdevice(page, 'relate');

            // Verify iDevice was added and form elements are visible
            const idevice = page.locator('#node-content article .idevice_node.relate').first();
            await expect(idevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#rclEText')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#rclEURLImage')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#rclETextBack')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#rclEURLImageBack')).toBeVisible({ timeout: 5000 });

            // Fill first pair with images
            await fillPairData(page, 'Cat', TEST_FIXTURES.image1, 'Gato', TEST_FIXTURES.image2);

            // Add second pair
            await addNewPair(page);
            await fillPairData(page, 'Dog', TEST_FIXTURES.image2, 'Perro', TEST_FIXTURES.image1);

            // Add third pair (text only)
            await addNewPair(page);
            await fillPairData(page, 'Bird', null, 'Pájaro', null);

            // Verify we have 3 pairs
            const cardCounter = page.locator('#rclENumCards');
            await expect(cardCounter).toHaveText('3', { timeout: 5000 });

            // Save
            await saveRelateIdevice(page);
            const viewModeIdevice = page.locator('#node-content article .idevice_node.relate .relaciona-IDevice');
            await expect(viewModeIdevice).toBeVisible({ timeout: 10000 });

            await workarea.save();
        });
    });

    test.describe('Preview Panel', () => {
        test('should display canvas, words/definitions, and images correctly in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Preview Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Interactive|Interactiv/i);
            await addIdevice(page, 'relate');

            // Add pairs with images and text
            await fillPairData(page, 'Apple', TEST_FIXTURES.image1, 'Manzana', TEST_FIXTURES.image2);
            await addNewPair(page);
            await fillPairData(page, 'Orange', TEST_FIXTURES.image2, 'Naranja', TEST_FIXTURES.image1);

            await saveRelateIdevice(page);
            await workarea.save();

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(500);

            // CRITICAL TEST: Verify canvas has correct dimensions (fixes 0x0 bug)
            await verifyCanvasInitialized(iframe);

            // Verify words and definitions containers are visible
            const wordsContainer = iframe.locator('[id^="rlcContainerWords-"]').first();
            await expect(wordsContainer).toBeVisible({ timeout: 10000 });
            const definitionsContainer = iframe.locator('[id^="rlcContainerDefinitions-"]').first();
            await expect(definitionsContainer).toBeVisible({ timeout: 10000 });

            // Verify we have 2 words and 2 definitions
            await expect(iframe.locator('.RLCP-Word')).toHaveCount(2, { timeout: 10000 });
            await expect(iframe.locator('.RLCP-Definition')).toHaveCount(2, { timeout: 10000 });

            // Verify images are loaded with valid src
            const images = iframe.locator('.RLCP-Image');
            const imageCount = await images.count();
            expect(imageCount).toBeGreaterThanOrEqual(2);

            const firstImageSrc = await images.first().getAttribute('src');
            expect(firstImageSrc).toBeTruthy();
            expect(firstImageSrc).toMatch(/^(blob:|content\/resources\/)/);
        });
    });

    test.describe('Game Interaction', () => {
        test('should allow creating connections between pairs', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Connection Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Interactive|Interactiv/i);
            await addIdevice(page, 'relate');

            await fillPairData(page, 'One', null, 'Uno', null);
            await addNewPair(page);
            await fillPairData(page, 'Two', null, 'Dos', null);

            await saveRelateIdevice(page);
            await workarea.save();

            // Open preview
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(500);

            // Verify game is ready
            await verifyCanvasInitialized(iframe);

            // Click on first word to select it
            const words = iframe.locator('.RLCP-Word');
            await words.first().click();
            await page.waitForTimeout(300);

            const firstWord = words.first();
            const isSelected = await firstWord.evaluate(el => el.classList.contains('RLCP-Selected'));
            expect(isSelected).toBe(true);
        });
    });

    test.describe('Persistence', () => {
        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Persistence Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Interactive|Interactiv/i);
            await addIdevice(page, 'relate');

            const uniqueText = `Persistence Test ${Date.now()}`;
            await fillPairData(page, uniqueText, null, 'Match', null);

            await saveRelateIdevice(page);
            await workarea.save();

            // Reload
            await reloadPage(page);
            await selectFirstPage(page);

            // Verify iDevice is still there
            const idevice = page.locator('#node-content article .idevice_node.relate').first();
            await expect(idevice).toBeVisible({ timeout: 15000 });
        });
    });
});
