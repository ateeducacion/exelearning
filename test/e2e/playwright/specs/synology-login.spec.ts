import { test, expect } from '@playwright/test';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { waitForAppReady } from '../helpers/workarea-helpers';

test('DSM browser handshake keeps the token out of URLs and the application callback', async ({ page }) => {
    const state = 's'.repeat(43);
    const token = 'dsm-test-csrf-token';
    let accepted = false;
    await page.route('**/webman/login.cgi', route => route.fulfill({ json: { success: true, SynoToken: token } }));
    await page.route('**/webman/3rdparty/exelearning/auth.js', route =>
        route.fulfill({
            contentType: 'text/javascript',
            body: readFileSync(resolve('packaging/synology/ui/auth.js'), 'utf8'),
        }),
    );
    await page.route('**/webman/3rdparty/exelearning/auth.cgi?*', async route => {
        expect(route.request().url()).not.toContain(token);
        if (route.request().headers().accept === 'application/json') {
            expect(route.request().headers()['x-syno-token']).toBe(token);
            accepted = true;
            await route.fulfill({ status: 204 });
        } else {
            await route.fulfill({
                contentType: 'text/html',
                body: '<p role="status">Validating DSM session...</p><script src="/webman/3rdparty/exelearning/auth.js"></script>',
            });
        }
    });
    await page.route('**/exelearning/login/synology/callback?*', async route => {
        expect(accepted).toBe(true);
        expect(route.request().headers()['x-syno-token']).toBeUndefined();
        expect(new URL(route.request().url()).searchParams.get('state')).toBe(state);
        await route.fulfill({ contentType: 'text/html', body: '<h1>DSM assertion ready</h1>' });
    });
    await page.goto(`/webman/3rdparty/exelearning/auth.cgi?state=${state}`);
    await expect(page.getByRole('heading', { name: 'DSM assertion ready' })).toBeVisible();
});

test('DSM login creates an external session; static builds expose no DSM login', async ({
    page,
    context,
}, testInfo) => {
    if (testInfo.project.name === 'static') {
        await page.goto('/');
        await expect(page.locator('#login-link-synology')).toHaveCount(0);
        return;
    }

    const admin = await page.request.post('/api/auth/login', {
        data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
    });
    expect(admin.ok()).toBe(true);
    await page.goto('/admin');
    await expect(page.locator('#auth-method-synology')).toBeChecked();
    await context.clearCookies();
    // Playwright only intercepts the first request of a redirect chain. Fetch the
    // real login response, then simulate DSM's assertion on its return redirect.
    await page.route('**/login/synology', async route => {
        const begin = await route.fetch({ maxRedirects: 0 });
        expect(begin.status()).toBe(302);
        const url = new URL(begin.headers().location, route.request().url());
        expect(url.pathname).toBe('/webman/3rdparty/exelearning/auth.cgi');
        const state = url.searchParams.get('state');
        expect(state).toMatch(/^[\w-]{43}$/);
        const cookies = await context.cookies();
        expect(cookies.find(cookie => cookie.name === 'synology_state')?.value).toBe(state);
        const now = Date.now();
        const payload = Buffer.from(
            JSON.stringify({
                username: `dsm-e2e-${randomBytes(8).toString('hex')}`,
                issuedAt: now,
                expiresAt: now + 60_000,
                nonce: randomBytes(24).toString('base64url'),
                state,
            }),
        ).toString('base64url');
        const signature = createHmac('sha256', process.env.E2E_SYNOLOGY_SECRET!).update(payload).digest('base64url');
        await route.fulfill({
            response: begin,
            headers: {
                ...begin.headers(),
                location: `/login/synology/callback?state=${state}`,
                'set-cookie': [
                    ...begin
                        .headersArray()
                        .filter(header => header.name.toLowerCase() === 'set-cookie')
                        .map(header => header.value),
                    `synology_assertion=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=60`,
                ].join('\n'),
                'cache-control': 'no-store',
            },
        });
    });

    await page.goto('/login');
    await page.locator('#login-link-synology').click();
    await page.waitForURL(/\/workarea/);
    await waitForAppReady(page);
    const session = await (await page.request.get('/api/session/check')).json();
    expect(session.authenticated).toBe(true);
    expect(session.user.email).toMatch(/@synology\.invalid$/);
    const password = await page.request.patch('/api/user/password', {
        data: { currentPassword: 'unused', newPassword: 'new-password-123' },
    });
    expect(password.status()).toBe(403);
    await page.goto('/logout');
    expect((await (await page.request.get('/api/session/check')).json()).authenticated).toBe(false);
});
