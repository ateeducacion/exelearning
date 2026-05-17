/**
 * E2E tests for Developer Tools (Developer menu, Style Lab, iDevice Lab).
 *
 * These tests assume the dev server is running with `APP_ENV=dev`, which is
 * the default in the Playwright web-server configuration. Production-mode
 * behavior (404 + hidden menu) is covered by the backend unit tests in
 * src/routes/developer.spec.ts because spinning up a second server in prod
 * mode is far more expensive than the testable equivalent.
 */
import { test, expect } from '../fixtures/auth.fixture';
import { DeveloperMenuPage, StyleLabPage, IdeviceLabPage } from '../pages/developer.page';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

test.describe('Developer menu visibility', () => {
    test('shows the Developer dropdown in the workarea when APP_ENV=dev', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Developer Menu Visibility');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const menu = new DeveloperMenuPage(page);
        await expect(menu.menu).toBeAttached();
    });

    test('Developer menu exposes Style Lab, iDevice Lab and REST API links', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Developer Menu Links');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const menu = new DeveloperMenuPage(page);
        await expect(menu.styleLabLink).toBeAttached();
        await expect(menu.ideviceLabLink).toBeAttached();
        await expect(menu.restApiLink).toBeAttached();
        await expect(menu.styleLabLink).toHaveAttribute('href', /\/developer\/style-lab$/);
        await expect(menu.ideviceLabLink).toHaveAttribute('href', /\/developer\/idevice-lab$/);
        await expect(menu.restApiLink).toHaveAttribute('href', /\/api\/v1\/docs$/);
    });
});

test.describe('Style Lab', () => {
    test.beforeEach(async ({}, testInfo) => {
        if (testInfo.project.name === 'static') {
            test.skip(true, 'Developer routes require the eXeLearning backend');
        }
    });

    test('opens with the default fixture and reaches ready state', async ({ authenticatedPage }) => {
        const styleLab = new StyleLabPage(authenticatedPage);
        await styleLab.goto();
        await styleLab.waitForReady();
        const state = await styleLab.getState();
        expect(state.status).toBe('ready');
        expect(state.viewport).toBe('desktop');
        expect(state.export).toBe('website');
    });

    test('restores state from URL parameters', async ({ authenticatedPage }) => {
        const styleLab = new StyleLabPage(authenticatedPage);
        await styleLab.goto('fixture=basic-content&viewport=mobile&export=scorm12');
        await styleLab.waitForReady();
        const state = await styleLab.getState();
        expect(state.fixture).toBe('basic-content');
        expect(state.viewport).toBe('mobile');
        expect(state.export).toBe('scorm12');
    });

    test('switches viewport via the quick buttons', async ({ authenticatedPage }) => {
        const styleLab = new StyleLabPage(authenticatedPage);
        await styleLab.goto();
        await styleLab.waitForReady();
        await styleLab.setViewport('mobile');
        await authenticatedPage.waitForFunction(() => {
            const el = document.querySelector('[data-testid="developer-style-lab-state"]');
            if (!el) return false;
            const json = JSON.parse(el.textContent ?? '{}');
            return json.viewport === 'mobile';
        });
        const iframe = styleLab.previewFrame;
        await expect(iframe).toHaveAttribute('data-viewport', 'mobile');
    });

    test('reload theme button updates status and reload token', async ({ authenticatedPage }) => {
        const styleLab = new StyleLabPage(authenticatedPage);
        await styleLab.goto();
        await styleLab.waitForReady();
        const initial = await styleLab.getState();
        await styleLab.reloadButton.click();
        await authenticatedPage.waitForFunction(initialToken => {
            const el = document.querySelector('[data-testid="developer-style-lab-state"]');
            if (!el) return false;
            const json = JSON.parse(el.textContent ?? '{}');
            return typeof json.reloadToken === 'number' && json.reloadToken !== initialToken;
        }, initial.reloadToken ?? null);
    });
});

test.describe('iDevice Lab', () => {
    test.beforeEach(async ({}, testInfo) => {
        if (testInfo.project.name === 'static') {
            test.skip(true, 'Developer routes require the eXeLearning backend');
        }
    });

    test('opens with a default iDevice and reaches ready state', async ({ authenticatedPage }) => {
        const lab = new IdeviceLabPage(authenticatedPage);
        await lab.goto();
        await lab.waitForReady();
        const state = await lab.getState();
        expect(state.status).toBe('ready');
        expect(state.viewport).toBe('desktop');
        expect(state.export).toBe('website');
        expect(state.idevice).toBeTruthy();
    });

    test('restores state from URL parameters', async ({ authenticatedPage }) => {
        const lab = new IdeviceLabPage(authenticatedPage);
        await lab.goto('idevice=rubric&sample=basic-score&export=scorm12&viewport=mobile');
        await lab.waitForReady();
        const state = await lab.getState();
        expect(state.idevice).toBe('rubric');
        expect(state.sample).toBe('basic-score');
        expect(state.export).toBe('scorm12');
        expect(state.viewport).toBe('mobile');
    });

    test('runs the save/load roundtrip validator', async ({ authenticatedPage }) => {
        const lab = new IdeviceLabPage(authenticatedPage);
        await lab.goto();
        await lab.waitForReady();
        await lab.roundtripButton.click();
        await authenticatedPage.waitForFunction(() => {
            const el = document.querySelector('[data-testid="developer-idevice-lab-roundtrip-status"]');
            return el && el.getAttribute('data-status') !== 'running';
        });
        const state = await lab.getState();
        const roundtrip = state.roundtrip as { status?: string };
        expect(['passed', 'failed', 'error']).toContain(roundtrip.status);
    });
});
