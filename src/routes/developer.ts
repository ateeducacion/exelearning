/**
 * Developer Tools Routes for Elysia.
 *
 * Provides server-side routes for the in-app developer laboratories:
 *
 *   GET /developer/style-lab    — Style Lab page
 *   GET /developer/idevice-lab  — iDevice Lab page
 *   GET /developer/api          — REST API browser (redirects to Swagger)
 *
 * These routes are intentionally gated to dev environments. In production
 * (`APP_ENV != dev` and no `DEV_TOOLS_ENABLED` override) every developer
 * route returns 404 to avoid advertising debugging surfaces.
 */
import { Elysia } from 'elysia';
import { renderTemplate as renderTemplateDefault } from '../services/template';
import { getBasePath, prefixPath } from '../utils/basepath.util';
import { getAppVersion } from '../utils/version';
import { isDeveloperToolsEnabled } from '../utils/developer-tools.util';

export interface DeveloperRoutesDeps {
    renderTemplate: typeof renderTemplateDefault;
    isEnabled: () => boolean;
}

const defaultDeps: DeveloperRoutesDeps = {
    renderTemplate: renderTemplateDefault,
    isEnabled: () => isDeveloperToolsEnabled(process.env),
};

/**
 * Build the developer routes Elysia plugin.
 *
 * Tests inject `isEnabled` and `renderTemplate` to verify gating without
 * shelling out to actual templates or relying on process env.
 */
export function createDeveloperRoutes(deps: Partial<DeveloperRoutesDeps> = {}) {
    const { renderTemplate, isEnabled } = { ...defaultDeps, ...deps };

    const notFound = (set: { status?: number | string }) => {
        set.status = 404;
        return new Response('Not Found', { status: 404 });
    };

    return new Elysia({ name: 'developer-routes' })
        .get('/developer', ({ set }) => {
            if (!isEnabled()) return notFound(set);
            return Response.redirect(prefixPath('/developer/style-lab'), 302);
        })
        .get('/developer/style-lab', ({ set }) => {
            if (!isEnabled()) return notFound(set);
            const html = renderTemplate('workarea/developer/styleLab', {
                version: getAppVersion(),
                basePath: getBasePath(),
                title: 'Style Lab',
            });
            return new Response(html, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        })
        .get('/developer/idevice-lab', ({ set }) => {
            if (!isEnabled()) return notFound(set);
            const html = renderTemplate('workarea/developer/ideviceLab', {
                version: getAppVersion(),
                basePath: getBasePath(),
                title: 'iDevice Lab',
            });
            return new Response(html, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        })
        .get('/developer/api', ({ set }) => {
            if (!isEnabled()) return notFound(set);
            return Response.redirect(prefixPath('/api/v1/docs'), 302);
        });
}

export const developerRoutes = createDeveloperRoutes();
