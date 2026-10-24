---
tracking_issue: 48
title: "Static direct file save: blocked activation and save-before-leave corrections"
status: draft
date: 2026-10-24
authors: ["Codex (AI-assisted work; human review pending)"]
reviewers: []
implementation_prs: [48]
related_adrs: ["ADR-48-01"]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Codex (ChatGPT Work)"
  model: "GPT-6"
---

# Static direct file save: blocked activation and save-before-leave corrections

## Delivery boundary

**The requested direct Save/Save As feature is not implemented or ready for acceptance.**
The security prerequisite failed source inspection and a browser characterization.
This draft contains real corrections to the existing fallback/native flows and their
regression tests. It contains no persistent handles, new overwrite RPC, disabled
feature flag or claim that the full requested test matrix has passed.

Base: fork `ateeducacion/exelearning`, `main` at
`c848eca0018d6b3d909c942f085d5c787ca72a85`. Branch:
`feature/static-direct-file-save`. The user's later request includes Electron, but
neither runtime gains silent overwrite here. Acceptance requires at least 90% line
coverage of the patch and global backend/frontend line coverage, plus all other
quality and security gates. A suite's zero exit code is not a substitute for that
coverage requirement.

## Current state and findings

| Surface / contract | Observed behavior at the base | Implication |
|---|---|---|
| `YjsProjectBridge.exportToElpx` | Calls shared exporter, then `electronAPI.saveBuffer` or a link click | Updating an unused file adapter is insufficient |
| `YjsProjectManagerMixin.exportToElpxViaYjs` | Does not forward an options argument | Existing `{saveAs: true}` call sites do not create a new operation contract |
| `previewPanel.js`, workarea template | Script-enabled, same-origin SW preview and app-origin blob fallback; separate-window support | The author preview is not a capability boundary |
| `ideviceNode.js:exportProcessIdeviceHtml` | Inserts imported HTML into the editor DOM | Preview iframe isolation alone is incomplete |
| `YjsProjectBridge._captureHtmlAsScreenshot` | Writes HTML into an unsandboxed hidden iframe after a script-tag regex | Inline handlers and nested executable content need a separate isolation audit; regex removal is not a sanitizer |
| `EmbeddingBridge.handleMessage` | Optional origin list, no unconditional parent-source check | No privileged writer can rely on this protocol without a trust redesign |
| `EmbeddedFileSystem._handleMessage` | Correlates request IDs, does not unconditionally check `event.source` or exact expected response type | Do not expose file capabilities through this response channel |
| `projectManager` pending import | One shared IndexedDB key, deleted when read before import is validated | Needs operation/tab ownership and acknowledgement before handle association |
| `transitionToProject`, logout save handlers | Awaited an operation but did not validate success | Cancellation/failure could proceed to destructive navigation |
| `generateScreenshotFromFirstPage` | Called `markClean()` after asynchronous rendering | Export preparation could erase dirty state even before a cancelled native dialog |
| `ElectronFileSystem.saveAs` vs `app/preload.js` | Two arguments versus three | Filename occupied the project-key argument |
| `app/main.js:saveBufferWithDialog` | Returns a selected `filePath` on write failure and writes with `fs.writeFileSync` | Selected path is not a save receipt; no verified backup/atomic replacement is provided |
| `AssetManager.markAssetsSavedLocally` | Acknowledges all live IDs | Cannot prove which resource versions were in an asynchronous export |

These findings refer to actual functions, not assumptions from their names. Existing
public-view server isolation is documented separately in `doc/architecture.md` §8.6.
It is not reused by the static authoring preview.

## Implemented behavior

- Save-before-New/Open/Import requires `saved === true` for the existing static/native
  exporter or `success === true` for the existing server save manager. Missing,
  cancelled, failed and ambiguous responses leave location and unload guards intact.
- The captured bridge and document manager must still belong to the same project
  before a save result authorizes a transition. The navbar cannot clean a replacement
  project's document after a delayed native result.
- The unload warning is removed immediately before navigation, after fallible server
  and pending-import preparations. Failed preparation leaves the warning installed.
- Native save-and-close and online save-and-logout reject unconfirmed results. An
  unavailable exporter does not silently close. Explicit discard remains explicit.
- `UnsavedChangesHelper` requires an explicit discard or successful save result;
  unknown modal results do not authorize leaving.
- Screenshot generation captures its document manager, ignores results for a replaced
  document or a newly supplied custom screenshot, and suppresses only its synchronous
  derived-metadata mutation. It never calls `markClean()` to acknowledge user work.
- Browser ELPX export returns `{saved: false, downloaded: true}`. The navbar reports
  that the download started, retains pending document/assets and asks users to check
  the copy before leaving. The browser cannot observe cancellation in its download UI.
- Electron adapter Save As passes `(bytes, projectKey, suggestedName)` to the real
  preload contract. Native write failures preserve the error and remain unsuccessful
  even when the response contains a path. Native dialogs still prompt.

No ELPX format, server/CLI exporter, embedding protocol or translation catalog is
changed. These fixes do **not** constitute immutable export snapshots, file conflict
checking, durable recovery, safe persistent permissions or verified native disk writes.

## Browser characterization of the blocked boundary

A disposable test imported a modified copy of the existing public repository fixture
`really-simple-test-project.elpx` with a script in `pp_extraHeadContent`. The importer
retained that script as `extraHeadContent`. The test then passed that imported header
through the production `PreviewPanelManager.injectHtmlToIframe` blob sink. This is
**sink characterization**, not proof that every automatic preview path executes it.

With browser origin enforcement enabled, the script reached `top.document`, opened
an app-origin IndexedDB record and read the sentinel `capability-sentinel` under a
real Web Lock. Observation:

```json
{"saveAuditParent":"accessible","saveAuditRead":"capability-sentinel"}
```

No user file or personal data was used. This experiment used a string sentinel,
not a picker-granted handle. Earlier OPFS-handle experiments did not complete
successfully and are **not** evidence of tested handle permissions or disk writes.
No browser download interception is described as a native picker test.

The environment could not download Playwright's pinned Chromium 145 archive (empty /
invalid ZIP). The characterization and additional static checks used a locally
extracted Chromium 153.0.8010.0 binary from `@sparticuz/chromium@153.0.0`, installed only
in the task's tooling directory. Playwright launched it with its normal arguments;
Sparticuz's default argument list, which disables web security, was **not** used.
There are no production hooks or dependencies for this harness. Firefox 146 could
also start with its process sandbox disabled for this container; that does not
supply native Chromium picker/permission coverage. Exact final browser results are
listed below.

The accepted boundary must cover preview and pinned frames, screenshot iframes,
HTML resources, custom themes/scripts, blobs/srcdoc, nested frames, popups and old
same-origin contexts. An upgrade cannot assume old tabs incorporated a new policy.
The implementation decision is [ADR-48-01](../../adr/ADR-48-01-require-content-isolation-before-file-capabilities.md).

## Required direct-save design — not implemented

The following contracts remain acceptance work, not hidden functionality.

### Identities and baseline ownership

| Identity | Required purpose | Must not be substituted with |
|---|---|---|
| Editing session UUID + navigation generation | Bind an operation to exactly one live editing session | `odeId`, title, `'default'` |
| Yjs project UUID | Editing/persistence lookup | File overwrite authorization |
| Canonical file ID | Coordinate cooperating writers after serialized `isSameEntry()` comparisons | Filename, content hash, a newly generated ID for each handle |
| Session's base version | SHA-256 of the exact bytes that session imported or last verified | Latest shared registry version written by another tab |
| Snapshot receipt | Exact document revision plus pinned resource versions | Yjs state vector alone, `odeVersionId`, all current asset IDs |

Resolve canonical entries under an origin-wide registry lock. Read records in short
IndexedDB transactions, perform asynchronous handle comparisons outside transactions,
and commit the chosen identity in a fresh transaction while holding the registry
lock. Keep each session's base version independent. A BroadcastChannel notification
is not evidence that an old tab incorporated another tab's changes.

Use a fixed lock order: session operation → canonical registry resolution → canonical
file lock. Never await an operation that takes these in reverse order. Web Locks
cannot coordinate other browser profiles or external programs.

### Selection, snapshot and commit

Start pickers/permission requests from the real UI gesture before hashes, exports or
lock waits. Consult actual permission state after restored handles; a stored handle
is not proof of permission. Legacy `.elp`, New, templates and partial imports must
start without an overwrite association. Pending imports need unique operation/tab
IDs, exact bytes/base hash and acknowledgement only after successful full import.

Flush or explicitly block active editors, IME composition, debounced properties and
resource mutations. Export from an immutable document/resource view, or a complete
revision mechanism with bounded retries that observes deletions and binary changes.
Validate ZIP/XML/resource references without executing the generated HTML/JS.

Before overwrite, compare complete SHA-256 bytes against the session's base, keep a
verified mandatory backup and pending work, journal the intent, revalidate the file,
write staged data and only call `close()` after successful `write()`. Attempt abort
on pre-commit failure. Read back and verify before acknowledging a revision or
changing an association. Do not delete a zero-byte destination as presumed cleanup.

Results must distinguish cancellation, permission denial, conflict, pre-commit
failure, uncertain commit, verified write and verified write with failed metadata
persistence. IndexedDB, OPFS and the visible file are not one transaction. A native
external process can still race between the final comparison and replacement;
no compare-and-swap or power-loss durability claim is justified by this API.

### Recovery and compatibility

A quota-aware journal must preserve both old bytes and new work, including the first
session that never saved successfully. Rotation cannot delete pending recovery. On
restart classify the target as old hash, expected new hash, neither hash or
inaccessible. Never retry or restore blindly over third-party changes. Clearing site
data can delete OPFS; it is not an external backup.

Electron additionally needs a main-process-authorized per-window/session association,
validated sender/frame/operation contracts, canonical native file identity, symlink
and replacement handling, verified backup and native temporary-file replacement.
Main-frame IPC filtering alone does not protect against content that can call its
same-origin parent's exposed API. No renderer-supplied path or project key may
become overwrite authority.

Embedding must continue delegating to the actual host. Online, CLI and other export
formats retain their current paths. The preview transport must preserve navigation,
relative assets, multimedia, source downloads and offline PWA upgrades before any
persistent permission is enabled.

## Regression requirement → test → oracle

Paths are relative to the repository root. Stable IDs identify invariants rather
than counting trivial variants as separate requirements.

| ID | Test file | Observable oracle |
|---|---|---|
| LEAVE-01–04 | `public/app/workarea/project/projectManager.test.js` | Failed/ambiguous server or static result preserves location, guard and native association; replacement bridge cannot navigate |
| LEAVE-05–08 | `public/app/workarea/modals/modals/pages/modalSessionLogout.test.js` | Cancel/failure does not close the native window or redirect logout; unavailable exporter fails closed |
| LEAVE-09–10,14 | `public/app/utils/unsavedChangesHelper.test.js` | Explicit confirmation required; replacement session and unknown modal result deny leave |
| LEAVE-11–12 | `public/app/workarea/menus/navbar/items/navbarFile.test.js` | Delayed result cannot clean another document; undefined export is not success |
| LEAVE-13 | `test/e2e/playwright/specs/save-before-leave-static.spec.ts` | Built static UI, controlled cancelled Electron bridge, original title/dirty indicator/unload warning |
| LEAVE-15–16 | `public/app/workarea/interface/elements/logoutButton.test.js` | Legacy close entry point also preserves the window on unconfirmed/unavailable export |
| DESKTOP-01–03 | `public/app/core/adapters/ElectronFileSystem.test.js` | Actual preload source in VM; exact binary bytes, third-argument filename, error retained when native response has a path |
| DOWNLOAD-01 | `public/app/workarea/menus/navbar/items/navbarFile.test.js` | Download-started UI with no document acknowledgement |
| DOWNLOAD-02 | `test/e2e/playwright/specs/save-detection-static.spec.ts` | Real static download preserves document/resource warning |
| DOWNLOAD-03 | `test/e2e/playwright/specs/save-before-leave-static.spec.ts` | Actual downloaded ZIP/XML, SHA-256 of asset bytes, reimport into fresh context and semantic title/text/resource equality |
| SNAPSHOT-01–03 | `public/app/yjs/YjsProjectBridge.test.js` | Screenshot preserves dirty state, including mid-render edit; replaced document is not mutated/cleaned |

## Requested matrix: remaining acceptance work

`Not implemented / not run` below is deliberate. Passing fallback tests do not
satisfy the direct-save scenarios listed in these rows.

| ID / group | Unmet cases from the requested specification | Result |
|---|---|---|
| DIRECT-01 Functional | First direct Save; subsequent save without download; Save As; download-copy without rebinding; shortcuts; clean file and renamed title | Not implemented / not run |
| DIRECT-02 Association | Same names in different folders; same content or odeId in different files; duplicate handles; A→B; New/template after A | Not implemented / not run |
| DIRECT-03 Import | Picker cancel; invalid ZIP/XML; size limits; partial failure; missing assets/degraded imports; legacy ELP; component imports; reload; simultaneous imports and handle ownership | Not implemented / not run |
| DIRECT-04 Permissions | Granted/prompt/denied; revocation before/during save; restored handles; temporary/persistent permission; lost activation; insecure context; API absence | Not implemented / native permissions not run |
| DIRECT-05 Save As | Cancellation/failure keeps old association; new/empty/nonempty target; same-handle conflict; other-tab target; Unicode/spaces/dots/extensions | Not implemented / not run |
| DIRECT-06 Conflicts | Same size/mtime mutation; changes during hash/backup; deleted/replaced file; reread error; rejection leaves bytes untouched; explicit copy resolution | Not implemented / not run |
| DIRECT-07 Concurrency | Double Ctrl+S; simultaneous Save/Save As; atomic canonical registration; stale session after other-tab save; other profile; close while waiting; lock release/deadlock | Not implemented / not run |
| DIRECT-08 Consistency | Edit during export/write; resource add/remove/replace; metadata-only; debounce; open iDevice; undo/redo; Yjs deletion; exact asset acknowledgement | Screenshot regression covered; direct snapshot cases not implemented |
| DIRECT-09 I/O | createWritable/write/close/abort/getFile failures; quota; partial stream; exclusivity unavailable; bad readback; native lock; old bytes before commit | Adapter native-error receipt covered; direct writer not implemented |
| DIRECT-10 Recovery | Interruption at every stage; disk new/metadata old; third hash; first unsaved session; rotation failure; truly reimportable recovery | Not implemented / not run |
| DIRECT-11 Security | parent/top/opener; IndexedDB; forged/replayed messages; separate windows; malicious themes/scripts; traversal/bombs; no handle leakage; old same-origin tabs | Source blocker and browser origin characterization; isolation NOT passed |
| DIRECT-12 Compatibility | Preview/media/navigation; SW and blob fallback; installed offline PWA; Firefox/WebKit no picker; real host embedding; real Electron; online/CLI/other exports | Existing suites attempted; no full compatibility acceptance |
| DIRECT-13 Performance | Representative small/large files; incremental hash; measured memory/time; cancellation; worker/URL/stream/listener leaks | No direct writer/hash implementation; not run |
| DIRECT-14 State machine | Seeded edit/open/save/cancel/close/revoke/fail sequences with byte/association invariants | Not implemented / not run |

## Executed validation

The tested executable snapshot is Git tree `e73ae39a9a0171e9ce90fd59eaaebd6e38319c28`,
published as code commit `7f04fccd2fe34c86eaa08881ab7247ea6a2c914a`. The following
architecture-only commit does not change those executable files or tests. Final-SHA
CI is checked separately in the PR; an older run is not used as its result.

| Command / check | Result | Evidence and limitation |
|---|---|---|
| `make fix` (final code) | PASS, exit 0 | Existing Biome warnings remain; no unrelated source changes retained |
| `make test-unit` | FAIL, exit 2 from make | 10,933 passed / 2 failed; backend line coverage 96.70%, functions 96.20%; coverage enforcement after the failed suite was not reached |
| Clean-base `make test-unit` in a separate worktree | Same FAIL | Same 10,933 / 2 and 96.70% lines at c848eca0018d6b3d909c942f085d5c787ca72a85 |
| `make test-frontend` (final code) | Tests PASS, exit 0 | 316 files / 18,161 tests passed; 88.68% lines, 87.86% statements, 87.58% functions, 74.68% branches |
| Requested global frontend lines >=90% | FAIL | 36,505 / 41,163 covered executable lines; **not waived** |
| Local executable changed-line coverage | PASS | 68 / 68 = 100%, computed by intersecting added/modified executable lines from git diff against fork main with DA records in `coverage/vitest/lcov.info`; this is local V8 coverage, not Codecov CI or browser coverage |
| `make test-integration` | PASS | 777 tests, 0 failures across 45 files |
| `make build-static` (final code) | PASS | Full generated static distribution, not only individual modules |
| `make test-e2e` | FAIL (environment) | Pinned Chromium 145 binary unavailable; archive download returned an empty/invalid ZIP; test assertions were not meaningfully executed |
| `make test-e2e-static` | FAIL (environment) | Static build passed; `serve` failed on `uv_interface_addresses` in this container before the suite could run |
| `make test-e2e-firefox` | NOT COMPLETED | Started; no complete suite result obtained. Collecting the run ended with the execution tool reporting cancelled network approval. Not counted as pass |
| Additional static browser run using temporary `focused-browser.config.ts` | PASS, 9 tests | Chromium 153.0.8010.0, Python static server, final built distribution; includes actual ZIP/asset SHA-256 and fresh-context semantic reimport. It does not replace the mandatory full E2E gates |
| Disposable origin/IndexedDB/Web Locks characterization | Boundary exposure confirmed | 1 characterization completed; imported script reached top and read a sentinel through the production blob sink. This is evidence of a blocker, **not** a security acceptance pass |
| Native Chromium/Edge picker, permissions and external-program conflicts | NOT RUN | No picker mock, OPFS test or IPC double is counted as a real picker/permission test |
| Real Electron on macOS/Windows/Linux | NOT RUN | Adapter/actual-preload VM contract and controlled browser IPC tests only |
| WebKit / Edge / installed-PWA upgrade | NOT RUN | No complete harness outcome; no compatibility acceptance claimed |
| `make architecture-check` | PASS | 50 records, 11 changes validated after obtaining fork PR #48 |

The two backend failures reproduced on both branch and clean base are:

- `src/routes/convert.spec.ts`: `Convert Routes > Internal Error Handling > should handle internal error in export/:format endpoint` (expected 500, received 200).
- `src/cli/commands/elp-convert.spec.ts`: `elp:convert command > output directory validation > should fail if output directory cannot be created` (expected failure for `/root/test/output.elpx`, but this container runs as root and the write succeeded).

These are reported as failures, not silently excused or removed. No thresholds were
reduced, no tests were deleted and no skip was added. The changed browser assertion
that previously expected every download to clear the warning now checks the requested
unconfirmed-download semantics. The cancelled-save test remains strict and exposed
the screenshot `markClean()` defect before that fix.

To reproduce the additional focused browser run in a constrained environment, use a
temporary Playwright config with the two committed `*-static.spec.ts` files above,
project name `static`, base URL `http://127.0.0.1:3002`, a normal Chromium launch with
an explicit executable path, and a managed `python3 -m http.server 3002 --bind
127.0.0.1 --directory dist/static` server. The regular supported command on a machine
with the pinned browser is `bun x playwright test --project=static
save-before-leave-static.spec.ts save-detection-static.spec.ts`; that exact command
was not substituted for a full mandatory gate here. No browser security policy was
disabled for the Chromium characterization or focused checks.


## Compatibility and residual risk

Preserved code paths do not establish full regression acceptance when the mandatory
E2E suite is blocked. Existing pending-import deletion, resource acknowledgement and
native direct-write behavior remain unchanged except for the receipt/screenshot
corrections described above. None of those paths may acquire a persistent file
association until their separate invariants are implemented and tested.

No native picker, persistent browser permission, external-program race, macOS/Windows
native dialog, Electron power-loss recovery or already installed PWA migration was
validated. No measurements of an incremental hash are claimed because it was not
implemented. No new dependency is shipped.

## Rollback

Revert this PR's commits through a normal reviewed revert; no format, database or
capability migration is required. That would restore the pre-existing failed-save
transition and download acknowledgement behavior. There is no flag, deployment or
release to roll back.

## ADRs required or referenced

| Decision | ADR |
|---|---|
| Require a genuine author-content boundary before retaining file write capabilities; keep blocked work explicit | [ADR-48-01](../../adr/ADR-48-01-require-content-isolation-before-file-capabilities.md) |
