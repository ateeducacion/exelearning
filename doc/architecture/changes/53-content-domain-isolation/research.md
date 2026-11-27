---
tracking_issue: 53
title: "Optional content domain for untrusted author content"
date: 2026-11-24
authors:
  - "@erseco"
reviewers: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5-2"
---

# Optional content domain for untrusted author content — research

## Measurements

All runs: macOS 26 (Darwin 25.4.0, arm64), Playwright 1.65.1 with its bundled
Chromium, Firefox and WebKit builds, one local server started with
`BASE_PATH=/exe EXE_CONTENT_DOMAIN=exe-content.localhost:3003 PORT=3003`.

### `*.localhost` as a cross-site test bed

The application is opened at `http://exe-app.localhost:3003/exe` and the content
is served from `http://<label>.exe-content.localhost:3003/exe`. `localhost` is
treated as a public suffix, so `exe-app.localhost` and `exe-content.localhost`
are different sites.

| Engine | Resolves `*.localhost` to loopback | Workaround needed |
|---|---|---|
| Chromium | yes | none |
| Firefox | yes | none |
| WebKit | yes | none |

Playwright's Node HTTP client (`page.request`) also resolved these names on
macOS. That depends on the operating system resolver, so the E2E spec makes
every request from the browser, and `playwright.config.ts` probes server
readiness over `127.0.0.1`.

### Public viewer on a content origin

Probe run inside the content frame of a published project, loaded through
`/view/<id>` on the application host:

| Probe | Chromium | Firefox | WebKit |
|---|---|---|---|
| `window.origin` | content origin | content origin | content origin |
| `window.parent.location.href` | throws | throws | throws |
| `document.cookie` | empty | empty | empty |
| `localStorage` set then get | works | works | works |

Method: a script using the `playwright` package that logs in as a guest, creates
a project, enables its public link and evaluates the probe in the iframe. The
same checks, without WebKit, are now
`test/e2e/playwright/specs/content-domain-public-view.spec.ts`; the project's
E2E suite runs Chromium and Firefox only.

### Spike: a Service Worker inside a cross-site iframe

Question (gate for phase 2): can a small host page on the content origin, loaded
in an iframe of the workarea, register a Service Worker that controls it and a
frame nested in it, receive the generated export from the workarea over a
`MessageChannel`, and serve it?

Method: a standalone Bun server answering two sites
(`spike-app.localhost:3055` for the parent page, `<label>.spike-content.localhost:3055`
for the host page and worker) and a Playwright script. The parent frames the
host page with the content-domain sandbox tokens. The host page registers
`/sw.js`, announces itself with `postMessage`, receives a `MessagePort`, forwards
`SET_CONTENT` to the worker and then loads `/viewer/index.html` in a nested
frame. That file exists only in the worker's memory, so a 200 proves the worker
served it. An "author" script in it reports what it sees.

Result, Playwright 1.65.1 builds plus the installed Chrome:

| Check | Chromium 159 | Firefox 159 | WebKit 27.2 | Chrome 158 |
|---|---|---|---|---|
| `Sec-Fetch-Site` of the iframe request | `cross-site` | `cross-site` | `cross-site` | `cross-site` |
| Application cookie (`SameSite=Lax`) sent to the content host | no | no | no | no |
| Worker registers and controls the host page (first load) | yes | yes | yes | yes |
| Nested frame served by the worker, `controller` set | yes | yes | yes | yes |
| `fetch()` from the nested frame served by the worker | yes | yes | yes | yes |
| `window.origin` in the nested frame | content origin | content origin | content origin | content origin |
| `window.top.location.href` from the nested frame | throws | throws | throws | throws |
| `localStorage` and `indexedDB` in the nested frame | work | work | work | work |
| Same checks after reloading the parent | pass | pass, see below | pass | pass |
| A second label gets its own origin and worker | yes | yes | yes | yes |

**The spike passes in every engine.** Two findings shaped the implementation:

1. **Firefox starts a later load uncontrolled.** On the first load the page
   becomes controlled when the new worker activates and calls
   `clients.claim()`. On a later load of the same content origin, with the
   worker already active, Firefox reported `navigator.serviceWorker.controller`
   as `null` for the framed host page and never fired `controllerchange`, so a
   page that waits for it hangs. Chromium and WebKit start controlled. Asking
   the active worker to claim on demand fixes it in Firefox and is harmless
   elsewhere; `preview-sw.js` already has that message (`CLAIM_CLIENTS`). The
   host page does this whenever it finds itself uncontrolled.
2. **Partitioning state differs, and the worker works in both states.** Opening
   the same content origin as a top-level page afterwards showed whether the
   framed registration and storage were partitioned by top-level site:

   | Build | Framed registration visible top-level | Framed `localStorage` visible top-level |
   |---|---|---|
   | Chromium 159 / Chrome 158 (default flags, and with `--enable-features=ThirdPartyStoragePartitioning`) | yes | yes |
   | Firefox 159, Playwright defaults | yes | yes |
   | Firefox 159 with State Partitioning forced on (`network.cookie.cookieBehavior=5`, `privacy.partition.serviceWorkers=true`) | no | no |
   | WebKit 27.2 | no | yes |

   So the worker was observed registering and controlling the frame with
   partitioning active in Firefox and WebKit. In the Chromium builds storage was
   not partitioned on these loopback hosts, with or without the feature flag, so
   the partitioned case was **not** observed there. Chrome documents Service
   Workers as partitioned by top-level site
   ([Storage Partitioning](https://privacysandbox.google.com/cookies/storage-partitioning)),
   and the transport does not depend on sharing the worker with any other
   context, but that case should be confirmed on a real deployment with two
   registrable domains over HTTPS. It was: see
   [Real deployment](#real-deployment).

Consequences for the design: the workarea always reaches the worker through the
host page it frames, never through a top-level page of the content origin. With
partitioning, a top-level tab of the content origin gets a different worker with
no content, which is one reason "open the preview in a new tab" is not offered
in this mode (see `design.md`).

### Workarea preview on a content origin

Run by `test/e2e/playwright/specs/content-domain-preview.spec.ts` in Chromium
and Firefox: a project with an author `<script>` in a text iDevice, previewed
from the workarea.

| Probe from the author script | Result |
|---|---|
| `window.origin` | the project's content origin |
| `navigator.serviceWorker.controller` | set |
| `window.top.document.title`, `.body`, `window.top.eXeLearning` | `SecurityError` |
| `document.cookie`, `window.top.document.cookie` | empty, `SecurityError` |
| `indexedDB.databases()` | none of the editor's databases |
| `fetch('<app>/api/session/check', { credentials: 'include' })` | not authenticated |

### Real deployment

Date: 2026-11-27. A deployment of this branch with the application on one
registrable domain and `EXE_CONTENT_DOMAIN` on another, both over HTTPS behind
Cloudflare, with Nginx and Traefik in front of the container. A project with an
author `<script>` in a text iDevice was opened through its public link and
previewed from the workarea.

| Check | Chrome 158 | Chromium 145 (Playwright) | Firefox 146 (Playwright) | Safari 26.4 |
|---|---|---|---|---|
| Public viewer: content on `https://v<hash>.<content domain>`; `window.top` and `window.parent` throw; no cookies; its own `localStorage`; not authenticated against the application | pass | pass | pass | pass |
| The embedding page cannot read the content document | pass | pass | pass | pass |
| Workarea preview: content on `https://p<hash>.<content domain>`, served by that origin's worker; the editor's page and cookies are out of reach | pass | pass | pass | pass |
| Framed registration visible to a top-level page of the content origin | no | yes | yes | no |
| Framed `localStorage` visible to a top-level page of the content origin | no | yes | yes | no |

Chrome 158 and Safari 26.4 are the installed browsers (Safari driven through
`safaridriver`). In both, the Service Worker and the storage of the framed
content origin were partitioned by top-level site, and the preview worked. That
is the case the loopback spike could not produce in Chromium.

The deployment also showed three things that are not about browsers. They are
now in [`doc/content-domain.md`](../../../content-domain.md):

1. The content is served with the scheme the application believes it has. With
   a proxy chain that reported `http` to the application, the viewer page
   carried an `http://` content URL.
2. With `TRUSTED_PROXIES` set and a proxy that did not set `X-Forwarded-Host`
   and `X-Forwarded-Port`, a client could choose the host and the port of the
   application origin in the response to its own request. Setting both headers
   in the proxy, or `TRUSTED_HEADERS=x-forwarded-proto,x-forwarded-for`, closed
   it.
3. Cloudflare Email Address Obfuscation, on by default, rewrote the e-mail
   addresses in the author's HTML on the content hosts and added a script from
   `/cdn-cgi/`. It was turned off for the content zone.
