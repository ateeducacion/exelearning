import { Page, Locator } from '@playwright/test';

/**
 * Page object for the Developer menu, Style Lab, and iDevice Lab.
 *
 * The Developer dropdown is only visible when the server is running with
 * `APP_ENV=dev`. In production the dropdown is not rendered server-side,
 * so a missing locator is the expected outcome.
 */
export class DeveloperMenuPage {
    readonly page: Page;
    readonly menu: Locator;
    readonly styleLabLink: Locator;
    readonly ideviceLabLink: Locator;
    readonly restApiLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.menu = page.locator('[data-testid="developer-menu"]');
        this.styleLabLink = page.locator('[data-testid="developer-menu-style-lab"]').first();
        this.ideviceLabLink = page.locator('[data-testid="developer-menu-idevice-lab"]').first();
        this.restApiLink = page.locator('[data-testid="developer-menu-rest-api"]').first();
    }

    async isVisible(): Promise<boolean> {
        return (await this.menu.count()) > 0 && (await this.menu.isVisible());
    }
}

export class StyleLabPage {
    readonly page: Page;
    readonly root: Locator;
    readonly fixtureSelect: Locator;
    readonly themeSourceSelect: Locator;
    readonly exportTargetSelect: Locator;
    readonly viewportSelect: Locator;
    readonly previewFrame: Locator;
    readonly status: Locator;
    readonly stateJson: Locator;
    readonly reloadButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.locator('[data-testid="developer-style-lab-root"]');
        this.fixtureSelect = page.locator('[data-testid="developer-style-lab-fixture-select"]');
        this.themeSourceSelect = page.locator('[data-testid="developer-style-lab-theme-source-select"]');
        this.exportTargetSelect = page.locator('[data-testid="developer-style-lab-export-target-select"]');
        this.viewportSelect = page.locator('[data-testid="developer-style-lab-viewport-select"]');
        this.previewFrame = page.locator('[data-testid="developer-style-lab-preview-frame"]');
        this.status = page.locator('[data-testid="developer-style-lab-status"]');
        this.stateJson = page.locator('[data-testid="developer-style-lab-state"]');
        this.reloadButton = page.locator('[data-testid="developer-style-lab-reload-theme"]');
    }

    async goto(query = ''): Promise<void> {
        const search = query ? (query.startsWith('?') ? query : `?${query}`) : '';
        await this.page.goto(`/developer/style-lab${search}`);
    }

    async waitForReady(): Promise<void> {
        await this.root.waitFor({ state: 'visible' });
        await this.page.waitForFunction(
            () =>
                document.querySelector('[data-testid="developer-style-lab-status"]')?.getAttribute('data-status') ===
                'ready',
        );
    }

    async getState(): Promise<Record<string, unknown>> {
        const text = (await this.stateJson.textContent()) ?? '{}';
        return JSON.parse(text);
    }

    async setViewport(preset: 'desktop' | 'tablet' | 'mobile'): Promise<void> {
        await this.page.locator(`[data-testid="developer-style-lab-viewport-${preset}"]`).click();
    }
}

export class IdeviceLabPage {
    readonly page: Page;
    readonly root: Locator;
    readonly ideviceSelect: Locator;
    readonly sampleSelect: Locator;
    readonly exportTargetSelect: Locator;
    readonly viewportSelect: Locator;
    readonly status: Locator;
    readonly stateJson: Locator;
    readonly roundtripButton: Locator;
    readonly roundtripStatus: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.locator('[data-testid="developer-idevice-lab-root"]');
        this.ideviceSelect = page.locator('[data-testid="developer-idevice-lab-idevice-select"]');
        this.sampleSelect = page.locator('[data-testid="developer-idevice-lab-sample-select"]');
        this.exportTargetSelect = page.locator('[data-testid="developer-idevice-lab-export-target-select"]');
        this.viewportSelect = page.locator('[data-testid="developer-idevice-lab-viewport-select"]');
        this.status = page.locator('[data-testid="developer-idevice-lab-status"]');
        this.stateJson = page.locator('[data-testid="developer-idevice-lab-state"]');
        this.roundtripButton = page.locator('[data-testid="developer-idevice-lab-run-roundtrip"]');
        this.roundtripStatus = page.locator('[data-testid="developer-idevice-lab-roundtrip-status"]');
    }

    async goto(query = ''): Promise<void> {
        const search = query ? (query.startsWith('?') ? query : `?${query}`) : '';
        await this.page.goto(`/developer/idevice-lab${search}`);
    }

    async waitForReady(): Promise<void> {
        await this.root.waitFor({ state: 'visible' });
        await this.page.waitForFunction(
            () =>
                document.querySelector('[data-testid="developer-idevice-lab-status"]')?.getAttribute('data-status') ===
                'ready',
        );
    }

    async getState(): Promise<Record<string, unknown>> {
        const text = (await this.stateJson.textContent()) ?? '{}';
        return JSON.parse(text);
    }
}
