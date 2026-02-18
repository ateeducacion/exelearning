import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    addIdevice,
} from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';

/**
 * E2E Tests for Magnifier iDevice
 *
 * Tests the Magnifier iDevice functionality including:
 * - Basic operations (add to blank document)
 * - Image configuration (add custom image via file picker)
 * - Magnifier effect on hover
 * - Preview panel display
 */

/**
 * Helper to save the magnifier iDevice and wait for edition mode to end
 */
async function saveMagnifierIdevice(page: import('@playwright/test').Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.magnifier').first();
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.magnifier');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 30000 },
    );
}

/**
 * Helper to select an image using the file picker in magnifier editor
 */
async function selectImageForMagnifier(page: import('@playwright/test').Page, fixturePath: string): Promise<void> {
    const pickFileBtn = page.locator(
        'input.exe-pick-any-file[data-filepicker="mnfFileInput"], #mnfFileInput + input[type="button"]',
    );

    if ((await pickFileBtn.count()) === 0) {
        const genericBtn = page.locator(
            '#magnifierIdeviceForm .exe-pick-any-file, #magnifierIdeviceForm input[type="button"][value*="Select"]',
        );
        await expect(genericBtn.first()).toBeVisible({ timeout: 10000 });
        await genericBtn.first().click();
    } else {
        await expect(pickFileBtn.first()).toBeVisible({ timeout: 10000 });
        await pickFileBtn.first().click();
    }

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    const imageItem = page.locator('#modalFileManager .media-library-item').first();
    await expect(imageItem).toBeVisible({ timeout: 15000 });
    await imageItem.click();

    const sidebarContent = page.locator('#modalFileManager .media-library-sidebar-content');
    await expect(sidebarContent).toBeVisible({ timeout: 5000 });

    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await expect(insertBtn).toBeVisible({ timeout: 5000 });
    await insertBtn.click();

    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#modalFileManager');
            return !modal || !modal.classList.contains('show');
        },
        undefined,
        { timeout: 10000 },
    );

    const inputValue = await page.locator('#mnfFileInput').inputValue();
    if (!inputValue) {
        throw new Error('Image was not selected - #mnfFileInput is still empty');
    }
}

test.describe('Magnifier iDevice', () => {
    test.describe('Basic Operations and Image Configuration', () => {
        test('should add magnifier, select custom image, save, and verify data attributes', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Magnifier Workflow Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            // Add magnifier iDevice using centralized helpers
            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'magnifier');

            // Verify iDevice was added and form elements are visible
            const magnifierIdevice = page.locator('#node-content article .idevice_node.magnifier').first();
            await expect(magnifierIdevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#mnfFileInput')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#mnfPreviewImage')).toBeVisible({ timeout: 5000 });

            // Verify default image (hood.jpg)
            const previewSrc = await page.locator('#mnfPreviewImage').getAttribute('src');
            expect(previewSrc).toContain('hood.jpg');

            // Select custom image using file picker
            await selectImageForMagnifier(page, 'test/fixtures/sample-3.jpg');

            // Verify file input has asset:// URL
            const fileInputValue = await page.locator('#mnfFileInput').inputValue();
            expect(fileInputValue.startsWith('asset://')).toBe(true);
            expect(fileInputValue).toMatch(/^asset:\/\/[a-f0-9-]+\.jpg$/);

            // Save the iDevice
            await saveMagnifierIdevice(page);

            // Verify view mode container and image load
            const viewModeContainer = page.locator(
                '#node-content article .idevice_node.magnifier .ImageMagnifierIdevice, #node-content article .idevice_node.magnifier .MNF-MainContainer',
            );
            await expect(viewModeContainer.first()).toBeVisible({ timeout: 10000 });

            const viewModeImg = viewModeContainer.locator('img').first();
            await expect(viewModeImg).toBeVisible({ timeout: 5000 });

            // Verify image loaded and has data attributes for magnifier effect
            const naturalWidth = await viewModeImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            const hasDataAttributes = await viewModeImg.evaluate((el: HTMLImageElement) => {
                return (
                    el.hasAttribute('data-magnifysrc') || el.hasAttribute('data-zoom') || el.id.includes('magnifier')
                );
            });
            expect(hasDataAttributes).toBe(true);

            await workarea.save();
        });

        test('should save with default image and display correctly', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Magnifier Default Image Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'magnifier');

            // Save with default image
            await saveMagnifierIdevice(page);

            const viewModeContainer = page.locator(
                '#node-content article .idevice_node.magnifier .ImageMagnifierIdevice, #node-content article .idevice_node.magnifier .MNF-MainContainer',
            );
            await expect(viewModeContainer.first()).toBeVisible({ timeout: 10000 });

            const viewModeImg = viewModeContainer.locator('img').first();
            await expect(viewModeImg).toBeVisible({ timeout: 5000 });

            const naturalWidth = await viewModeImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            await workarea.save();
        });
    });

    test.describe('Preview Panel', () => {
        test('should display correctly in preview panel', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Magnifier Preview Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'magnifier');

            await saveMagnifierIdevice(page);

            await workarea.save();

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            const previewMagnifierContainer = iframe.locator('.MNF-MainContainer, .ImageMagnifierIdevice');
            await expect(previewMagnifierContainer.first()).toBeVisible({ timeout: 10000 });

            const previewImg = iframe.locator('.ImageMagnifierIdevice img, .MNF-MainContainer img');
            await expect(previewImg.first()).toBeVisible({ timeout: 10000 });

            const naturalWidth = await previewImg.first().evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);
        });
    });
});
