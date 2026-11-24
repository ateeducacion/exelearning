---
tracking_issue: 53
title: "Optional content domain for untrusted author content"
status: draft
date: 2026-11-24
authors:
  - "@erseco"
reviewers: []
implementation_prs: [53]
related_adrs: [ADR-53-01, ADR-348-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5-2"
---

# Optional content domain for untrusted author content — design

> The tracking number is pull request 53 of `ateeducacion/exelearning`.

## Current state

- The public viewer (`/view/:publicViewId`, `views/viewer/viewer.njk`,
  `src/routes/pages.ts`) serves author content from the application host at
  `/view/:publicViewId/_/*` inside an opaque-origin iframe
  ([ADR-348-01](../../adr/ADR-348-01-public-view-opaque-origin-isolation.md)).
  It is off by default (`PUBLIC_VIEW_ENABLED`).
- The workarea preview is served by `public/preview-sw.js` under
  `<basePath>viewer/` in the editor origin, in an iframe with
  `allow-same-origin`.

Opaque origins cannot host nested embeds that need an origin, Service Workers,
blob URLs or storage, so the opaque model could not be extended to the preview.
The decision to add a separate, optional content domain is
[ADR-53-01](../../adr/ADR-53-01-serve-untrusted-content-from-an-optional-content-domain.md).

## Technical design

### Configuration

One setting, `EXE_CONTENT_DOMAIN=host[:port]`, parsed by
`src/utils/content-domain.ts`.

- `parseContentDomain()` accepts a DNS name and an optional port. It rejects a
  scheme, a path, a wildcard, an IP address, and a name too long to prefix a
  label.
- `contentDomainBootError()` is called next to the secrets check in
  `src/index.ts`. An invalid value prints the reason and exits with status 1.
- Unset or blank means the mode is off. Every entry point starts with
  `getContentDomain()` returning `null` and does nothing else.

The application has no setting that names its own public host, so the
relationship between the two hosts can only be seen on a request. The guard logs
one warning when a request's host is a parent of the content domain (the content
domain is a subdomain of the application: same site, weaker), and one when a
host on the content domain is not a content label (the content domain is the
application host or a parent of it, so the application answers 404).

### Label

`src/utils/content-label.ts`:

```text
label = <kind letter> + hex(HMAC-SHA-256(signing secret,
            JSON(["exe-content-label-v1", kind, id, appOrigin])))[0..40]
```

- 41 lowercase alphanumeric characters, so it is a valid DNS label.
- The key is the server signing secret (`getJwtSecret()`), which production
  requires to be at least 32 bytes and which every instance of a deployment
  already shares.
- The input is a JSON array, so no field can be shifted into the next.
- `isContentLabel()` compares in constant time.

Kinds: `view` (`v`), a public view, with the public view id as `id`.

### Why the application origin is in the URL

Content responses must send `frame-ancestors <application origin>`, and the
content host has no way to know that origin: there is no setting for it, the
request arrives on another host, and `Referer` is chosen by whoever embeds the
frame. Keeping a per-process map from label to origin would break as soon as two
instances share the content hosts.

So the origin travels in the content URL, and the label is derived from it:

```text
https://<label>.<content domain><BASE_PATH>/content/<base64url(appOrigin)>/view/<publicViewId>/<file>
```

A client can change the path segment, but then the label no longer matches and
the request is a 404. The origin is taken from `getPublicUrl()` when the loader
page is rendered, the same function SSO callbacks use, so it follows
`TRUSTED_PROXIES`. `decodeAppOrigin()` accepts only a canonical `http(s)`
origin, which makes the value safe to place in a header.

Relative URLs inside the export keep working because the whole export lives
below one directory.

### Host routing

`contentHostGuard()` (`src/routes/content-host.ts`) is the first thing mounted
on the root application. For every request it resolves the effective host with
`getPublicUrl()` and:

| Host | Result |
|---|---|
| Mode off, or host unrelated to the content domain | not handled; the application continues as before |
| Parent of the content domain | not handled; warns once |
| The content domain itself, or a name under it that is not a label | 404; warns once |
| `<label>.<content domain>` | handled here, see below |

For a content host: only `GET` is answered; the path must match the content
route; the application origin segment must decode; `isContentLabel()` must
accept the host label for that id and origin; the public-view feature and the
project's flag must be on. Anything else is a plain-text 404.

Because the guard returns a `Response` from `onRequest`, nothing mounted after
it runs: not CORS, the static file handlers, the session revocation guard,
maintenance mode, any route or any WebSocket upgrade. The guard also clears the
default response headers the application registers (the CORS plugin's
`Access-Control-Allow-Credentials`). The handler has no access to cookies or
JWT code, so it cannot read the session or set a cookie.

### Public viewer

`GET /view/:publicViewId` stays on the application host. With the mode on it
passes `contentSrc` to the template, and the iframe becomes:

```html
<iframe src="https://<label>.<content domain>/…/index.html"
        sandbox="allow-scripts allow-popups allow-forms allow-downloads
                 allow-popups-to-escape-sandbox allow-same-origin"
        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>
```

`src/shared/security/publicViewSandbox.ts` remains the single source of truth:

| | Opaque origin (default) | Content domain |
|---|---|---|
| iframe tokens | `PUBLIC_VIEW_SANDBOX` | `CONTENT_DOMAIN_SANDBOX` = the same plus `allow-same-origin` |
| CSP `sandbox` | same tokens as the iframe | same tokens as the iframe |
| `frame-ancestors` | `'self'` | `'self' <application origin>` |
| `object-src`, `base-uri` | `'none'` | `'none'` |
| Resource directives | per `PUBLIC_VIEW_CSP_PROFILE` | identical |
| Permissions-Policy | camera, microphone, geolocation, payment off | identical |
| Referrer | `referrerpolicy="no-referrer"` | `strict-origin-when-cross-origin` on the iframe and as a response header |
| `X-Content-Type-Options` | `nosniff` | `nosniff` |

`allow-same-origin` is safe here because the document's origin is the content
origin, not the application's. The sandbox still withholds
`allow-top-navigation` and `allow-modals`. The referrer policy sends embedded
players the origin of the page that embeds them and never a path.

`frame-ancestors` includes `'self'` because the directive checks every ancestor:
without it a page of the export could not frame another page of the same export.

### No silent downgrade

The server never chooses between the two hosts per request: with the mode on,
the loader always points at the content host.

The loader page then fetches the iframe URL once. Content responses send
`Access-Control-Allow-Origin: <application origin>`, so the page can read the
status. On a network error (DNS, TLS, proxy) or a non-2xx status it removes the
iframe and shows "The content could not be loaded from the content domain." in
the loader, with `role="alert"`. It does not load `/view/:id/_/` instead.

The application host keeps serving `/view/:id/_/*` in the opaque origin in both
modes. Removing it would change behaviour for existing embeds, and leaving it
does not weaken anything: it is the same opaque document as before.

## Migration and compatibility

- Mode off: no route, header or template output changes. `viewer.njk` renders
  byte-identical HTML (checked against `main`).
- Turning the mode on does not change public links (`/view/<id>` on the
  application host).
- Turning it off again returns to the opaque origin. Storage that content kept
  on its content origin stays in the browser but is no longer reachable.

## Security and privacy

Invariants and the tests that hold them:

| Invariant | Tests |
|---|---|
| On a content host only content routes answer; pages, API, login and WebSocket upgrades are 404 | `content-host.spec.ts` ("returns 404 for the application route …", "refuses a WebSocket upgrade …"); E2E "a content host serves only its own content" |
| Content is served only when the host label is the label derived for it | `content-host.spec.ts` ("label belongs to other content", "application origin … not the one bound into the label"); `content-label.spec.ts`; E2E same test |
| Content-host responses never set cookies and never read the session | `content-host.spec.ts` ("ignores the session", "answers a content host before any other hook or route runs") |
| The application host keeps its opaque-origin route, never weaker | `content-host.spec.ts` ("keeps the opaque-origin route"); `publicViewSandbox.spec.ts` ("does not change the opaque-origin policy"); `pages.spec.ts` (existing block, unchanged); E2E "the application host keeps its opaque-origin content route"; `public-view-sandbox.spec.ts` unchanged |
| The effective host follows `TRUSTED_PROXIES` | `content-host.spec.ts` ("effective host behind a reverse proxy") |
| An invalid setting refuses to boot | `content-domain.spec.ts` (`contentDomainBootError`) |
| No fallback to the application origin | E2E "shows an error instead of falling back" |

Content on a content origin can make requests to the application like any other
website. It carries no application cookie when the two are different sites
(`SameSite=Lax`), which is why a subdomain of the application is discouraged.

## Accessibility

The only new user-visible element is the loader error, announced through
`role="alert"`.

## Internationalization

One new source string in `views/viewer/viewer.njk`, wrapped in `| trans`.
Catalogs are not edited in this change.

## Performance

With the mode off, the guard costs one environment lookup per request. With it
on, it adds one host comparison per application request and one HMAC per content
request. The export cache of the public viewer is shared by both routes.

The loader fetches the entry document once more than the iframe does; the
export is already built and cached by then.

## Testing strategy

- Unit (Bun): the specs named above.
- E2E (Playwright): `test/e2e/playwright/specs/content-domain-public-view.spec.ts`
  against a second server that `playwright.config.ts` starts on port 3003 with
  `EXE_CONTENT_DOMAIN=exe-content.localhost:3003` and `BASE_PATH=/exe`. The app
  is opened at `exe-app.localhost` so that the two are different sites.
- `*.localhost` resolution per engine is recorded in
  [`research.md`](research.md).

## Rollout plan

1. Phase 1 (this design): setting, label, host routing, public viewer.
2. Phase 2: the workarea preview on a per-project content origin, gated on the
   Service Worker spike described in `research.md`.

## Risks and mitigations

See the Risks section of ADR-53-01.

## ADRs required or referenced

| Decision | ADR |
|---|---|
| Optional content domain on a different site, one keyed label per content item | ADR-53-01 |
| Opaque origin for the public viewer (kept as the default) | ADR-348-01 |
