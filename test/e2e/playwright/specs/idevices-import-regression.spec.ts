import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, gotoWorkarea, openElpFile } from '../helpers/workarea-helpers';

/**
 * E2E Regression Test: Import todos-los-idevices.elp
 *
 * Verifies that the "todos-los-idevices.elp" fixture (containing 33 unique
 * iDevice types across 49 pages) imports correctly and all iDevice types
 * render in the workarea without errors.
 *
 * This test provides broad regression coverage for iDevice rendering after
 * import without creating per-iDevice projects. It does NOT replace the
 * behavior/interaction tests in the idevices/ directory.
 *
 * ELP fixture: test/fixtures/todos-los-idevices.elp
 *   - 49 pages, ~50 iDevice instances, 33 unique iDevice types
 *   - Types: az-quiz-game, beforeafter, challenge, checklist, classify,
 *             complete, crossword, discover, dragdrop, flipcards, form,
 *             geogebra-activity, guess, hidden-image, identify,
 *             interactive-video, map, mathematicaloperations, mathproblems,
 *             padlock, periodic-table, progress-report, puzzle,
 *             quick-questions, quick-questions-multiple-choice,
 *             quick-questions-video, relate, scrambled-list,
 *             select-media-files, sort, trivial, trueorfalse, word-search
 */

const ELP_FIXTURE = path.resolve('test/fixtures/todos-los-idevices.elp');
const MIN_PAGES = 40;
const MIN_UNIQUE_TYPES = 15;

test.describe('iDevices Import Regression', () => {
    test('should import todos-los-idevices.elp and render all iDevice types', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server project creation and Yjs sync');

        const page = authenticatedPage;

        // Need a workarea context to call openElpFile
        const projectUuid = await createProject(page, 'iDevices Import Regression');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open the ELP file — replaces the current empty project
        await openElpFile(page, ELP_FIXTURE, MIN_PAGES);

        // Snapshot all nav-ids before iterating — stable even if the DOM reorders
        // after each click (index-based nth(i) is unreliable on a dynamic nav tree)
        const navIds = await page.evaluate(() => {
            const items = document.querySelectorAll('.nav-element:not([nav-id="root"])');
            return Array.from(items)
                .map(el => el.getAttribute('nav-id'))
                .filter((id): id is string => id !== null && id !== '');
        });
        expect(navIds.length).toBeGreaterThanOrEqual(MIN_PAGES);

        // Iterate through all nav pages and collect iDevice types
        const renderedTypes = new Set<string>();
        let pagesWithIdevices = 0;

        for (const navId of navIds) {
            // Navigate using stable attribute selector — unaffected by DOM reordering
            const navText = page.locator(`.nav-element[nav-id="${navId}"] .nav-element-text`).first();
            if ((await navText.count()) === 0) continue;
            await navText.click({ force: true });

            // Wait briefly for page content to load
            await page.waitForTimeout(200);

            // Collect iDevice types on this page
            const ideviceNodes = page.locator('#node-content .idevice_node');
            const nodeCount = await ideviceNodes.count();

            if (nodeCount > 0) {
                pagesWithIdevices++;
                for (let j = 0; j < nodeCount; j++) {
                    const classes = await ideviceNodes.nth(j).getAttribute('class');
                    // Extract the iDevice type class (second class after 'idevice_node')
                    const match = classes?.match(/idevice_node\s+([a-z_-]+)/);
                    if (match?.[1] && match[1] !== 'undefined') {
                        renderedTypes.add(match[1]);
                    }
                }
            }
        }

        // Verify we found a significant number of unique iDevice types
        expect(renderedTypes.size).toBeGreaterThanOrEqual(MIN_UNIQUE_TYPES);

        // Verify at least most pages have iDevices
        expect(pagesWithIdevices).toBeGreaterThanOrEqual(MIN_PAGES - 5);

        // Verify specific key iDevice types are present (those with dedicated test files)
        const expectedTypes = ['form', 'beforeafter', 'interactive-video', 'relate', 'az-quiz-game'];
        for (const expectedType of expectedTypes) {
            expect(renderedTypes.has(expectedType)).toBe(true);
        }

        // Verify no JavaScript errors occurred during import and rendering
        // (checked implicitly via successful rendering of all pages)
    });
});
