---
tracking_issue: 41
title: "Native Synology package verification"
status: in-review
date: 2026-09-17
authors: ["@ateeducacion"]
reviewers: []
implementation_prs: [41]
related_adrs: [ADR-41-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "OpenAI Codex"
  model: "GPT-6"
---

# Native Synology package verification

Architecture decision: [ADR-41-01](../../adr/ADR-41-01-run-synology-package-natively.md).

## Installation failures reproduced

The original native implementation failed while acquiring `port-config`: its protocol file was not included at the declared payload path. The loopback-only backend does not need this resource, so it was removed. The unused `usr-local-linker` resource also had an invalid value and was removed.

After resource registration, the original executable tried to load jsdom's stylesheet from the build machine's absolute path. Loading the installed production dependency tree at runtime fixes the path. Bun 1.4.2 compiled executables additionally need `--compile-autoload-package-json` to resolve those dependencies; this was reproduced with a standalone executable, independently of the web server.

DSM rejected the first upgrade because `preupgrade` was absent. Both upgrade hooks are now packaged, along with DSM's correctly named uninstall hooks. The final archive tests require them.

The service must expose `APP_VERSION` with the application's `v` prefix: its static router recognizes `/v<version>/...`. A bare SemVer produced CSS/JavaScript URLs returning 404. The lifecycle test now checks the exported version, and the native smoke test downloads the actual asset URLs rendered into the login page.

The real DSM session initially failed authentication because the CGI request lacked DSM's CSRF token. The browser bridge obtains the existing session token from `/webman/login.cgi` and supplies it only as a header to the package CGI. The official server-side authenticator remains the authority for the username; credentials are never requested. Tests cover rejection, token handling, fixed callback navigation and failure cases.

DSM's regex static-file locations overrode the original package prefix and returned 404 for CSS/JavaScript. The package now uses `location ^~ /exelearning/`, verified through DSM nginx after an upgrade.

## Hardware evidence

Test device: Synology DS918+, Intel Celeron J3455, DSM 7.2.2-72806 Update 9, kernel 4.4.302, glibc 2.36. This CPU supports SSE4.2 but not AVX2. Bun 1.4.2 uses the current unified x64 build; the old baseline/AVX2 distinction does not explain these failures.

Verified on the device:

- Native SPK installation and upgrades through numeric version `4.0.5.3.0-9`.
- The server runs as the unprivileged `exelearning` account.
- The listener is `127.0.0.1:8085`; DSM nginx exposes `/exelearning/`.
- Backend health and nginx redirects respond successfully.
- Database, configuration and a retained test file's SHA-256 hashes remain unchanged across stopped-package upgrades.
- After terminating the server, the service hook reports exit status 3 (stopped), and Package Center's service mechanism can stop/start it successfully.
- The native eXeLearning launcher appears in DSM's application menu and opens an authenticated editor without another password prompt.
- Project save/reopen, ELP import, ELPX download (74 valid ZIP entries), preview and same-account two-tab WebSocket synchronization passed.
- Revision 9 was installed through Package Center for the demonstration video. Immediately after upgrade, an initial browser request reached DSM's 404 page while nginx reloaded; a reload succeeded.
- DSM executes the package CGI as the package account, without setuid.
- The compiled CGI rejects an unauthenticated request with HTTP 401 and `Cache-Control: no-store`.
- The extracted revision-8 SPK passes the native smoke test as the package account: executable startup, SQLite health, rendered login template and every CSS/JavaScript URL referenced by that page. Its SHA-256 also passes verification.

The first SQLite initialization on this NAS is slow. A fresh-database smoke run with a two-minute deadline timed out while waiting in Btrfs `fsync`; the subsequent package-account runs passed with the ten-minute startup deadline. Durability settings have not been weakened to conceal this. Temporary test trees were removed after the successful runs.

## Automated verification

- Frozen-lockfile dependency installation and the normal asset/standalone build passed.
- `make fix`, ShellCheck for all Synology shell scripts, architecture validation and `git diff --check` passed. Existing Biome warnings remain.
- `make test-unit`: 8,838 passed; `make test-integration`: 770 passed.
- `make test-coverage`: frontend 16,120 passed. Changed executable TypeScript lines represented in the focused LCOV report: 264/266 (99.25%). Entrypoint wrappers and DSM lifecycle/compilation are verified by archive, command and hardware tests rather than this LCOV total; type-only declarations emit no executable lines.
- Focused packaging, authentication, administrator and renderer suite: 297 passed.
- `make test-e2e`: 564 passed, 11 existing skips. An earlier run alongside the static suite had one collaboration timeout; all 13 collaboration tests and the full web suite subsequently passed. No test was disabled to obtain this result.
- `make test-e2e-static`: 453 passed, 134 existing skips; the subsequently added static-provider visibility test passed separately.
- Browser SSO with a simulated DSM boundary passed, including state transfer, external account creation, local password-change rejection, logout, and display of Synology as a selected authentication method in the administrator UI. The settings API test also verifies its persistence. The actual DSM session was separately verified on the device. Final targeted web and static tests passed (2 each) after the token handshake and nginx changes.

## Remaining physical verification

- Application logout without DSM logout and administrator bootstrap.
- Collaboration between independent DSM users and large uploads.
- Retention after uninstall/reinstall and behavior on other NAS models.
- Actual GitHub release/prerelease artifact attachment.

Mermaid's existing server prerenderer may fall back to browser rendering when its SVG/CSS DOM requirements are unavailable. Tests must check that the diagram is preserved; they must not claim native SVG rendering solely because jsdom loads.

## Release identity

The workflow checks out the event's release tag and uploads to that same release. Manual builds require an existing tag and only upload workflow artifacts. Local `4.0.5` revision builds used for this investigation contain the working branch; they are test artifacts, not published upstream release artifacts.

Final test artifact: `exelearning-4.0.5-9-x86_64.spk`, 86,480,384 bytes. SHA-256: `9bf8c70cd92515a28880a93b12c53a2b668ed28db4086247c4c6b9cffb0637c2`.
