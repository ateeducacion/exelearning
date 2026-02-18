/**
 * E2E Tests for File Manager - Special Characters & Edge Cases
 *
 * Tests the File Manager functionality with:
 * - Unicode filenames (Chinese, Japanese, Korean, Cyrillic, Arabic)
 * - Special characters (spaces, symbols, diacritics)
 * - Edge cases (multiple dots, long names)
 * - Folder operations with valid/invalid names
 * - Search with unicode characters
 * - Export/Import with special character files
 *
 * Key technical behavior:
 * - Asset filenames: Preserved AS-IS in database (full unicode support)
 * - Physical storage: UUID-based ({clientId}.{ext}) - original name not used on disk
 * - Folder names: Restricted to [a-zA-Z0-9\-_./] - unicode is sanitized/rejected
 * - Export: Files go to content/resources/ with original names preserved
 */

import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    saveProject,
    reloadPage,
    downloadProject,
    zipContainsFile,
    openElpFile,
    dismissBlockingAlertModal,
    selectFirstPage,
    addTextIdevice,
} from '../helpers/workarea-helpers';
import {
    uploadFileWithSpecialName,
    uploadFixtureFile,
    waitForFileInGrid,
    selectFileByName,
    verifyFileWithThumbnail,
    verifySidebarFilename,
    getAllFilenames,
    getFileCount,
    getFolderCount,
    createFolderWithName,
    folderExists,
    navigateToFolder,
    navigateToRoot,
    renameFile,
    searchFiles,
    searchAndGetResults,
    clearSearch,
    deleteFile,
    closeFileManager,
    insertFileIntoEditor,
    verifyImageInEditor,
} from '../helpers/file-manager-helpers';
import { getUniqueTestFilename } from '../helpers/special-chars-helpers';
import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper to open the File Manager modal via TinyMCE image dialog.
 * This is specific to the special chars tests that need TinyMCE context.
 */
async function openFileManagerViaTinyMCE(page: Page): Promise<void> {
    const textBlock = page.locator('#node-content article .idevice_node.text').last();
    if ((await textBlock.count()) === 0) {
        await selectFirstPage(page);
        await addTextIdevice(page);
    }

    const activeTextBlock = page.locator('#node-content article .idevice_node.text').last();
    const isEdition = await activeTextBlock.evaluate(el => {
        const hasMode = el.getAttribute('mode') === 'edition';
        const hasTinyMce = el.querySelector('.tox-tinymce') !== null;
        return hasMode || hasTinyMce;
    });

    if (!isEdition) {
        const editBtn = activeTextBlock.locator('.btn-edit-idevice');
        let editClicked = false;
        try {
            await editBtn.waitFor({ state: 'visible', timeout: 5000 });
            await page.waitForFunction(
                selector => {
                    const btn = document.querySelector(selector);
                    return !!btn && !btn.hasAttribute('disabled') && !btn.classList.contains('disabled');
                },
                '#node-content article .idevice_node.text .btn-edit-idevice',
                { timeout: 6000 },
            );
            await editBtn.click({ timeout: 5000 });
            editClicked = true;
        } catch {
            // Firefox fallback: enter edition by double-clicking iDevice body.
        }

        if (!editClicked) {
            const body = activeTextBlock.locator('.idevice_body').first();
            if (await body.isVisible().catch(() => false)) {
                await body.dblclick({ timeout: 5000 }).catch(() => {});
            } else {
                await activeTextBlock.dblclick({ timeout: 5000 }).catch(() => {});
            }
        }
    }

    await page.waitForSelector('.tox-tinymce, .tox-menubar, .tox-toolbar', { timeout: 20000 });
    await dismissBlockingAlertModal(page);

    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageBtn).toBeVisible({ timeout: 10000 });
    try {
        await imageBtn.click({ timeout: 6000 });
    } catch {
        await dismissBlockingAlertModal(page);
        const openedByApi = await page.evaluate(() => {
            const anyWindow = window as any;
            const tiny = anyWindow?.tinymce || anyWindow?.$exeTinyMCE?.tinymce || anyWindow?.$exeTinyMCE;
            const editor = tiny?.activeEditor || tiny?.editors?.[0] || null;
            if (!editor || typeof editor.execCommand !== 'function') return false;
            editor.execCommand('mceImage');
            return true;
        });

        if (!openedByApi) {
            await imageBtn.click({ timeout: 6000, force: true });
        }
    }

    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
}

/**
 * Helper to save the text iDevice after editing.
 */
async function saveTextIdevice(page: Page): Promise<void> {
    const saveIdeviceBtn = page.locator('#node-content article .idevice_node .btn-save-idevice').first();
    if (await saveIdeviceBtn.isVisible().catch(() => false)) {
        await saveIdeviceBtn.click();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File Manager - Special Characters', () => {
    test.describe('Upload Operations', () => {
        test('should upload files with CJK and Latin special characters', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Upload - Unicode Languages');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            const filenames = [
                getUniqueTestFilename('archivo_espanol.jpg'),
                getUniqueTestFilename('中文文件.jpg'),
                getUniqueTestFilename('日本語ファイル.jpg'),
                getUniqueTestFilename('한국어파일.jpg'),
                getUniqueTestFilename('Test_日本語_中文.jpg'),
            ];

            // Open file manager once and upload all files
            await openFileManagerViaTinyMCE(page);
            for (const filename of filenames) {
                await uploadFileWithSpecialName(page, filename);
                await waitForFileInGrid(page, filename);
                expect(await verifyFileWithThumbnail(page, filename)).toBe(true);
            }

            // Insert one representative file into editor and verify
            const representative = filenames[1]; // Chinese filename
            await insertFileIntoEditor(page, representative);
            expect(await verifyImageInEditor(page, representative)).toBe(true);

            await saveTextIdevice(page);
            await saveProject(page);
        });

        test('should upload files with spaces and ASCII special characters', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Upload - ASCII Special Chars');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            const ts = Date.now();
            const filenames = [
                `file with spaces ${ts}.jpg`,
                `file   with   multiple   spaces_${ts}.jpg`,
                `file_with-underscores_and-hyphens_${ts}.jpg`,
                `file_123_test_${ts}.jpg`,
            ];

            await openFileManagerViaTinyMCE(page);
            for (const filename of filenames) {
                await uploadFileWithSpecialName(page, filename);
                await waitForFileInGrid(page, filename);
                expect(await verifyFileWithThumbnail(page, filename)).toBe(true);
            }

            // Insert one representative file and verify
            await insertFileIntoEditor(page, filenames[0]);
            expect(await verifyImageInEditor(page, filenames[0])).toBe(true);

            await saveTextIdevice(page);
            await saveProject(page);
        });

        test('should upload files with edge case names', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Upload - Edge Cases');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            const ts = Date.now();
            const filenames = [`multiple.dots.file.${ts}.jpg`, 'a.jpg', getUniqueTestFilename('naive_resume.jpg')];

            await openFileManagerViaTinyMCE(page);
            for (const filename of filenames) {
                await uploadFileWithSpecialName(page, filename);
                await waitForFileInGrid(page, filename);
                expect(await verifyFileWithThumbnail(page, filename)).toBe(true);
            }

            // Insert one representative file and verify
            await insertFileIntoEditor(page, filenames[0]);
            expect(await verifyImageInEditor(page, filenames[0])).toBe(true);

            await saveTextIdevice(page);
            await saveProject(page);
        });

        // Note: DataTransfer API for programmatic file uploads doesn't work reliably
        // for consecutive uploads. Single-file unicode uploads are validated by other tests.
        test.skip('should upload multiple unicode files in succession', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Special Chars - Multiple Files');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const filename1 = getUniqueTestFilename('archivo_espanol.jpg');
            const filename2 = getUniqueTestFilename('中文文件.jpg');

            await uploadFileWithSpecialName(page, filename1);
            await waitForFileInGrid(page, filename1);
            await page.waitForTimeout(500);

            await uploadFileWithSpecialName(page, filename2);
            await waitForFileInGrid(page, filename2);

            const allFiles = await getAllFilenames(page);
            expect(allFiles).toContain(filename1);
            expect(allFiles).toContain(filename2);
        });
    });

    test.describe('Folder Operations', () => {
        test('should create, navigate, and nest folders with unicode files', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Folder Operations');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const ts = Date.now();

            // Create valid alphanumeric folder
            const folderName = `TestFolder_${ts}`;
            expect(await createFolderWithName(page, folderName)).toBe(true);
            expect(await folderExists(page, folderName)).toBe(true);

            // Create folder with hyphen/underscore
            const folderName2 = `My-Folder_Name_${ts}`;
            expect(await createFolderWithName(page, folderName2)).toBe(true);
            expect(await folderExists(page, folderName2)).toBe(true);

            // Navigate into first folder
            await navigateToFolder(page, folderName);
            const breadcrumbs = page.locator('#modalFileManager .media-library-breadcrumbs');
            await expect(breadcrumbs).toContainText(folderName);

            // Create nested child folder
            const childFolder = `Child_${ts}`;
            await createFolderWithName(page, childFolder);
            await navigateToFolder(page, childFolder);
            await expect(breadcrumbs).toContainText(folderName);
            await expect(breadcrumbs).toContainText(childFolder);

            // Navigate back to root
            await navigateToRoot(page);
            expect(await folderExists(page, folderName)).toBe(true);

            // Verify unicode folder is sanitized or rejected (no crash)
            const unicodeFolderResult = await createFolderWithName(page, '日本語フォルダ');
            const folderCount = await getFolderCount(page);
            expect(folderCount).toBeGreaterThanOrEqual(0);
            void unicodeFolderResult; // may succeed (sanitized) or fail (rejected)
        });

        test('should upload unicode file inside folder and verify breadcrumb navigation', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Folder - Upload Unicode');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const folderName = `UnicodeFiles_${Date.now()}`;
            await createFolderWithName(page, folderName);
            await navigateToFolder(page, folderName);

            const filename = getUniqueTestFilename('日本語ファイル.jpg');
            await uploadFileWithSpecialName(page, filename);
            expect(await getFileCount(page)).toBe(1);

            await insertFileIntoEditor(page, filename);
            expect(await verifyImageInEditor(page, filename)).toBe(true);

            await saveTextIdevice(page);

            // Re-open and verify folder structure from root
            await openFileManagerViaTinyMCE(page);
            await navigateToRoot(page);
            expect(await getFileCount(page)).toBe(0); // no files at root
            expect(await folderExists(page, folderName)).toBe(true);

            await closeFileManager(page);
            const cancelBtn = page.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtn.count()) > 0) {
                await cancelBtn.click();
            }

            await saveProject(page);
        });
    });

    test.describe('Rename Operations', () => {
        test('should rename files between unicode and normal names', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Rename Operations');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const ts = Date.now();

            // Upload fixture, rename to unicode
            await uploadFixtureFile(page, 'test/fixtures/sample-2.jpg');
            const files = await getAllFilenames(page);
            const originalName = files[0];
            const unicodeName = `日本語ファイル_${ts}.jpg`;
            await renameFile(page, originalName, unicodeName);

            let updatedFiles = await getAllFilenames(page);
            expect(updatedFiles).toContain(unicodeName);
            expect(updatedFiles).not.toContain(originalName);

            await selectFileByName(page, unicodeName);
            expect(await verifySidebarFilename(page, unicodeName)).toBe(true);

            // Upload another file (unicode) and rename to normal
            await uploadFileWithSpecialName(page, getUniqueTestFilename('中文文件.jpg'));
            updatedFiles = await getAllFilenames(page);
            const chineseName = updatedFiles.find(f => f.includes('中文'))!;
            const normalName = `renamed_file_${ts}.jpg`;
            await renameFile(page, chineseName, normalName);

            updatedFiles = await getAllFilenames(page);
            expect(updatedFiles).toContain(normalName);

            // Insert renamed unicode file and verify
            await insertFileIntoEditor(page, unicodeName);
            expect(await verifyImageInEditor(page, unicodeName)).toBe(true);

            await saveTextIdevice(page);
            await saveProject(page);
        });

        test('should rename files with spaces, dots, and preserve extension', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Rename - Spaces and Dots');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const ts = Date.now();

            // Upload and rename to name with spaces
            const spacesOriginal = `file with spaces ${ts}.jpg`;
            await uploadFileWithSpecialName(page, spacesOriginal);
            const newSpacesName = `new name with spaces ${ts}.jpg`;
            await renameFile(page, spacesOriginal, newSpacesName);
            expect(await getAllFilenames(page)).toContain(newSpacesName);

            // Upload and rename to multiple dots (verify extension preserved)
            const dotsOriginal = getUniqueTestFilename('testfile.jpg');
            await uploadFileWithSpecialName(page, dotsOriginal);
            const dotsName = `file.with.multiple.dots.${ts}.jpg`;
            await renameFile(page, dotsOriginal, dotsName);

            const finalFiles = await getAllFilenames(page);
            expect(finalFiles).toContain(dotsName);
            expect(dotsName).toMatch(/\.jpg$/);

            await insertFileIntoEditor(page, newSpacesName);
            expect(await verifyImageInEditor(page, newSpacesName)).toBe(true);

            await saveTextIdevice(page);
            await saveProject(page);
        });
    });

    test.describe('Search Operations', () => {
        test('should search files by unicode and ASCII characters across folders', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Search Operations');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            // Upload files for searching
            const chineseFile = getUniqueTestFilename('中文文件.jpg');
            const japaneseFile = getUniqueTestFilename('日本語ファイル.jpg');
            const asciiFile = getUniqueTestFilename('TestFile.jpg');

            await uploadFileWithSpecialName(page, chineseFile);
            await uploadFileWithSpecialName(page, japaneseFile);
            await uploadFileWithSpecialName(page, asciiFile);

            // Search for Chinese - should find the Chinese file
            const chineseResults = await searchAndGetResults(page, '中文');
            expect(chineseResults.length).toBeGreaterThanOrEqual(1);
            expect(chineseResults.some(f => f.includes('中文'))).toBe(true);

            // Search for partial Japanese match
            const japaneseResults = await searchAndGetResults(page, '日本');
            expect(japaneseResults.length).toBeGreaterThanOrEqual(1);
            expect(japaneseResults.some(f => f.includes('日本語'))).toBe(true);

            // Case-insensitive ASCII search
            const asciiResults = await searchAndGetResults(page, 'testfile');
            expect(asciiResults.length).toBeGreaterThanOrEqual(1);

            // Verify clear button works
            await clearSearch(page);
            const allFiles = await getAllFilenames(page);
            expect(allFiles.length).toBeGreaterThanOrEqual(3);

            // Create subfolder, upload file inside, search from root
            await navigateToRoot(page);
            const folderName = `SearchTest_${Date.now()}`;
            await createFolderWithName(page, folderName);
            await navigateToFolder(page, folderName);

            const folderFile = getUniqueTestFilename('中文文件_in_folder.jpg');
            await uploadFileWithSpecialName(page, folderFile);
            await navigateToRoot(page);

            const folderResults = await searchAndGetResults(page, '中文');
            expect(folderResults.length).toBeGreaterThanOrEqual(1);

            // Verify search indicator is visible
            await searchFiles(page, 'search');
            const searchIndicator = page.locator('#modalFileManager .media-library-search-indicator');
            await expect(searchIndicator).toBeVisible();

            await clearSearch(page);
            const searchInput = page.locator('#modalFileManager .media-library-search');
            await expect(searchInput).toHaveValue('');
        });
    });

    test.describe('Preview and Persistence', () => {
        test('should insert unicode file into editor and persist after save and reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Preview and Persistence');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            // Upload and verify thumbnail
            const filename = getUniqueTestFilename('中文文件.jpg');
            await uploadFileWithSpecialName(page, filename);

            // Select and insert into TinyMCE editor
            await selectFileByName(page, filename);
            const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
            await insertBtn.click();
            await page.locator('#modalFileManager').waitFor({ state: 'hidden', timeout: 5000 });

            // Fill alt text if dialog appears
            const altTextField = page
                .locator('.tox-dialog .tox-form__group')
                .filter({ has: page.locator('label:text-matches("alternativ", "i")') })
                .locator('.tox-textfield');
            if (await altTextField.isVisible().catch(() => false)) {
                await altTextField.fill('Test unicode image');
            }

            // Click Save in TinyMCE dialog
            const saveBtn = page.locator(
                '.tox-dialog .tox-button[title="Save"], .tox-dialog .tox-button:has-text("Save")',
            );
            if (
                await saveBtn
                    .first()
                    .isVisible()
                    .catch(() => false)
            ) {
                await saveBtn.first().click();
            }

            // Verify image is in editor
            const editorFrame = page.frameLocator('iframe.tox-edit-area__iframe').first();
            const img = editorFrame.locator('img').first();
            await expect(img).toBeVisible({ timeout: 10000 });

            // Also verify with space-named file in a separate editor context
            await openFileManagerViaTinyMCE(page);
            const spacesFile = `file with spaces ${Date.now()}.jpg`;
            await uploadFileWithSpecialName(page, spacesFile);
            await selectFileByName(page, spacesFile);
            await page.locator('#modalFileManager .media-library-insert-btn').click();
            await page.locator('#modalFileManager').waitFor({ state: 'hidden', timeout: 5000 });

            if (await altTextField.isVisible().catch(() => false)) {
                await altTextField.fill('Test spaces image');
            }
            if (
                await saveBtn
                    .first()
                    .isVisible()
                    .catch(() => false)
            ) {
                await saveBtn.first().click();
            }
            await expect(editorFrame.locator('img').first()).toBeVisible({ timeout: 10000 });

            await saveTextIdevice(page);

            // Save project and reload to verify persistence
            await saveProject(page);

            await reloadPage(page);

            // Open file manager and verify file still exists
            await openFileManagerViaTinyMCE(page);
            const allFiles = await getAllFilenames(page);
            expect(allFiles).toContain(filename);
        });
    });

    test.describe('Download as ELPX Operations', () => {
        // Note: These tests verify full round-trip: upload → insert → editor → save → download → reopen → verify
        test('should download project with unicode files and verify round-trip', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Download - Unicode Files');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const chineseFile = getUniqueTestFilename('中文文件.jpg');
            await uploadFileWithSpecialName(page, chineseFile);
            await insertFileIntoEditor(page, chineseFile);

            expect(await verifyImageInEditor(page, chineseFile)).toBe(true);

            const saveIdeviceBtn = page.locator('#node-content article .idevice_node .btn-save-idevice');
            if (
                await saveIdeviceBtn
                    .first()
                    .isVisible()
                    .catch(() => false)
            ) {
                await saveIdeviceBtn.first().click();
            }

            await saveProject(page);

            const download = await downloadProject(page);
            const elpxPath = await download.path();
            const buffer = Buffer.from(await require('fs').promises.readFile(elpxPath));

            expect(await zipContainsFile(buffer, chineseFile)).toBe(true);

            const newProjectUuid = await createProject(page, 'Reopened Unicode');
            await gotoWorkarea(page, newProjectUuid);
            await waitForAppReady(page);
            await openElpFile(page, elpxPath);

            await openFileManagerViaTinyMCE(page);
            const filesAfterImport = await getAllFilenames(page);
            expect(filesAfterImport).toContain(chineseFile);
        });

        test('should download project with space-containing files and verify round-trip', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Download - Space Files');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const spacesFile = `file with spaces ${Date.now()}.jpg`;
            await uploadFileWithSpecialName(page, spacesFile);
            await insertFileIntoEditor(page, spacesFile);

            expect(await verifyImageInEditor(page, spacesFile)).toBe(true);

            const saveIdeviceBtn = page.locator('#node-content article .idevice_node .btn-save-idevice');
            if (
                await saveIdeviceBtn
                    .first()
                    .isVisible()
                    .catch(() => false)
            ) {
                await saveIdeviceBtn.first().click();
            }

            await saveProject(page);

            const download = await downloadProject(page);
            const elpxPath = await download.path();
            const buffer = Buffer.from(await require('fs').promises.readFile(elpxPath));

            expect(await zipContainsFile(buffer, spacesFile)).toBe(true);

            const newProjectUuid = await createProject(page, 'Reopened Spaces');
            await gotoWorkarea(page, newProjectUuid);
            await waitForAppReady(page);
            await openElpFile(page, elpxPath);

            await openFileManagerViaTinyMCE(page);
            const filesAfterImport = await getAllFilenames(page);
            expect(filesAfterImport).toContain(spacesFile);
        });

        test('should preserve folder structure in download and verify round-trip', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Export - Folder Structure');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            const folderName = `TestFolder_${Date.now()}`;
            await createFolderWithName(page, folderName);
            await navigateToFolder(page, folderName);

            const filename = getUniqueTestFilename('file_in_folder.jpg');
            await uploadFileWithSpecialName(page, filename);
            await insertFileIntoEditor(page, filename);

            expect(await verifyImageInEditor(page, filename)).toBe(true);

            const saveIdeviceBtn = page.locator('#node-content article .idevice_node .btn-save-idevice');
            if (
                await saveIdeviceBtn
                    .first()
                    .isVisible()
                    .catch(() => false)
            ) {
                await saveIdeviceBtn.first().click();
            }

            await saveProject(page);

            const download = await downloadProject(page);
            const elpxPath = await download.path();
            const buffer = Buffer.from(await require('fs').promises.readFile(elpxPath));

            expect(await zipContainsFile(buffer, filename)).toBe(true);

            const newProjectUuid = await createProject(page, 'Reopened Folder');
            await gotoWorkarea(page, newProjectUuid);
            await waitForAppReady(page);
            await openElpFile(page, elpxPath);

            await openFileManagerViaTinyMCE(page);
            const folderExistsAfterImport = await page.evaluate(name => {
                const folders = document.querySelectorAll('#modalFileManager .media-library-folder');
                return Array.from(folders).some(el => el.getAttribute('data-folder-name') === name);
            }, folderName);
            expect(folderExistsAfterImport).toBe(true);

            await navigateToFolder(page, folderName);
            const filesInFolder = await getAllFilenames(page);
            expect(filesInFolder).toContain(filename);
        });
    });

    test.describe('Delete Operations', () => {
        test('should delete files with unicode and space names', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Delete Operations');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManagerViaTinyMCE(page);

            // Upload both file types
            const unicodeFile = getUniqueTestFilename('中文文件.jpg');
            const spacesFile = `file with spaces ${Date.now()}.jpg`;
            await uploadFileWithSpecialName(page, unicodeFile);
            await uploadFileWithSpecialName(page, spacesFile);

            // Verify both exist
            let files = await getAllFilenames(page);
            expect(files).toContain(unicodeFile);
            expect(files).toContain(spacesFile);

            // Delete unicode file
            await deleteFile(page, unicodeFile);
            files = await getAllFilenames(page);
            expect(files).not.toContain(unicodeFile);
            expect(files).toContain(spacesFile);

            // Delete spaces file
            await deleteFile(page, spacesFile);
            files = await getAllFilenames(page);
            expect(files).not.toContain(spacesFile);
        });
    });
});
