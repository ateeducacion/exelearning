/**
 * Tests for Developer Tools routes.
 *
 * Dev gating is the most important behavior to verify here. In production,
 * every developer route MUST return 404 — surfacing 403 or any other status
 * would let attackers fingerprint that developer tools exist.
 */
import { describe, it, expect } from 'bun:test';
import { createDeveloperRoutes } from './developer';

function buildApp({ enabled }: { enabled: boolean }) {
    return createDeveloperRoutes({
        isEnabled: () => enabled,
        renderTemplate: (templatePath: string, data?: Record<string, unknown>) => {
            return `<html data-template="${templatePath}" data-title="${(data?.title as string) ?? ''}"></html>`;
        },
    });
}

describe('Developer routes', () => {
    describe('when developer tools are enabled', () => {
        const app = buildApp({ enabled: true });

        it('renders the Style Lab template', async () => {
            const res = await app.handle(new Request('http://localhost/developer/style-lab'));
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/html');
            const body = await res.text();
            expect(body).toContain('workarea/developer/styleLab');
            expect(body).toContain('data-title="Style Lab"');
        });

        it('renders the iDevice Lab template', async () => {
            const res = await app.handle(new Request('http://localhost/developer/idevice-lab'));
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/html');
            const body = await res.text();
            expect(body).toContain('workarea/developer/ideviceLab');
            expect(body).toContain('data-title="iDevice Lab"');
        });

        it('redirects /developer to Style Lab', async () => {
            const res = await app.handle(new Request('http://localhost/developer'));
            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/developer/style-lab');
        });

        it('redirects /developer/api to the Swagger docs', async () => {
            const res = await app.handle(new Request('http://localhost/developer/api'));
            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/api/v1/docs');
        });
    });

    describe('when developer tools are disabled (production)', () => {
        const app = buildApp({ enabled: false });

        it('returns 404 for /developer/style-lab', async () => {
            const res = await app.handle(new Request('http://localhost/developer/style-lab'));
            expect(res.status).toBe(404);
        });

        it('returns 404 for /developer/idevice-lab', async () => {
            const res = await app.handle(new Request('http://localhost/developer/idevice-lab'));
            expect(res.status).toBe(404);
        });

        it('returns 404 for /developer/api', async () => {
            const res = await app.handle(new Request('http://localhost/developer/api'));
            expect(res.status).toBe(404);
        });

        it('returns 404 for /developer root', async () => {
            const res = await app.handle(new Request('http://localhost/developer'));
            expect(res.status).toBe(404);
        });

        it('does not advertise developer routes (no 403 or 401 status)', async () => {
            // Anything other than 404 here would leak that developer tools exist
            // in this deployment, which is exactly what dev-gating should prevent.
            const paths = ['/developer', '/developer/style-lab', '/developer/idevice-lab', '/developer/api'];
            for (const path of paths) {
                const res = await app.handle(new Request(`http://localhost${path}`));
                expect(res.status).toBe(404);
            }
        });
    });
});
