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

Kinds: `view` (`v`), a public view, with the public view id as `id`; and
`preview` (`p`), the workarea preview of a project, with the project UUID.

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

### Workarea preview (phase 2)

With the mode off the preview is unchanged: `public/preview-sw.js`, registered
by the workarea under `<basePath>viewer/`, serves the generated export to an
iframe in the editor origin, with a blob URL fallback.

With the mode on, the preview runs on a per-project content origin. The spike in
[`research.md`](research.md) showed that a Service Worker registers and controls
a page inside a cross-site iframe in Chromium, Firefox and WebKit, so the
transport is a host page plus the same `preview-sw.js`, served on the content
host.

```text
workarea (app origin)                      content origin  p<hash>.<content domain>
┌──────────────────────────┐   iframe     ┌────────────────────────────────────────┐
│ previewPanel.js          │ ───────────▶ │ host.html + preview-host.js            │
│ previewContentHost.js    │              │   registers preview-sw.js (scope ./)   │
│                          │ ◀ ready + MessagePort                                 │
│   generated export       │ ─ SET_CONTENT ─▶ relays to its Service Worker         │
│                          │ ─ NAVIGATE ───▶ <iframe src="viewer/index.html">      │
│                          │ ◀ CONTENT_NEEDED, exe-download-elpx                   │
└──────────────────────────┘              │        └─ author content (same origin) │
                                          └────────────────────────────────────────┘
```

**Server.** `contentLabel('preview', <project uuid>, <app origin>)` gives each
project its own origin, different from the origin of its public view. The
content host serves three static files below
`/content/<app origin>/preview/<project uuid>/`: `host.html`,
`preview-host.js` (`public/app/workarea/interface/elements/previewHostPage.js`)
and `preview-sw.js`. It reads no project data and no session; the previewed
files only ever exist in the worker, put there by the workarea. Everything else
under that directory is a 404 from the server.

The workarea route adds `previewContentHostUrl` to the client config for the
project it has just authorized the user to open. The client never derives a
label: it uses that URL or has no content-domain preview.

**Host page.** It creates the `MessageChannel` and posts one end to the window
that embeds it, with the application origin written into the page by the server
(taken from the label-checked URL) as the target origin, so the browser delivers
the port only to the application. It takes no window message from the
application. Through the port the application may send `SET_CONTENT`,
`VERIFY_READY` and `GET_STATUS`, which are relayed to the worker, and
`NAVIGATE`, which is confined to the `viewer/` directory (with `keepPage` it
reloads the page on screen instead). The
page asks the worker to claim it when it starts uncontrolled (Firefox). Its
CSP is `default-src 'none'` with only its own script, worker and frame, and
`frame-ancestors <app origin>`.

**Workarea.** `PreviewContentHost` handles a window message only when
`event.source` is the preview iframe's window and `event.origin` is the content
origin of `previewContentHostUrl`. Everything on the content origin, the host
page included, is treated as untrusted: author scripts share that origin and
could drive the host page. The workarea acts on two message types from it,
neither carrying data: `CONTENT_NEEDED` (send the preview again) and
`exe-download-elpx` (start the same ELPX export the same-origin preview offers).

**No fallback.** In this mode `refresh()` never takes the Service Worker path of
the editor origin nor the blob URL path. A failure shows the preview error page.
The blob URL fallback remains for the mode-off path only.

#### Audit: code that reaches into the preview iframe or relies on its origin

| Place | What it did | Content-domain mode |
|---|---|---|
| `previewPanel.js` `loadPreviewFromServiceWorker()` | sets the iframe to `<basePath>/viewer/…` on the editor origin | not used; `refreshWithContentHost()` loads the host page and navigates through a message |
| `previewPanel.js` `refreshWithBlobUrl()`, `_loadBlobPage()` and the `exe-blob-*` handlers | render the export from blob URLs in the editor origin | not used; no fallback |
| `previewPanel.js` window `message` handler, `exe-download-elpx` | trusted `event.source` being a preview iframe | the request arrives over the port, relayed by the host page as a bare type |
| `previewPanel.js` `_checkServiceWorkerContent()` / visibility recovery | asked the editor origin's worker with `GET_STATUS` | asks through the port |
| `previewPanel.js` `CONTENT_NEEDED` (worker restarted) | worker message or `BroadcastChannel` on the editor origin | relayed over the port |
| `previewPanel.js` viewport toggle (`applyViewport()`) | toggles classes on the iframe's container | unchanged; it never touched the iframe document |
| `previewPanel.js` `showError()` / `injectHtmlToIframe()` | static error page from a blob URL | unchanged; the page contains only the escaped message, no author content |
| Page updates (`subscribeToChanges()`, `scheduleRefresh()`) | regenerate and resend the export | unchanged; they call `refresh()` |
| Search navigation in the preview | runs inside the exported pages | unchanged; it is content code and now runs on the content origin |
| `app.js` `registerPreviewServiceWorker()` | registers the worker under `<basePath>viewer/` on the editor origin | still registered and never given content. **Known gap:** it could be skipped in this mode |
| `previewPanel.js` `extractToNewTab()` | opens `<basePath>/viewer/` of the editor origin in a new tab | opens an empty tab of the editor origin and puts the host page in a sandboxed frame inside it; see "Preview in a new tab" below |
| `modalPrintPreview.js` | renders the print preview from a blob URL in its own iframe and reads its document | **Known gap:** a separate surface that still runs in the editor origin; not changed here |
| `exe_export.js` `isPreview` (`pathname.startsWith('/viewer/')`) | relative-link adjustment for the preview | false on the content host, as it already is under a non-empty `BASE_PATH`; links resolve relative to the page |
| `ideviceNode.js`, `YjsProjectBridge.js`, `asset_url_resolver.js` (`contentWindow` / `contentDocument`) | editor-side iframes inside the workarea DOM | not the preview iframe; out of scope |

#### Preview in a new tab

The tab cannot be a top-level page of the content origin. Such a page would have
to receive the export from the workarea, so it would hold a reference to the
workarea window (`window.opener`, or `event.source` of a message), and any page
that holds a reference to a top-level window can navigate it: author content
could send the editor tab to a look-alike page. With storage partitioning it
would also get a different, empty worker.

So `extractToNewTab()` opens `window.open('', '_blank')`: an empty document that
inherits the editor origin. `_contentHostTab()` puts one element in it, an
iframe with the `sandbox` list of the panel's iframe, and connects a second
`PreviewContentHost` to the host page loaded there. The result has the shape of
the panel, with the same guarantees:

- Author content is two frames down, on the content origin, in a frame that
  cannot navigate its top window (no `allow-top-navigation`) nor any other
  window (no `allow-popups-to-escape-sandbox`).
- The tab's opener is set to null before the frame exists: a cross-origin frame
  can read `top.opener`.
- The host page hands its port to its embedder, which is the tab. The workarea
  listens on the tab's window, which it can do because both are the editor
  origin. No window message goes from the workarea to the content origin.

The frame in the tab has the same top-level site as the panel's, so both use one
worker: a refresh sends the files once and asks the other frame to show them.
The tab reloads the page it is on instead of going back to the first one. The
popup monitor notices a reloaded tab (a new, empty document) and fills it again;
a tab that the user takes to another site is left alone.

Known gaps: the address bar shows `about:blank`, and the tab has no error page
of its own (a failed refresh shows the error in the panel).

Other known gaps of phase 2:

- The host page does not re-register a worker that reports itself active and
  never answers (the self-healing the editor origin has, ADR-2429-01). A request
  that gets no answer fails after 15 seconds with a preview error; "Refresh"
  reloads the host page.
- Pinned and slide-out previews each load their own host page. Both use the same
  origin and worker.
- WebKit is not part of the project's E2E suite; it was exercised by the spike
  and, as Safari 26.4, on the real deployment recorded in `research.md`.

## Content proxy (`EXE_CONTENT_PROXY`)

The content domain above needs a wildcard DNS record that points at one
deployment, so a domain serves one installation. A content proxy removes that
coupling: one domain, run as a small service, serves any installation.

Decisions:

- **A reverse proxy keyed by the source URL, not a registry.** The content URL is
  `https://<label>.<proxy domain>/<base64url(prefix)>/<path>` and the proxy
  fetches `<prefix><path>`. The label is `x` plus the first 160 bits of
  `SHA-256("exe-content-proxy-v1\n" + prefix)`. The proxy needs no list of
  installations, no shared secret and no state.
- **The label is public, and that is enough.** The keyed label of the content
  domain stops a client from pairing a label with other content, because the
  server that checks it is the one that serves the content. Here the proxy
  fetches exactly the prefix it hashed, so the pairing holds without a key. A
  party that runs its own server gets origins for its own prefixes only.
- **Sources are the routes that are already safe on the application host.** The
  public view source is the opaque route `/view/:id/_/*`, unchanged except for
  three headers. The preview source is `/preview-host/:projectUuid/*`, the same
  static files the content host serves, with `Content-Security-Policy: sandbox`
  on the page. No route serves author content on the application host without
  the opaque policy, in any mode.
- **The policy for the content origin is a response header of the source**
  (`X-Exe-Content-Proxy-CSP`), not something the proxy asks for. A request header
  that switched the policy would make the application host emit a non-opaque
  response for author content, which a cache or a later change could replay to a
  browser.
- **Opt-in per response** (`X-Exe-Content-Proxy: 1`). Without it the proxy would
  show any public page of any site under the content domain.
- **Path confinement.** The proxy refuses `\`, `%2e`, `%2f` and `%5c` in the
  path and checks the resolved URL against the prefix, because a source may
  decode them and leave the directory that names the origin.
- **Kept apart from the content domain.** Both variables set refuses to boot.
  The two modes share the viewer template, the sandbox tokens, the preview
  transport and the no-fallback rule; they differ in who answers the content
  host and in how the label is derived.

Not done: the proxy does not cache, does not follow redirects, and does not
serve `HEAD`. The LMS plugins do not use it yet; the protocol is not specific to
this application (a source is any URL prefix that opts in).

| Invariant | Tests |
|---|---|
| A source is never served on the origin of another source | `worker.spec.ts` ("never serves a prefix on the origin of another prefix", "does not leave the prefix through …"); E2E `content-proxy.spec.ts` ("an origin serves only its own source") |
| Only responses that opted in are served; no redirect, error body, cookie or credential passes | `worker.spec.ts` ("refuses a response that did not opt in", "does not follow or pass on redirects", "reports the status of a source error without its body", "serves the source below the prefix …") |
| Sources stay opaque on the application host | `pages.spec.ts` ("becomes a content source with a content proxy, and stays opaque on this host", "serves the host page bound to the origin of the request, inert on this host"); E2E ("the source stays opaque when it is opened on the application host") |
| With the mode off nothing changes | `pages.spec.ts` ("is not a content source unless a content proxy is set", "does not exist without a content proxy, nor in offline mode") |
| The application and the proxy derive the same label | `content-host.spec.ts` ("builds public-view URLs that the proxy resolves to the opaque content route"); `protocol.spec.ts` (fixed vector) |
| No fallback to the application origin | E2E ("shows an error instead of falling back when the proxy does not answer") |
| Author scripts in the preview run on the content origin and cannot read the editor | E2E ("the workarea preview runs on the content origin of the project") |

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
| No fallback to the application origin | E2E "shows an error instead of falling back"; `previewPanel.test.js` ("shows an error and does not fall back") |
| The workarea gets the preview origin from the server and never computes a label | `pages.spec.ts` ("preview content host"); `previewPanel.test.js` ("creates one message client per preview iframe, for the origin the server gave") |
| The host page accepts messages only from the embedding window on the application origin | `previewHostPage.test.js` ("accepts a port only from the embedding window on the application origin") |
| The workarea accepts messages only from the preview iframe on the expected content origin | `previewContentHost.test.js` ("ignores messages from another window or another origin"); E2E "the workarea ignores preview messages that do not come from the content origin" |
| Author scripts in the preview run on the content origin and cannot read the editor's DOM, cookies or IndexedDB | E2E `content-domain-preview.spec.ts` ("an author script runs on the content origin and cannot read the editor") |
| The preview label of a project is not valid for another project, origin or kind | `content-host.spec.ts` ("workarea preview host"); `content-label.spec.ts` |

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
- Frontend (Vitest): `previewContentHost.test.js`, `previewHostPage.test.js` and
  the "content domain mode" block of `previewPanel.test.js`.
- E2E (Playwright): `test/e2e/playwright/specs/content-domain-public-view.spec.ts`
  and `content-domain-preview.spec.ts` against a second server that `playwright.config.ts` starts on port 3003 with
  `EXE_CONTENT_DOMAIN=exe-content.localhost:3003` and `BASE_PATH=/exe`. The app
  is opened at `exe-app.localhost` so that the two are different sites.
- `*.localhost` resolution per engine is recorded in
  [`research.md`](research.md).

## Rollout plan

1. Phase 1 (this design): setting, label, host routing, public viewer.
2. Phase 2: the workarea preview on a per-project content origin. The Service
   Worker spike in `research.md` passed in Chromium, Firefox and WebKit.

## Risks and mitigations

See the Risks section of ADR-53-01.

## ADRs required or referenced

| Decision | ADR |
|---|---|
| Optional content domain on a different site, one keyed label per content item | ADR-53-01 |
| Opaque origin for the public viewer (kept as the default) | ADR-348-01 |
