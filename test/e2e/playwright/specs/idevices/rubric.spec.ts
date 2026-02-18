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

/**
 * E2E Tests for Rubric iDevice
 *
 * Tests the Rubric iDevice functionality including:
 * - Basic operations (add, create new rubric, edit, save)
 * - Editing rubric content (title, criteria, levels, descriptors, weights)
 * - Persistence after reload
 * - Preview rendering with Apply button
 */

const TEST_DATA = {
    projectTitle: 'Rubric E2E Test Project',
    rubricTitle: 'E2E Test Rubric',
    editedDescriptor: 'E2E edited descriptor content',
    weight: '5',
};

/**
 * Helper to create a new rubric by clicking the "New rubric" button
 */
async function createNewRubric(page: import('@playwright/test').Page): Promise<void> {
    const newRubricBtn = page.locator('#ri_CreateNewRubric');
    await newRubricBtn.waitFor({ state: 'visible', timeout: 10000 });
    await newRubricBtn.click();
    await page.locator('#ri_Table').waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Helper to edit rubric content
 */
async function editRubricContent(
    page: import('@playwright/test').Page,
    title: string,
    descriptor?: string,
    weight?: string,
): Promise<void> {
    const titleInput = page.locator('#ri_Cell-0');
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.clear();
    await titleInput.fill(title);

    if (descriptor) {
        const descriptorInput = page.locator('#ri_Cell-7');
        if ((await descriptorInput.count()) > 0) {
            await descriptorInput.clear();
            await descriptorInput.fill(descriptor);
        }
    }

    if (weight) {
        const weightInput = page.locator('#ri_Cell-7-weight');
        if ((await weightInput.count()) > 0) {
            await weightInput.clear();
            await weightInput.fill(weight);
        }
    }
}

/**
 * Helper to save the rubric iDevice
 */
async function saveRubricIdevice(page: import('@playwright/test').Page): Promise<void> {
    const saveBtn = page
        .locator('#node-content article .idevice_node.rubric button')
        .filter({ hasText: /^Save$|^Guardar$/i })
        .first();
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const editableInputs = document.querySelectorAll('#ri_Table input');
            const normalTable = document.querySelector('#node-content .rubric .exe-table');
            return editableInputs.length === 0 && normalTable !== null;
        },
        undefined,
        { timeout: 15000 },
    );
}

test.describe('Rubric iDevice', () => {
    test.describe('Workflow', () => {
        test('should add rubric, create, edit, save, and persist after reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Rubric Workflow Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            // Add rubric iDevice using centralized helpers
            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'rubric');

            // Verify iDevice was added
            const rubricIdevice = page.locator('#node-content article .idevice_node.rubric').first();
            await expect(rubricIdevice).toBeVisible({ timeout: 10000 });

            // Create new rubric and verify structure
            await createNewRubric(page);
            const rubricTable = page.locator('#ri_Table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });
            const theadThs = page.locator('#ri_Table thead th');
            await expect(theadThs).toHaveCount(5, { timeout: 5000 }); // 1 empty + 4 levels
            const tbodyTrs = page.locator('#ri_Table tbody tr');
            await expect(tbodyTrs).toHaveCount(4, { timeout: 5000 });

            // Edit rubric content
            const uniqueTitle = `Persistence Test Rubric ${Date.now()}`;
            await editRubricContent(page, uniqueTitle, TEST_DATA.editedDescriptor, TEST_DATA.weight);

            // Save the iDevice and verify display
            await saveRubricIdevice(page);
            const savedTable = page.locator('#node-content .rubric .exe-table');
            await expect(savedTable).toBeVisible({ timeout: 10000 });
            const caption = page.locator('#node-content .rubric .exe-table caption');
            await expect(caption).toContainText(uniqueTitle, { timeout: 5000 });
            await expect(page.locator('#node-content .rubric')).toContainText(TEST_DATA.editedDescriptor, {
                timeout: 5000,
            });
            await expect(page.locator('#node-content .rubric')).toContainText(`(${TEST_DATA.weight})`, {
                timeout: 5000,
            });

            // Save project and reload to verify persistence
            await workarea.save();

            await reloadPage(page);

            // Navigate to the page after reload
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
            }

            await expect(page.locator('#node-content .rubric')).toContainText(uniqueTitle, { timeout: 15000 });
            await expect(page.locator('#node-content .rubric .exe-table')).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Preview', () => {
        test('should display rubric table correctly in preview with Apply button', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Rubric Preview Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'rubric');
            await createNewRubric(page);

            const previewTitle = `Preview Test Rubric ${Date.now()}`;
            await editRubricContent(page, previewTitle, 'Preview descriptor', '3');
            await saveRubricIdevice(page);

            await workarea.save();

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify rubric table is displayed
            const rubricTable = iframe.locator('.rubric .exe-table, .idevice_node.rubric .exe-table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });

            const caption = iframe.locator('.rubric .exe-table caption, .idevice_node.rubric .exe-table caption');
            await expect(caption).toContainText(previewTitle, { timeout: 5000 });

            // Verify Apply button
            const applyButton = iframe.locator('a.exe-rubrics-print');
            await expect(applyButton).toBeVisible({ timeout: 10000 });
            await expect(applyButton).toContainText(/Apply|Aplicar/i, { timeout: 5000 });

            await expect(iframe.locator('.rubric, .idevice_node.rubric')).toContainText('Preview descriptor', {
                timeout: 5000,
            });
            await expect(iframe.locator('.rubric, .idevice_node.rubric')).toContainText('(3)', { timeout: 5000 });

            // Verify i18n strings list
            const rubricStrings = iframe.locator(
                '.rubric .exe-rubrics-strings, .idevice_node.rubric .exe-rubrics-strings',
            );
            await expect(rubricStrings).toBeAttached({ timeout: 5000 });
            await expect(rubricStrings.locator('li.activity')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.name')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.date')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.score')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.apply')).toBeAttached({ timeout: 2000 });
        });
    });
});
