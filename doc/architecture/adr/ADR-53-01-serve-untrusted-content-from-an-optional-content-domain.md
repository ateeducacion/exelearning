---
id: ADR-53-01
title: "Serve untrusted author content from an optional, separate content domain"
status: Proposed
date: 2026-11-24
tracking_issue: 53
deciders:
  - "@erseco"
reviewers: []
related:
  prs: [53]
  changes: ["53-content-domain-isolation"]
  adrs: [ADR-348-01, ADR-348-02, ADR-348-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5-2"
---

# ADR-53-01: Serve untrusted author content from an optional, separate content domain

> The tracking number is pull request 53 of `ateeducacion/exelearning`, the
> repository this change was proposed in.

## Context

Author content is HTML and JavaScript typed by authors, imported from files or
written by collaborators. It must not run in the application origin, where it
could use the session of whoever opens it.

[ADR-348-01](ADR-348-01-public-view-opaque-origin-isolation.md) isolates the
public viewer in an **opaque origin**: a sandboxed iframe without
`allow-same-origin`, enforced again by a `Content-Security-Policy: sandbox`
response header. That needs no extra infrastructure, which is why ADR-348-01
chose it and deferred a separate origin as too heavy for small installs.

Extending the opaque origin beyond the public viewer stalled on what an opaque
origin cannot do:

- Frames nested in the content inherit the sandbox. Embedded players (YouTube,
  Vimeo and others) then run in an opaque origin too and many refuse to play.
- A Service Worker cannot control an opaque-origin client, so the workarea
  preview (served by `public/preview-sw.js`) cannot move there.
- Blob URLs, `localStorage`, IndexedDB and the Cache API are bound to an origin;
  opaque-origin content has none of them.

The workarea preview therefore still runs author content in the editor origin
(`doc/architecture.md` §8.1–8.5).

## Problem

How can an installation give author content a real origin, so that embeds,
storage and Service Workers work, without that origin being the application's
and without imposing new infrastructure on installs that do not want it?

## Decision drivers

- **Security:** author content must not reach the application session, cookies,
  storage, API or DOM, and one author's content must not reach another's.
- **Compatibility:** nested embeds, storage and Service Workers must work.
- **No regression:** an install that configures nothing must behave exactly as
  before, and the opaque origin must never become weaker.
- **Deployment cost:** small single-host installs must not need DNS or TLS work.
- **Statelessness:** several application instances serve the same content hosts;
  nothing may depend on per-process memory.

## Options considered

### Option 1: Keep extending the opaque origin

- Pros: no infrastructure.
- Cons: the three limits above are properties of opaque origins, not bugs to
  work around. Relaying storage and media over `postMessage` reimplements the
  browser, one API at a time.

### Option 2: A subdomain of the application's domain

For example `content.app.example.org` for an application at `app.example.org`.

- Pros: one certificate and one DNS zone; a distinct origin.
- Cons: it is the same **site**, and several protections are per site, not per
  origin:
    - **Cookies.** A cookie set with `Domain=app.example.org` (by the
      application, a reverse proxy, an SSO gateway or any sibling service) is
      sent to the subdomain. Content on the subdomain can also set cookies for
      the parent domain and so plant values the application will read back
      (cookie tossing, session fixation).
    - **SameSite.** `SameSite=Lax` and `Strict` compare sites. A request from the
      content to the application is same-site, so the session cookie travels
      with it and `SameSite` gives no CSRF protection against the content.
    - **Process sharing.** Browsers isolate processes per site. Two origins of
      one site may share a renderer process, which removes the process boundary
      that protects against Spectre-class reads and renderer bugs.
- Rejected as the recommended layout. It is not blocked: the server logs a
  warning and keeps working, because for some operators it is still better than
  the editor origin.

### Option 3 (chosen): An optional content domain on a different site

An operator sets `EXE_CONTENT_DOMAIN=host[:port]`. Author content is then served
from `https://<label>.<host>/…`, with one label per content item, where the label
is a keyed hash that only the server can derive. Without the setting the
application behaves as before.

- Pros: a real origin per content item on a different site; embeds, storage and
  Service Workers work; items are isolated from each other; no change for
  installs that do not opt in.
- Cons: the operator needs a wildcard DNS record, a wildcard certificate and a
  reverse-proxy rule for the second domain.

### Option 4: One shared content origin for all content

- Pros: no wildcard DNS or certificate.
- Cons: every author's content shares storage, Service Worker scope and DOM
  access with every other author's. Rejected.

## Evidence

- Setting, validation and URL shape: `src/utils/content-domain.ts`
  (`parseContentDomain`, `contentDomainBootError`, `contentOrigin`).
- Label derivation: `src/utils/content-label.ts` — HMAC-SHA-256 keyed with the
  server signing secret over the content kind, the content id and the embedding
  application origin, truncated to 160 bits and written as a kind letter plus 40
  hexadecimal characters.
- Host routing: `src/routes/content-host.ts` — `contentHostGuard()` is the first
  thing mounted in `src/index.ts` and answers every request whose effective host
  (`getPublicUrl()` in `src/utils/proxy-url.util.ts`, which honours
  `TRUSTED_PROXIES`) is on the content domain.
- Isolation policy for both modes: `src/shared/security/publicViewSandbox.ts`
  (`CONTENT_DOMAIN_SANDBOX`, `publicViewCspHeader(profile, appOrigin)`,
  `contentDomainHeaders()`).
- Workarea preview transport: `public/app/workarea/interface/elements/previewHostPage.js`
  (host page on the content origin) and `previewContentHost.js` (workarea side),
  used by `previewPanel.js` when the server puts `previewContentHostUrl` in the
  client config.
- Tests: `src/routes/content-host.spec.ts`, `src/utils/content-domain.spec.ts`,
  `src/utils/content-label.spec.ts`,
  `src/shared/security/publicViewSandbox.spec.ts`, `src/routes/pages.spec.ts`
  ("iframe target", "preview content host"), the Vitest files next to the two
  preview modules, and `test/e2e/playwright/specs/content-domain-public-view.spec.ts`
  and `content-domain-preview.spec.ts`.
- Browser behaviour measured for this change (Chromium, Firefox and WebKit):
  [`research.md`](../changes/53-content-domain-isolation/research.md).
- Sites, not origins, bound cookies and `SameSite`:
  [RFC 6265bis, "Same-site and cross-site requests"](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-same-site-and-cross-site-re);
  process isolation per site:
  [Chromium Site Isolation](https://www.chromium.org/Home/chromium-security/site-isolation/).

## Decision

We will support an **opt-in content domain**. When `EXE_CONTENT_DOMAIN` is set:

1. Author content is served from `<label>.<content domain>`, one label per
   content item, derived server-side with a keyed hash. Clients never compute
   or choose labels.
2. On a content host only content routes answer. A content request is served
   only when the host label is the label derived for the requested content.
   Content-host responses never set cookies and never read the session.
3. The isolating iframe keeps a `sandbox` attribute for top-navigation and
   modal restrictions, with `allow-same-origin` so the content keeps its own
   origin. Responses carry `frame-ancestors 'self' <application origin>`,
   `object-src 'none'`, `X-Content-Type-Options: nosniff` and the existing
   Permissions-Policy.
4. There is no fallback. If the mode is configured and the content host does not
   serve the content, the user sees an error; the content is never served from
   the application origin instead.
5. The opaque-origin route of the application host (`/view/:id/_/*`) is
   unchanged in both modes.

When the setting is absent, none of this code path is taken.

This ADR does not supersede ADR-348-01. The opaque origin stays the default and
the only mode for installs without a content domain; this ADR adds the option
that ADR-348-01 listed as possible future hardening.

## Consequences

### Positive

- Author content gets a real, per-item origin on another site: embeds, storage
  and Service Workers work, and items cannot read each other.
- The workarea preview has somewhere to move to that is not the editor origin.
- Installs that do not opt in are unaffected.

### Negative

- Operators who opt in must maintain wildcard DNS, a wildcard certificate and a
  second reverse-proxy rule.
- Two serving modes exist and both must be tested.
- Content that keeps its origin can use storage and Service Workers on that
  origin. A published project's own scripts persist state across visits, which
  the opaque origin did not allow.

### Neutral

- The content URL carries the embedding application origin as a path segment,
  because the application has no setting that names its own public origin. The
  label binds it, so it cannot be altered.
- Labels depend on the server signing secret. Rotating it changes every content
  origin, which discards the storage the content kept there.

## Risks

- **Misconfiguration to the same site.** A content domain under the application
  host weakens the isolation (Option 2). The server warns at runtime; the
  deployment page explains why. Not blocked by design.
- **Content domain equal to, or a parent of, the application host.** The
  application host would be treated as a content host and answer 404. The first
  such request logs a warning that names the cause.
- **Untrusted `X-Forwarded-Host`.** Host routing trusts the forwarded host only
  from `TRUSTED_PROXIES`. An install that trusts every client lets a client
  choose the host; that is an existing property of that setting.
- **Public Suffix List.** Sibling labels are different origins but one site
  unless the content domain is on the PSL. Per-origin isolation (DOM, storage,
  Service Workers) does not depend on it; process isolation between two content
  items does. Registration is out of scope here.

## Validation

- The unit and E2E suites listed under Evidence assert each invariant.
- `public-view-sandbox.spec.ts` passes unchanged with the mode off.
- The viewer template renders byte-identical HTML with the mode off (compared
  against `main` while developing this change).

## Follow-up work

- The workarea preview uses the content domain too (phase 2 of the change).
  The remaining editor-origin surface is listed as a known gap in the design:
  the print preview.
- Consider registering a hosted content domain in the Public Suffix List.
- LMS and CMS plugins, the Electron app and static mode are not covered.

## References

- Pull request 53 (`ateeducacion/exelearning`).
- [Change design](../changes/53-content-domain-isolation/design.md).
- [ADR-348-01](ADR-348-01-public-view-opaque-origin-isolation.md) — opaque-origin
  isolation of the public viewer.
- `doc/architecture.md` §8.6 and `doc/content-domain.md`.
