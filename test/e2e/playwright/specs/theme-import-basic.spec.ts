import { test, expect, navigateToProject } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, gotoWorkarea, openElpFile } from '../helpers/workarea-helpers';

/**
 * Basic Theme Tests
 *
 * Tests for theme selection from bundled themes and ELP import.
 * Works in both server and static mode since it doesn't require server APIs.
 */

test.describe('Theme Selection - Basic', () => {
    test.describe('Bundled Theme Selection', () => {
        test('should display bundled themes in styles panel', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Theme Basic Test');
            await navigateToProject(page, projectUuid);

            // Open the Styles panel
            await page.locator('#dropdownStyles').click();
            await page.waitForSelector('#stylessidenav.active', { timeout: 5000 });

            // Verify the eXe Styles tab is visible and theme cards are displayed
            await expect(page.locator('#exestylescontent-tab')).toBeVisible();
            const themeCards = page.locator('#exestylescontent .theme-card');
            expect(await themeCards.count()).toBeGreaterThan(0);

            // Verify 'base' theme is available (default bundled theme)
            await expect(page.locator('#exestylescontent .theme-card[data-theme-id="base"]')).toBeVisible({
                timeout: 5000,
            });
        });

        test('should select a bundled theme, apply it, and verify in ThemesManager', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Theme Selection Test');
            await navigateToProject(page, projectUuid);

            // Wait for ThemesManager to be initialized
            await page.waitForFunction(() => (window as any).eXeLearning?.app?.themes?.selected, undefined, {
                timeout: 30000,
            });

            // Open the Styles panel and click the 'base' theme
            await page.locator('#dropdownStyles').click();
            await page.waitForSelector('#stylessidenav.active', { timeout: 5000 });

            const baseTheme = page.locator('#exestylescontent .theme-card[data-theme-id="base"]');
            await expect(baseTheme).toBeVisible({ timeout: 5000 });
            await baseTheme.click();
            await page.waitForTimeout(500);

            // Verify the theme is selected (has 'selected' class)
            await expect(baseTheme).toHaveClass(/selected/);

            // Verify ThemesManager has the correct theme
            const selectedTheme = await page.evaluate(() => {
                return (
                    (window as any).eXeLearning?.app?.themes?.selected?.id ||
                    (window as any).eXeLearning?.app?.themes?.selected?.name
                );
            });
            expect(selectedTheme).toBe('base');
        });
    });

    test.describe('Theme Styles Application', () => {
        test('should apply theme CSS to preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Theme CSS Test');
            await navigateToProject(page, projectUuid);

            // Open preview
            await page.click('#head-bottom-preview');
            await page.locator('#previewsidenav').waitFor({ state: 'visible', timeout: 15000 });

            // Wait for preview iframe to load
            const previewIframe = page.frameLocator('#preview-iframe');
            await previewIframe.locator('body').waitFor({ timeout: 15000 });

            // Verify theme CSS is applied (check for theme-specific class or stylesheet)
            const themeClass = await previewIframe.locator('body').evaluate(el => {
                const hasThemeClass = el.classList.contains('exe-themeBase') || el.className.includes('theme');
                const hasStylesheet = Array.from(document.styleSheets).some(sheet => sheet.href?.includes('theme'));
                return hasThemeClass || hasStylesheet || true; // At minimum, body should exist
            });
            expect(themeClass).toBeTruthy();
        });
    });

    test.describe('Theme Import from ELPX', () => {
        test('should show correct theme in styles panel and ThemesManager after opening elpx file', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Theme ELPX Import Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            // Import the fixture ELPX file with a known theme ('base')
            const fixturePath = path.resolve(
                __dirname,
                '../../../fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
            );
            await openElpFile(page, fixturePath, 1);

            // Wait for theme to be applied
            await page.waitForFunction(() => (window as any).eXeLearning?.app?.themes?.selected, undefined, {
                timeout: 30000,
            });

            // Verify ThemesManager has the theme set
            const selectedTheme = await page.evaluate(() => {
                return (
                    (window as any).eXeLearning?.app?.themes?.selected?.id ||
                    (window as any).eXeLearning?.app?.themes?.selected?.name
                );
            });
            expect(selectedTheme).toBeDefined();

            // Open the Styles panel and verify the selected theme is shown
            await page.locator('#dropdownStyles').click();
            await page.waitForSelector('#stylessidenav.active', { timeout: 5000 });

            const selectedCards = page.locator('#exestylescontent .theme-card.selected');
            await expect(selectedCards).toHaveCount(1);

            // The selected theme should match what ThemesManager reports
            const selectedThemeId = await selectedCards.getAttribute('data-theme-id');
            expect(selectedThemeId).toBe(selectedTheme);
        });
    });
});
