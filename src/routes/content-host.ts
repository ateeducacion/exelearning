/**
 * Request handling for the content domain (`EXE_CONTENT_DOMAIN`).
 *
 * The same server process answers the application host and every
 * `<label>.<content domain>` host. This handler runs before any other hook or
 * route and owns every request whose host is on the content domain:
 *
 * - only content routes answer there; every application page, API route,
 *   WebSocket upgrade and login route gets a 404, because nothing else runs;
 * - a content request is served only when the host label is the label derived
 *   for the requested content (see `src/utils/content-label.ts`);
 * - it never reads the session and its responses never set cookies: the
 *   responses are built here, and no cookie or JWT code is reachable.
 *
 * Requests for any other host return `undefined` and continue as usual. With
 * the mode off that is every request.
 */
import { Elysia } from 'elysia';
import type { Kysely } from 'kysely';
import { db as dbDefault } from '../db/client';
import { findProjectByPublicViewId as findProjectByPublicViewIdDefault } from '../db/queries';
import type { Database } from '../db/types';
import { isPublicViewFeatureEnabled as isPublicViewFeatureEnabledDefault } from '../services/app-settings';
import { getPublicViewFile as getPublicViewFileDefault } from '../services/public-view-content';
import { contentDomainHeaders, resolvePublicViewCspProfile } from '../shared/security/publicViewSandbox';
import { getBasePath, prefixPath } from '../utils/basepath.util';
import {
    type ContentDomain,
    contentOrigin,
    decodeAppOrigin,
    encodeAppOrigin,
    getContentDomain,
    relateHostToContentDomain,
} from '../utils/content-domain';
import { CONTENT_LABEL_PATTERN, contentLabel, isContentLabel } from '../utils/content-label';
import { getPublicUrl, type ServerContext } from '../utils/proxy-url.util';

export interface ContentHostDeps {
    db: Kysely<Database>;
    findProjectByPublicViewId: typeof findProjectByPublicViewIdDefault;
    isPublicViewFeatureEnabled: typeof isPublicViewFeatureEnabledDefault;
    getPublicViewFile: typeof getPublicViewFileDefault;
    warn: (message: string) => void;
}

const defaultDeps: ContentHostDeps = {
    db: dbDefault,
    findProjectByPublicViewId: findProjectByPublicViewIdDefault,
    isPublicViewFeatureEnabled: isPublicViewFeatureEnabledDefault,
    getPublicViewFile: getPublicViewFileDefault,
    warn: message => console.warn(message),
};

/** `/content/<app origin>/view/<public view id>/<file path>` below the base path. */
const PUBLIC_VIEW_CONTENT_PATH = /^\/content\/([^/]+)\/view\/([\w-]+)\/(.*)$/;

function notFound(): Response {
    return new Response('Not found', {
        status: 404,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store',
        },
    });
}

/**
 * URL of a public view's entry document on the content domain, for the
 * application origin that embeds it.
 */
export function publicViewContentUrl(contentDomain: ContentDomain, appOrigin: string, publicViewId: string): string {
    const origin = contentOrigin(contentDomain, contentLabel('view', publicViewId, appOrigin), appOrigin);
    return `${origin}${prefixPath(`/content/${encodeAppOrigin(appOrigin)}/view/${publicViewId}/index.html`)}`;
}

export function createContentHostHandler(deps: ContentHostDeps = defaultDeps) {
    const warned = new Set<string>();
    const warnOnce = (key: string, message: string): void => {
        if (warned.has(key)) return;
        warned.add(key);
        deps.warn(message);
    };

    return async function handleContentHostRequest(
        request: Request,
        server?: ServerContext | null,
    ): Promise<Response | undefined> {
        const contentDomain = getContentDomain();
        if (!contentDomain) return undefined;

        const { hostname, pathname } = getPublicUrl(request, server ?? undefined);
        const relation = relateHostToContentDomain(hostname, contentDomain);
        if (relation === 'unrelated') return undefined;
        if (relation === 'content-under-app') {
            warnOnce(
                relation,
                `[SECURITY] EXE_CONTENT_DOMAIN (${contentDomain.host}) is a subdomain of the application host ` +
                    `(${hostname}). They are the same site: cookies set for the parent domain reach the content, ` +
                    'SameSite does not separate them and browsers may run both in one process. Use an unrelated domain.',
            );
            return undefined;
        }

        // From here on the request is for the content domain and never reaches the application.
        const label = relation === 'same' ? '' : hostname.slice(0, -(contentDomain.host.length + 1));
        if (!CONTENT_LABEL_PATTERN.test(label)) {
            warnOnce(
                'not-a-content-label',
                `[SECURITY] Answered 404 for host ${hostname}: it is on EXE_CONTENT_DOMAIN (${contentDomain.host}) ` +
                    'but is not a content host. If it is the application host, the content domain must not be ' +
                    'the application host or a parent of it.',
            );
            return notFound();
        }
        if (request.method !== 'GET') return notFound();

        const basePath = getBasePath();
        const path = basePath && pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;
        const match = PUBLIC_VIEW_CONTENT_PATH.exec(path);
        const appOrigin = match && decodeAppOrigin(match[1]);
        if (!match || !appOrigin) return notFound();
        const [, , publicViewId, relPath] = match;
        if (!isContentLabel(label, 'view', publicViewId, appOrigin)) return notFound();

        const project = (await deps.isPublicViewFeatureEnabled(deps.db))
            ? await deps.findProjectByPublicViewId(deps.db, publicViewId)
            : undefined;
        if (!project?.public_view_enabled) return notFound();

        let file: Awaited<ReturnType<typeof getPublicViewFileDefault>>;
        try {
            file = await deps.getPublicViewFile(project, relPath);
        } catch (err) {
            console.error('[Content host] Error building export:', err);
            return new Response('Error building preview', { status: 500, headers: { 'Cache-Control': 'no-store' } });
        }
        if (!file) return notFound();

        return new Response(file.content as BodyInit, {
            headers: {
                'Content-Type': file.contentType,
                ...contentDomainHeaders(appOrigin, resolvePublicViewCspProfile()),
            },
        });
    };
}

/**
 * Elysia plugin for the root application. It must be the first thing mounted:
 * a request for a content host is answered here and never reaches CORS, static
 * files, the session guard, routes or WebSocket upgrades.
 */
export function contentHostGuard(deps: ContentHostDeps = defaultDeps) {
    const handle = createContentHostHandler(deps);
    return new Elysia({ name: 'content-host' }).onRequest(async ({ request, server, set }) => {
        const response = await handle(request, { requestIP: (req: Request) => server?.requestIP(req) ?? null });
        // Drop the application's default response headers (CORS credentials and the like).
        if (response) set.headers = {};
        return response;
    });
}
