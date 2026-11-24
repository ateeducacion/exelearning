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
