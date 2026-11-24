import type { Page } from '@playwright/test';

/**
 * Shared by the content-domain specs. They run against the second dynamic server
 * declared in playwright.config.ts (EXE_CONTENT_DOMAIN + BASE_PATH), not against the
 * default one, so they do not use the auth fixture.
 *
 * The application is opened at `exe-app.localhost` and the content is served from
 * `<label>.exe-content.localhost`: two different sites, both loopback. Every request is
 * made by the browser, never by Playwright's Node client: browsers resolve `*.localhost`
 * themselves, Node depends on the operating system.
 */
export const APP_ORIGIN = 'http://exe-app.localhost:3003';
export const BASE_PATH = '/exe';
export const APP = APP_ORIGIN + BASE_PATH;
export const CONTENT_DOMAIN = 'exe-content.localhost:3003';

/** Matches the host of a content origin of the given kind (`v` public view, `p` preview). */
export function contentHostPattern(kind: 'v' | 'p'): RegExp {
    return new RegExp(`^${kind}[0-9a-f]{40}\\.${CONTENT_DOMAIN.replace(/\./g, '\\.')}$`);
}

/** Log in as a guest and create a project. Leaves the page on the login URL. */
export async function createGuestProject(page: Page, title: string): Promise<string> {
    await page.goto(`${APP}/login`);
    return page.evaluate(async projectTitle => {
        await fetch('login/guest', { method: 'POST', body: new URLSearchParams({ guest_login_nonce: '' }) });
        const created = await fetch('api/project/create-quick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: projectTitle }),
        });
        return (await created.json()).uuid as string;
    }, title);
}
