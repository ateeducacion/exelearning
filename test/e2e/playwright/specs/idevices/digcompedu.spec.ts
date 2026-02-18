import { test, expect } from '../../fixtures/auth.fixture';
import {
    reloadPage,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    addIdevice,
} from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';

/**
 * E2E Tests for DigCompEdu iDevice
 *
 * Tests the DigCompEdu iDevice functionality including:
 * - Adding the iDevice and loading framework data
 * - Selecting indicators via checkboxes
 * - Changing selection granularity (competence, level, indicator)
 * - Filtering by level
 * - Previewing summary modal
 * - Saving and persistence
 * - Preview rendering with summary table
 */

/**
 * Helper to wait for the DigCompEdu framework data to load
 */
async function waitForFrameworkDataLoaded(page: import('@playwright/test').Page): Promise<void> {
    await page.locator('.digcompedu-editor').first().waitFor({ timeout: 15000 });

    await page.waitForFunction(
        () => {
            const tableBody = document.querySelector('#digcompeduTableBody');
            const errorEl = document.querySelector('.digcompedu-error');
            if (errorEl) {
                throw new Error('Framework data could not be loaded');
            }
            return tableBody && tableBody.querySelectorAll('tr').length > 0;
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to select indicators by clicking checkboxes
 */
async function selectIndicators(page: import('@playwright/test').Page, count: number): Promise<string[]> {
    const checkboxes = await page.locator('#digcompeduTableBody input[type="checkbox"]').all();
    const selectedIds: string[] = [];

    for (let i = 0; i < Math.min(count, checkboxes.length); i++) {
        const checkbox = checkboxes[i];
        const id = await checkbox.getAttribute('value');
        await checkbox.click();
        if (id) selectedIds.push(id);
    }

    return selectedIds;
}

/**
 * Helper to save the DigCompEdu iDevice
 */
async function saveDigcompeduIdevice(page: import('@playwright/test').Page): Promise<void> {
    const saveBtn = page.locator('#node-content article .idevice_node.digcompedu .btn-save-idevice');
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.digcompedu');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

test.describe('DigCompEdu iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add iDevice, load framework data, and select indicators', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Basic Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'digcompedu');

            await waitForFrameworkDataLoaded(page);

            // Verify structure
            const tableBody = page.locator('#digcompeduTableBody');
            const rowCount = await tableBody.locator('tr').count();
            expect(rowCount).toBeGreaterThan(0);

            const checkboxCount = await tableBody.locator('input[type="checkbox"]').count();
            expect(checkboxCount).toBeGreaterThan(0);

            // Verify initial counter state
            const counter = page.locator('#digcompeduSelectionCounter');
            await expect(counter).toContainText(/No items selected|Ningún elemento/i, { timeout: 5000 });

            // Select 3 indicators and verify counter
            await selectIndicators(page, 3);
            await expect(counter).toContainText(/Selected items: 3|Elementos seleccionados: 3/i, { timeout: 5000 });
        });

        test('should filter indicators by level', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Filter Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'digcompedu');

            await waitForFrameworkDataLoaded(page);

            const initialRowCount = await page.locator('#digcompeduTableBody tr').count();

            // Uncheck all levels except A1
            const levelFilters = ['A2', 'B1', 'B2', 'C1', 'C2'];
            for (const level of levelFilters) {
                const checkbox = page.locator(`#digcompedu-filter-${level.toLowerCase()}`);
                if (await checkbox.isChecked()) {
                    await checkbox.click();
                }
            }

            await page.waitForTimeout(500);

            const filteredRowCount = await page.locator('#digcompeduTableBody tr').count();
            expect(filteredRowCount).toBeLessThan(initialRowCount);
            expect(filteredRowCount).toBeGreaterThan(0);
        });

        test('should preview summary in modal and reset selection', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Summary Modal Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'digcompedu');

            await waitForFrameworkDataLoaded(page);

            await selectIndicators(page, 5);

            // Preview summary
            const previewBtn = page.locator('#digcompeduPreviewSummary');
            await previewBtn.click();

            const modal = page.locator('#digcompeduSummaryModal[aria-hidden="false"]');
            await expect(modal).toBeVisible({ timeout: 5000 });

            const summaryTable = page.locator('#digcompeduSummaryTablePreview table');
            await expect(summaryTable).toBeVisible({ timeout: 5000 });

            const headerCells = summaryTable.locator('thead th');
            const headerCount = await headerCells.count();
            expect(headerCount).toBeGreaterThan(0);

            await page.locator('#digcompeduSummaryModalClose').click();
            await expect(modal).toBeHidden({ timeout: 5000 });

            // Reset selection
            const counter = page.locator('#digcompeduSelectionCounter');
            await expect(counter).toContainText(/Selected items: 5|Elementos seleccionados: 5/i, { timeout: 5000 });

            const resetBtn = page.locator('#digcompeduResetSelection');
            await resetBtn.click();
            await expect(counter).toContainText(/No items selected|Ningún elemento/i, { timeout: 5000 });
        });

        test('should save, persist after reload, and filter with search input', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'DigCompEdu Save Persist Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'digcompedu');

            await waitForFrameworkDataLoaded(page);

            // Test search
            const initialRowCount = await page.locator('#digcompeduTableBody tr').count();
            const searchInput = page.locator('#digcompeduSearch');
            await searchInput.fill('comunicación');
            await page.waitForTimeout(500);

            const filteredRowCount = await page.locator('#digcompeduTableBody tr').count();
            expect(filteredRowCount).toBeLessThan(initialRowCount);
            expect(filteredRowCount).toBeGreaterThan(0);

            await searchInput.clear();
            await page.waitForTimeout(500);
            const restoredRowCount = await page.locator('#digcompeduTableBody tr').count();
            expect(restoredRowCount).toBe(initialRowCount);

            // Select indicators and save
            await selectIndicators(page, 3);
            await saveDigcompeduIdevice(page);

            await workarea.save();

            await reloadPage(page);

            await selectFirstPage(page);

            const idevice = page.locator('#node-content article .idevice_node.digcompedu');
            await expect(idevice).toBeVisible({ timeout: 15000 });

            const summaryContent = idevice.locator('.digcompeduIdeviceContent');
            await expect(summaryContent).toBeVisible({ timeout: 10000 });
            await expect(summaryContent).toContainText(/Selected indicators|Indicadores seleccionados/i, {
                timeout: 5000,
            });
        });
    });

    test.describe('Selection Granularity', () => {
        test('should change selection granularity to level', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Granularity Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'digcompedu');

            await waitForFrameworkDataLoaded(page);

            const levelRadio = page.locator('#digcompedu-granularity-level');
            await levelRadio.click();

            const firstCheckbox = page.locator('#digcompeduTableBody input[type="checkbox"]').first();
            await firstCheckbox.click();

            const counter = page.locator('#digcompeduSelectionCounter');
            const counterText = await counter.textContent();
            expect(counterText).toMatch(/Selected items|Elementos seleccionados/i);
        });
    });

    test.describe('Preview Rendering', () => {
        test('should display summary table and textual summary in preview panel', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'DigCompEdu Preview Test');
            await gotoWorkarea(page, projectUuid);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Information|Información/i);
            await addIdevice(page, 'digcompedu');

            await waitForFrameworkDataLoaded(page);

            // Select "Table + textual summary" display mode
            const tableSummaryRadio = page.locator('#digcompeduDisplayTableSummary');
            await tableSummaryRadio.click();

            await selectIndicators(page, 5);
            await saveDigcompeduIdevice(page);

            await workarea.save();

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            const digcompeduContent = iframe.locator('.digcompeduIdeviceContent').first();
            await expect(digcompeduContent).toBeVisible({ timeout: 10000 });

            // Verify summary table with colored area headers
            const summaryTable = iframe.locator('.digcompedu-summary-table').first();
            await expect(summaryTable).toBeVisible({ timeout: 10000 });

            const areaHeaders = summaryTable.locator('thead th[class*="area"]');
            const areaCount = await areaHeaders.count();
            expect(areaCount).toBeGreaterThan(0);

            // Verify textual summary (in table+summary mode)
            const textSummary = iframe.locator('.digcompedu-text-summary').first();
            await expect(textSummary).toBeVisible({ timeout: 10000 });

            const summaryHeadings = textSummary.locator('h6');
            const headingCount = await summaryHeadings.count();
            expect(headingCount).toBeGreaterThan(0);
        });
    });
});
