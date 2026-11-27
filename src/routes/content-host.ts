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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Elysia } from 'elysia';
import type { Kysely } from 'kysely';
import { contentProxyLabel, encodeSourcePrefix, SOURCE_CSP_HEADER, SOURCE_HEADER } from '../content-proxy/protocol';
import { db as dbDefault } from '../db/client';
import { findProjectByPublicViewId as findProjectByPublicViewIdDefault } from '../db/queries';
import type { Database } from '../db/types';
import { isPublicViewFeatureEnabled as isPublicViewFeatureEnabledDefault } from '../services/app-settings';
import { getPublicViewFile as getPublicViewFileDefault } from '../services/public-view-content';
import {
    CONTENT_DOMAIN_REFERRER_POLICY,
    contentDomainHeaders,
    previewHostPageHeaders,
    publicViewCspHeader,
    resolvePublicViewCspProfile,
} from '../shared/security/publicViewSandbox';
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
import { getAppVersion } from '../utils/version';

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

/**
 * `/content/<app origin>/preview/<project uuid>/<file>` below the base path: the
 * directory of one project's workarea preview. The server only serves the three
 * files in PREVIEW_HOST_FILES there; `viewer/*` is answered by that origin's
 * Service Worker from what the workarea posted to the host page.
 */
const PREVIEW_CONTENT_PATH = /^\/content\/([^/]+)\/preview\/([\w-]+)\/(.*)$/;

const PREVIEW_HOST_SCRIPT = 'public/app/workarea/interface/elements/previewHostPage.js';
const PREVIEW_HOST_FILES: Record<string, string> = {
    'preview-host.js': PREVIEW_HOST_SCRIPT,
    'preview-sw.js': 'public/preview-sw.js',
};

function escapeAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** The host page: no content of its own, only the script and the frame it drives. */
function previewHostPage(appOrigin: string): string {
    const version = encodeURIComponent(getAppVersion());
    return `<!DOCTYPE html>
<html lang="en" data-app-origin="${escapeAttribute(appOrigin)}" data-version="${version}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview</title>
<style>html,body{height:100%;margin:0}iframe{border:0;width:100%;height:100%;display:block}</style>
</head>
<body>
<iframe id="preview-content" title="Preview" allowfullscreen></iframe>
<script type="module" src="preview-host.js?v=${version}"></script>
</body>
</html>
`;
}

function servePreviewHostFile(appOrigin: string, file: string): Response {
    if (file === 'host.html') {
        return new Response(previewHostPage(appOrigin), {
            headers: { 'Content-Type': 'text/html; charset=utf-8', ...previewHostPageHeaders(appOrigin) },
        });
    }
    const source = PREVIEW_HOST_FILES[file];
    if (!source) return notFound();
    return new Response(fs.readFileSync(path.join(process.cwd(), source)), {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}

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

/**
 * URL of the preview host page of a project on the content domain, for the
 * application origin whose workarea embeds it. Only hand this to a user who may
 * open the project: the label in it is what authorizes using that origin.
 */
export function previewContentHostUrl(contentDomain: ContentDomain, appOrigin: string, projectUuid: string): string {
    const origin = contentOrigin(contentDomain, contentLabel('preview', projectUuid, appOrigin), appOrigin);
    return `${origin}${prefixPath(`/content/${encodeAppOrigin(appOrigin)}/preview/${projectUuid}/host.html`)}`;
}

/**
 * URL, on a content proxy (`EXE_CONTENT_PROXY`), of `file` in the content source
 * that this application serves at `sourcePath`. The proxy derives the same label
 * from the same prefix, so nothing is shared with it.
 */
function contentProxyUrl(proxy: ContentDomain, appOrigin: string, sourcePath: string, file: string): string {
    const prefix = `${appOrigin}${prefixPath(sourcePath)}`;
    return `${contentOrigin(proxy, contentProxyLabel(prefix), appOrigin)}/${encodeSourcePrefix(prefix)}/${file}`;
}

/** URL of a public view's entry document on a content proxy. Its source is the opaque content route. */
export function proxiedPublicViewUrl(proxy: ContentDomain, appOrigin: string, publicViewId: string): string {
    return contentProxyUrl(proxy, appOrigin, `/view/${publicViewId}/_/`, 'index.html');
}

/** URL of the preview host page of a project on a content proxy. */
export function proxiedPreviewHostUrl(proxy: ContentDomain, appOrigin: string, projectUuid: string): string {
    return contentProxyUrl(proxy, appOrigin, `/preview-host/${projectUuid}/`, 'host.html');
}

/**
 * Headers that make a response of the application host a content source: they
 * allow a content proxy to serve it, with `contentOriginCsp` as its policy there.
 * The response keeps its own `Content-Security-Policy`, which must leave it
 * harmless when the URL is opened on the application host.
 */
export function contentProxySourceHeaders(contentOriginCsp?: string | null): Record<string, string> {
    return { [SOURCE_HEADER]: '1', ...(contentOriginCsp ? { [SOURCE_CSP_HEADER]: contentOriginCsp } : {}) };
}

/**
 * Extra headers that make the opaque public-view response a content source: on
 * the content origin it gets the content-domain policy, with this application as
 * the only other embedder.
 */
export function publicViewSourceHeaders(appOrigin: string): Record<string, string> {
    return {
        ...contentProxySourceHeaders(publicViewCspHeader(resolvePublicViewCspProfile(), appOrigin)),
        'Referrer-Policy': CONTENT_DOMAIN_REFERRER_POLICY,
        'Access-Control-Allow-Origin': appOrigin,
    };
}

/**
 * A file of the preview host page as a content source (`/preview-host/<project>/<file>`
 * on the application host). Opened there the page does nothing: it is sandboxed
 * without scripts. Its real policy applies on the content origin.
 */
export function previewHostSourceResponse(appOrigin: string, file: string): Response {
    const response = servePreviewHostFile(appOrigin, file);
    if (!response.ok) return response;
    const policy = response.headers.get('Content-Security-Policy');
    for (const [name, value] of Object.entries(contentProxySourceHeaders(policy))) response.headers.set(name, value);
    if (policy) response.headers.set('Content-Security-Policy', 'sandbox');
    return response;
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

        // The host the client connected to wins when it is on the content domain, so a
        // forwarded-host header can never turn a content host into the application host.
        const { hostname: forwardedHost, pathname } = getPublicUrl(request, server ?? undefined);
        const requestHost = new URL(request.url).hostname;
        const hostname =
            relateHostToContentDomain(requestHost, contentDomain) === 'unrelated' ? forwardedHost : requestHost;
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
        const routePath = basePath && pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;

        // Workarea preview: static transport files only. No project data is read here; the
        // label proves the server issued this origin to someone allowed to open the project.
        const preview = PREVIEW_CONTENT_PATH.exec(routePath);
        if (preview) {
            const previewAppOrigin = decodeAppOrigin(preview[1]);
            if (!previewAppOrigin || !isContentLabel(label, 'preview', preview[2], previewAppOrigin)) return notFound();
            return servePreviewHostFile(previewAppOrigin, preview[3]);
        }

        const match = PUBLIC_VIEW_CONTENT_PATH.exec(routePath);
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
