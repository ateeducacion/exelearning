import { test, expect } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';
import {
    getPreviewFrame,
    waitForPreviewContent,
    waitForAppReady,
    reloadPage,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    addIdevice,
} from '../../helpers/workarea-helpers';

/**
 * E2E Tests for Image Gallery iDevice
 *
 * Tests the Image Gallery iDevice functionality including:
 * - Basic operations (add to blank document, upload single image)
 * - Multiple image support
 * - Image controls (remove, modify)
 * - Preview panel display with lightbox
 * - Image persistence after reload
 * - Folder path support for images
 */

/**
 * Helper to save the image-gallery iDevice and wait for edition mode to end
 */
async function saveGalleryIdevice(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.image-gallery').first();
    const saveBtn = block.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    }
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to upload images to the image gallery
 */
async function uploadImagesToGallery(page: Page, fixturePaths: string[]): Promise<void> {
    // The image gallery uses a native file input
    const fileInput = page.locator('#imageLoaded');

    // Get the expected number of images (current + new)
    const currentImages = await page.locator('.imgSelectContainer').count();
    const expectedCount = currentImages + fixturePaths.length;

    // Set the files on the hidden file input - this triggers change event
    await fileInput.setInputFiles(fixturePaths);

    // Wait for the image containers to be added (async upload + DOM update)
    // The upload is async: change event -> FileReader -> uploadFile API -> addImageHTML
    await page.waitForFunction(
        expected => {
            const containers = document.querySelectorAll('.imgSelectContainer');
            return containers.length >= expected;
        },
        expectedCount,
        { timeout: 30000 },
    );

    // Additional small delay to ensure DOM is fully updated
    await page.waitForTimeout(500);
}

test.describe('Image Gallery iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add iDevice, upload single image, and display in gallery', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Basic Test');
            await gotoWorkarea(page, projectUuid);

            // Add image-gallery iDevice
            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Verify iDevice was added and is in edition mode
            const galleryIdevice = page.locator('#node-content article .idevice_node.image-gallery').first();
            await expect(galleryIdevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#addImageButton')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#imagesContainer')).toBeAttached({ timeout: 5000 });
            await expect(page.locator('#textMsxHide')).toBeVisible();

            // Upload a single image
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Verify the "no images" message is hidden
            await expect(page.locator('#textMsxHide')).toBeHidden();

            // Verify an image container was created with valid origin attribute
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });
            const galleryImage = imageContainer.locator('img.image');
            await expect(galleryImage).toBeVisible();
            expect(await galleryImage.getAttribute('origin')).toBeTruthy();

            // Save the iDevice
            await saveGalleryIdevice(page);

            // Verify gallery is rendered in view mode with loaded image
            const viewModeGallery = page.locator(
                '#node-content article .idevice_node.image-gallery .imageGallery-IDevice',
            );
            await expect(viewModeGallery).toBeVisible({ timeout: 10000 });
            const viewModeImages = viewModeGallery.locator('img');
            await expect(viewModeImages.first()).toBeVisible({ timeout: 5000 });
            const naturalWidth = await viewModeImages.first().evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            await workarea.save();
        });
    });

    test.describe('Image Upload', () => {
        test('should upload multiple images and display in gallery', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Image Gallery Multiple Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Upload multiple images
            await uploadImagesToGallery(page, ['test/fixtures/sample-2.jpg', 'test/fixtures/sample-3.jpg']);

            // Verify multiple image containers were created
            const imageContainers = page.locator('.imgSelectContainer');
            await expect(imageContainers).toHaveCount(2, { timeout: 15000 });

            // Verify both images are displayed
            const images = page.locator('.imgSelectContainer img.image');
            await expect(images.first()).toBeVisible();
            await expect(images.nth(1)).toBeVisible();
        });
    });

    test.describe('Image Controls', () => {
        test('should have working control buttons for images', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Image Gallery Controls Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Upload an image
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Verify image container exists
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });

            // Verify control buttons exist
            await expect(imageContainer.locator('button.attribution')).toBeVisible();
            await expect(imageContainer.locator('button.modify')).toBeVisible();
            await expect(imageContainer.locator('button.remove')).toBeVisible();

            // Test remove button
            await imageContainer.locator('button.remove').click();

            // Verify image was removed and "no images" message is shown again
            await expect(imageContainer).toBeHidden({ timeout: 5000 });
            await expect(page.locator('#textMsxHide')).toBeVisible();
        });
    });

    test.describe('Preview Panel', () => {
        test('should display correctly in preview panel', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Preview Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Upload an image and save
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);
            await page.locator('.imgSelectContainer').first().waitFor({ timeout: 10000 });
            await saveGalleryIdevice(page);

            // Save project and open preview
            await workarea.save();
            await page.waitForTimeout(500);

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Verify gallery container exists in preview with image elements
            const previewGallery = iframe.locator('.imageGallery-IDevice');
            await expect(previewGallery).toBeVisible({ timeout: 10000 });
            const previewImages = iframe.locator('.imageGallery-IDevice img');
            await expect(previewImages.first()).toBeAttached({ timeout: 10000 });
            expect(await previewImages.first().getAttribute('src')).toBeTruthy();
        });
    });

    test.describe('Lightbox Functionality', () => {
        test('should open lightbox when clicking image in view mode', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Lightbox Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Upload an image and save
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);
            await page.locator('.imgSelectContainer').first().waitFor({ timeout: 10000 });
            await saveGalleryIdevice(page);

            // Wait for SimpleLightbox to be loaded and renderBehaviour to complete
            await page.waitForFunction(() => typeof (window as any).SimpleLightbox !== 'undefined', undefined, {
                timeout: 10000,
            });
            await page.waitForTimeout(500);

            // Find the gallery link and verify href is resolved
            const galleryLink = page.locator('#node-content .imageGallery-IDevice a.imageLink').first();
            await expect(galleryLink).toBeVisible({ timeout: 5000 });
            const href = await galleryLink.getAttribute('href');
            // With SW-based preview, assets are served via relative paths (content/resources/...)
            expect(href).toMatch(/^(blob:|content\/resources\/)/);

            // Click the image to open lightbox
            await galleryLink.click();
            await page.waitForTimeout(500);

            // Verify the lightbox overlay and image are visible
            const lightboxOverlay = page.locator('.sl-overlay');
            await expect(lightboxOverlay).toBeVisible({ timeout: 5000 });
            await expect(page.locator('.sl-image img')).toBeVisible({ timeout: 5000 });

            // Close the lightbox and verify it's closed
            await page.locator('.sl-close').click();
            await expect(lightboxOverlay).toBeHidden({ timeout: 5000 });
        });

        test('should open lightbox when clicking image in preview panel', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Preview Lightbox Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Upload an image and save
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);
            await page.locator('.imgSelectContainer').first().waitFor({ timeout: 10000 });
            await saveGalleryIdevice(page);

            // Save project and open preview
            await workarea.save();
            await page.waitForTimeout(500);

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Wait for SimpleLightbox to be available in iframe
            await page.waitForFunction(
                () => {
                    const previewIframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
                    if (!previewIframe?.contentWindow) return false;
                    return typeof (previewIframe.contentWindow as any).SimpleLightbox !== 'undefined';
                },
                undefined,
                { timeout: 15000 },
            );
            await page.waitForTimeout(500);

            // Click on the image in the preview
            const previewGalleryLink = iframe.locator('.imageGallery-IDevice a.imageLink').first();
            await expect(previewGalleryLink).toBeVisible({ timeout: 5000 });

            // Verify the href is resolved (blob, data URL, or relative path)
            const href = await previewGalleryLink.getAttribute('href');
            // With SW-based preview, assets are served via relative paths (content/resources/...)
            expect(href).toMatch(/^(blob:|data:|content\/resources\/)/);

            await previewGalleryLink.click();

            // Wait for SimpleLightbox to open
            await expect(iframe.locator('.sl-wrapper')).toBeVisible({ timeout: 5000 });

            // Verify the lightbox image element exists and has a valid src
            const lightboxImage = iframe.locator('.sl-image img');
            await lightboxImage.waitFor({ state: 'attached', timeout: 5000 });
            const imgSrc = await lightboxImage.getAttribute('src');
            expect(imgSrc).toBeTruthy();
            // With SW-based preview, assets may be relative paths
            expect(imgSrc).toMatch(/^(blob:|content\/resources\/)/);

            // Verify close button is present
            await expect(iframe.locator('.sl-close')).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Image Modification', () => {
        test('should modify existing image without URL scheme errors', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // Capture console errors
            const consoleErrors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') consoleErrors.push(msg.text());
            });

            const projectUuid = await createProject(page, 'Image Gallery Modify Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Upload first image
            await uploadImagesToGallery(page, ['test/fixtures/sample-2.jpg']);

            // Verify first image was added
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });

            // Click the "Modify" button on the image
            const modifyBtn = imageContainer.locator('button.modify');
            await expect(modifyBtn).toBeVisible();
            await modifyBtn.click();

            // Wait for File Manager modal to open
            await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', {
                timeout: 10000,
            });

            // Upload and select a different image
            const fileInput = page.locator('#modalFileManager input[type="file"]').first();
            await fileInput.setInputFiles('test/fixtures/sample-3.jpg');

            // Wait for upload to complete and item to appear
            await page.waitForSelector('#modalFileManager .media-library-item:not(.media-library-folder)', {
                timeout: 15000,
            });
            await page.waitForTimeout(500);

            // Select the newly uploaded item and insert
            await page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').last().click();
            await page.waitForTimeout(300);
            await page.click('#modalFileManager .media-library-insert-btn');
            await page.waitForTimeout(500);

            // Verify the image src uses valid URL scheme (NOT asset://)
            const modifiedImage = imageContainer.locator('img.image');
            const modifiedSrc = await modifiedImage.getAttribute('src');
            expect(modifiedSrc).not.toContain('asset://');
            expect(modifiedSrc).toMatch(/^(blob:|data:|content\/|\/|https?:\/\/)/);

            // Verify no ERR_UNKNOWN_URL_SCHEME errors in console
            expect(consoleErrors.filter(e => e.includes('ERR_UNKNOWN_URL_SCHEME'))).toHaveLength(0);

            // Verify image actually loads (naturalWidth > 0)
            const imageLoaded = await page
                .waitForFunction(
                    () => {
                        const img = document.querySelector('.imgSelectContainer img.image') as HTMLImageElement;
                        return img?.complete && img.naturalWidth > 0;
                    },
                    undefined,
                    { timeout: 10000 },
                )
                .then(() => true)
                .catch(() => false);
            expect(imageLoaded).toBe(true);
            expect(await modifiedImage.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

            // Save the iDevice
            await saveGalleryIdevice(page);

            // Verify gallery is rendered in view mode with loaded image
            const viewModeGallery = page.locator(
                '#node-content article .idevice_node.image-gallery .imageGallery-IDevice',
            );
            await expect(viewModeGallery).toBeVisible({ timeout: 10000 });
            const viewModeImage = viewModeGallery.locator('img').first();
            await expect(viewModeImage).toBeVisible({ timeout: 5000 });
            await page.waitForTimeout(500);
            expect(await viewModeImage.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

            await workarea.save();
        });
    });

    test.describe('Image Persistence', () => {
        test('should display images correctly after page reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // Capture console errors
            const consoleErrors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') consoleErrors.push(msg.text());
            });

            const projectUuid = await createProject(page, 'Image Gallery Persistence Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // Upload images
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Verify image container exists with a src attribute
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });
            expect(await imageContainer.locator('img.image').getAttribute('src')).toBeTruthy();

            // Save the iDevice
            await saveGalleryIdevice(page);

            // Verify the gallery is rendered in view mode
            const viewModeGallery = page.locator(
                '#node-content article .idevice_node.image-gallery .imageGallery-IDevice',
            );
            await expect(viewModeGallery).toBeVisible({ timeout: 10000 });

            // Verify that no blob URLs are stored in the iDevice Yjs data
            const ideviceDataBeforeReload = await page.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return null;
                const pages = bridge.documentManager?.getPages?.();
                if (!pages) return null;
                for (const pageData of pages) {
                    for (const block of pageData?.blocks ?? []) {
                        for (const idevice of block?.idevices ?? []) {
                            if (idevice?.type === 'image-gallery') return idevice.data;
                        }
                    }
                }
                return null;
            });

            if (ideviceDataBeforeReload) {
                expect(JSON.stringify(ideviceDataBeforeReload)).not.toContain('blob:');
            }

            // Save the project and reload
            await workarea.save();
            await page.waitForTimeout(500);
            await reloadPage(page);
            await selectFirstPage(page);

            // Verify the image gallery renders correctly after reload
            const galleryViewAfterReload = page.locator('#node-content .idevice_node.image-gallery').first();
            await expect(galleryViewAfterReload).toBeVisible({ timeout: 15000 });

            const viewModeGalleryAfterReload = page.locator(
                '#node-content .idevice_node.image-gallery .imageGallery-IDevice',
            );
            await expect(viewModeGalleryAfterReload).toBeVisible({ timeout: 10000 });

            // Verify images are visible and loaded (naturalWidth > 0)
            const galleryImages = viewModeGalleryAfterReload.locator('img');
            await expect(galleryImages.first()).toBeVisible({ timeout: 10000 });

            const imageLoaded = await page
                .waitForFunction(
                    () => {
                        const img = document.querySelector(
                            '#node-content .idevice_node.image-gallery .imageGallery-IDevice img',
                        ) as HTMLImageElement;
                        return img?.complete && img.naturalWidth > 0;
                    },
                    undefined,
                    { timeout: 15000 },
                )
                .then(() => true)
                .catch(() => false);
            expect(imageLoaded).toBe(true);

            expect(await galleryImages.first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
            expect(await galleryImages.first().getAttribute('src')).toBeTruthy();

            // Verify NO ERR_FILE_NOT_FOUND errors for blob URLs
            expect(consoleErrors.filter(e => e.includes('ERR_FILE_NOT_FOUND') && e.includes('blob:'))).toHaveLength(0);
        });

        test('should persist modified images correctly after multiple page reloads', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // Capture console errors
            const consoleErrors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') consoleErrors.push(msg.text());
            });

            // Helper function to wait for app initialization and select page
            async function waitForAppAndSelectPage(): Promise<void> {
                await waitForAppReady(page);
                await selectFirstPage(page);

                // Wait for the image gallery iDevice to be visible in view mode
                await page.waitForSelector('#node-content .idevice_node.image-gallery', { timeout: 15000 });
                await page.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content .idevice_node.image-gallery');
                        if (!idevice) return false;
                        if (idevice.getAttribute('mode') === 'edition') return false;
                        return !!idevice.querySelector('.imageGallery-IDevice');
                    },
                    undefined,
                    { timeout: 15000 },
                );

                // Wait for AssetManager to resolve asset URLs
                await page.waitForTimeout(500);
            }

            // Helper function to verify all images load correctly
            async function verifyImagesLoadCorrectly(expectedCount: number): Promise<void> {
                const viewModeGallery = page.locator('#node-content .idevice_node.image-gallery .imageGallery-IDevice');
                await expect(viewModeGallery).toBeVisible({ timeout: 10000 });

                const galleryImages = viewModeGallery.locator('img');
                await expect(galleryImages).toHaveCount(expectedCount, { timeout: 10000 });

                for (let i = 0; i < expectedCount; i++) {
                    await expect(galleryImages.nth(i)).toBeVisible({ timeout: 10000 });

                    const result = await page
                        .waitForFunction(
                            (idx: number) => {
                                const images = document.querySelectorAll(
                                    '#node-content .idevice_node.image-gallery .imageGallery-IDevice img',
                                );
                                const img = images[idx] as HTMLImageElement;
                                if (!img) return null;
                                if (img.complete && img.naturalWidth > 0) {
                                    return {
                                        loaded: true,
                                        naturalWidth: img.naturalWidth,
                                        src: img.getAttribute('src')?.substring(0, 100),
                                    };
                                }
                                return null;
                            },
                            i,
                            { timeout: 30000 },
                        )
                        .then(handle => handle.jsonValue())
                        .catch(async () => {
                            const debugState = await page.evaluate((idx: number) => {
                                const images = document.querySelectorAll(
                                    '#node-content .idevice_node.image-gallery .imageGallery-IDevice img',
                                );
                                const img = images[idx] as HTMLImageElement;
                                if (!img) return { error: 'Image element not found' };
                                return {
                                    loaded: false,
                                    naturalWidth: img.naturalWidth,
                                    src: img.getAttribute('src')?.substring(0, 100),
                                    origin: img.getAttribute('origin')?.substring(0, 100),
                                    complete: img.complete,
                                };
                            }, i);
                            return debugState;
                        });

                    expect(result?.loaded).toBe(true);
                    expect(result?.naturalWidth).toBeGreaterThan(0);
                }
            }

            // Helper function to modify an image at a specific index
            async function modifyImageAtIndex(index: number, newImagePath: string): Promise<void> {
                // Enter edit mode
                const galleryIdevice = page.locator('#node-content .idevice_node.image-gallery').first();
                const editBtn = galleryIdevice.locator('.btn-edit-idevice, [data-action="edit"]').first();
                if ((await editBtn.count()) > 0) {
                    await editBtn.click();
                }

                // Wait for edit mode
                await page.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
                        return idevice && idevice.getAttribute('mode') === 'edition';
                    },
                    undefined,
                    { timeout: 15000 },
                );
                // Wait for MutationObserver to process images and set data-asset-url attributes
                await page.waitForTimeout(500);

                // Click modify button on the specified image
                await page.locator('.imgSelectContainer').nth(index).locator('button.modify').click();

                // Wait for File Manager modal to open
                await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', {
                    timeout: 10000,
                });

                // Upload and select the new image
                await page.locator('#modalFileManager input[type="file"]').first().setInputFiles(newImagePath);
                await page.waitForSelector('#modalFileManager .media-library-item:not(.media-library-folder)', {
                    timeout: 15000,
                });
                await page.waitForTimeout(500);

                await page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').last().click();
                await page.waitForTimeout(300);
                await page.click('#modalFileManager .media-library-insert-btn');
                await page.waitForTimeout(500);

                // Save the iDevice and project
                await saveGalleryIdevice(page);
                await workarea.save();
                await page.waitForTimeout(500);
            }

            // ============ STEP 1: Create project and add two images ============
            const projectUuid = await createProject(page, 'Image Gallery Multi-Modify Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            await uploadImagesToGallery(page, ['test/fixtures/sample-2.jpg', 'test/fixtures/sample-3.jpg']);
            await expect(page.locator('.imgSelectContainer')).toHaveCount(2, { timeout: 10000 });

            await saveGalleryIdevice(page);
            await workarea.save();
            await page.waitForTimeout(500);

            // ============ STEP 2: Reload and verify both images display ============
            await reloadPage(page);
            await waitForAppAndSelectPage();
            await verifyImagesLoadCorrectly(2);

            // ============ STEP 3: Modify first image ============
            await modifyImageAtIndex(0, 'test/fixtures/sample-3.jpg');

            // ============ STEP 4: Reload and verify both images still display ============
            await reloadPage(page);
            await waitForAppAndSelectPage();
            await verifyImagesLoadCorrectly(2);

            // ============ STEP 5: Modify second image ============
            await modifyImageAtIndex(1, 'test/fixtures/sample-2.jpg');

            // ============ STEP 6: Final reload and verification ============
            await reloadPage(page);
            await waitForAppAndSelectPage();
            await verifyImagesLoadCorrectly(2);

            // Verify NO ERR_FILE_NOT_FOUND errors for blob URLs
            expect(consoleErrors.filter(e => e.includes('ERR_FILE_NOT_FOUND') && e.includes('blob:'))).toHaveLength(0);
        });
    });

    test.describe('Folder Path Support', () => {
        /**
         * Helper to open file manager from image gallery "Add images" button
         */
        async function openFileManagerFromGallery(page: Page): Promise<void> {
            await page.click('#addImageButton');
            await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', {
                timeout: 10000,
            });
            await page.waitForTimeout(500);
        }

        /**
         * Helper to create a folder in file manager
         */
        async function createFolderInFileManager(page: Page, folderName: string): Promise<void> {
            page.once('dialog', async dialog => {
                await dialog.accept(folderName);
            });
            await page.click('.media-library-newfolder-btn');
            await page.waitForSelector(`.media-library-folder[data-folder-name="${folderName}"]`, { timeout: 5000 });
        }

        /**
         * Helper to navigate into a folder by double-clicking
         */
        async function navigateToFolder(page: Page, folderName: string): Promise<void> {
            await page.locator(`.media-library-folder[data-folder-name="${folderName}"]`).dblclick();
            await page.waitForTimeout(500);
        }

        /**
         * Helper to upload an image and select it in the file manager
         */
        async function uploadAndSelectImage(page: Page, fixturePath: string): Promise<void> {
            await page.locator('#modalFileManager input[type="file"]').first().setInputFiles(fixturePath);
            await page.waitForSelector('#modalFileManager .media-library-item:not(.media-library-folder)', {
                timeout: 15000,
            });
            await page.waitForTimeout(500);
            await page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').last().click();
            await page.waitForTimeout(300);
            await page.click('#modalFileManager .media-library-insert-btn');
            await page.waitForTimeout(500);
        }

        test('should load images from different folder depths in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Folder Depth Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'image-gallery');

            // 1. Add image from ROOT level via file manager
            await openFileManagerFromGallery(page);
            await uploadAndSelectImage(page, 'test/fixtures/sample-2.jpg');
            const imageContainers = page.locator('.imgSelectContainer');
            await expect(imageContainers).toHaveCount(1, { timeout: 10000 });

            // 2. Add image from ONE LEVEL folder
            await openFileManagerFromGallery(page);
            await createFolderInFileManager(page, 'photos');
            await navigateToFolder(page, 'photos');
            await uploadAndSelectImage(page, 'test/fixtures/sample-3.jpg');
            await expect(imageContainers).toHaveCount(2, { timeout: 10000 });

            // 3. Add image from NESTED folders (2 levels: photos/vacation)
            await openFileManagerFromGallery(page);
            await navigateToFolder(page, 'photos');
            await createFolderInFileManager(page, 'vacation');
            await navigateToFolder(page, 'vacation');
            // Reuse sample-2.jpg - we're testing path handling, not unique images
            await uploadAndSelectImage(page, 'test/fixtures/sample-2.jpg');
            await expect(imageContainers).toHaveCount(3, { timeout: 15000 });

            // Save the iDevice and project
            await saveGalleryIdevice(page);
            await workarea.save();
            await page.waitForTimeout(500);

            // Open preview panel using helper (handles Service Worker check)
            const previewLoaded = await waitForPreviewContent(page, 30000);
            expect(previewLoaded).toBe(true);

            const iframe = getPreviewFrame(page);

            // Verify gallery exists in preview with all 3 images
            await expect(iframe.locator('.imageGallery-IDevice')).toBeVisible({ timeout: 10000 });
            const previewImages = iframe.locator('.imageGallery-IDevice img');
            await expect(previewImages).toHaveCount(3, { timeout: 10000 });

            // Check each image loads with naturalWidth > 0
            for (let i = 0; i < 3; i++) {
                await previewImages.nth(i).waitFor({ state: 'attached', timeout: 10000 });

                const result = await iframe.locator('body').evaluate(async (_, idx: number) => {
                    const images = document.querySelectorAll('.imageGallery-IDevice img');
                    const img = images[idx] as HTMLImageElement;
                    if (!img) return { loaded: false, src: '', naturalWidth: 0 };

                    if (!img.complete) {
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            setTimeout(reject, 5000);
                        }).catch(() => {});
                    }

                    return {
                        loaded: img.complete && img.naturalWidth > 0,
                        src: img.getAttribute('src'),
                        naturalWidth: img.naturalWidth,
                    };
                }, i as number);

                expect(result.loaded).toBe(true);
                expect(result.naturalWidth).toBeGreaterThan(0);
            }
        });
    });
});
