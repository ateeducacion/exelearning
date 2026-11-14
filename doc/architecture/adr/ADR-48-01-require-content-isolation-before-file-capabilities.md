---
id: ADR-48-01
title: "Require content isolation before granting reusable file write capabilities"
status: Proposed
date: 2026-10-24
tracking_issue: 48
deciders: ["Unassigned (human decision pending)"]
reviewers: []
related:
  prs: [48]
  changes: ["48-static-direct-file-save"]
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Codex (ChatGPT Work)"
  model: "GPT-6"
---

# ADR-48-01: Require content isolation before granting reusable file write capabilities

## Context

The requested change is direct Save/Save As for the static/PWA editor, with an optional
extension to Electron. The inspected fork base is `c848eca0018d6b3d909c942f085d5c787ca72a85`.
The browser Y.Doc remains the editing source of truth. The current ELPX export path is
`YjsProjectManagerMixin.exportToElpxViaYjs` → `YjsProjectBridge.exportToElpx` → shared
exporter → Electron `saveBuffer` or an HTML download link. It bypasses `WebFileSystem`.
A new adapter alone would not integrate direct save.

At that base, both editor preview iframes in `views/workarea/workarea.njk` allow scripts
and same-origin access. `previewPanel.js` serves generated content through `/viewer/*`
with the preview Service Worker, and also creates app-origin blob documents. Its
`injectHtmlToIframe` comment explicitly depends on popup opener access. The public
read-only isolation in `doc/architecture.md` §8.6 applies to a different server route;
it explicitly excludes the authoring preview. `ideviceNode.js:exportProcessIdeviceHtml`
also inserts author HTML into the editor DOM with `innerHTML`. These are separate
execution surfaces, not a single iframe setting.

The [File System Access permission model](https://wicg.github.io/file-system-access/#permissions)
and [persistent-permission documentation](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)
make a stored handle a reusable capability, subject to the browser's actual permission
state. Same-origin JavaScript can access the same IndexedDB databases. A private
variable, Worker, opaque registry name, random identifier, or required initial click
is not a new origin boundary.

## Problem

Can the existing editor origin safely retain reusable file write capabilities while
it runs imported executable content with that origin's authority? If not, what may
this change ship without misrepresenting direct Save as complete?

## Decision drivers

- Preserve user bytes and the current project on cancellation or failure.
- Prevent imported content from reaching persistent capabilities or a privileged writer.
- Preserve offline preview, embedded resources, navigation, custom content and Electron.
- Keep verified disk writes distinct from unacknowledged browser downloads.
- Account for old tabs, popups, installed PWAs and already executing content at the same origin.
- Report unmet acceptance criteria; do not replace isolation with an off-by-default flag.

## Options considered

### Store handles in the current editor origin

Small integration cost, but fails the trust requirement above. Web Locks and
SHA-256 conflict checks constrain cooperating writers; they do not authorize an
otherwise hostile same-origin caller. Rejected.

### Remove `allow-same-origin` from the two preview iframes

An opaque origin would restrict frame access, but does not isolate editor-side HTML,
previously opened windows, custom resources or historical same-origin tabs. The current
preview also relies on Service Worker control and relative resources. Removing the
token without replacing and testing that transport is not a compatible solution.
See [HTML iframe sandbox semantics](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
and the repository's §8.6 discussion. Rejected as a complete solution.

### Move capabilities to a genuinely separate trusted origin and isolate all author execution

This is a candidate follow-up architecture, not implemented here. It needs a trusted
user interaction surface, message/source/schema validation, an inert export boundary,
no arbitrary-byte write RPC exposed to educational frames, offline provisioning, a
migration plan for old contexts and full preview/resource compatibility tests. A new
hostname alone cannot make a compromised editor snapshot trustworthy. The static
single-origin deployment contract and Electron main/renderer contract need explicit
review. No deployment topology is silently required by this patch.

### Retain download/prompt behavior and fix failed-save transitions

Chosen for this blocked implementation. It does not provide direct Save or Save As.
It provides independently testable corrections and preserves the current fallback
without granting handles or introducing a privileged write channel.

## Evidence

- Source paths above at the recorded base; the audit and acceptance matrix live in
  [the change design](../changes/48-static-direct-file-save/design.md).
- `app/preload.js` declares `saveBufferAs(bufferData, projectKey, suggestedName)`.
  The old Electron adapter passed only two arguments. `DESKTOP-03` executes the actual
  preload source in a VM with a controlled IPC transport and checks byte and filename
  forwarding. This is not a native dialog test.
- `app/main.js:saveBufferWithDialog` returns `saved: false` **with** `filePath` on
  write errors. `DESKTOP-02` prevents that path from being mistaken for success.
- Before the fixes, the initial 19 `LEAVE-*` / `DESKTOP-*` regression cases failed;
  their observable oracles are unchanged location, unload guard, association API
  calls, window close and explicit native result. The design records final runs.
- Browser characterization is explicitly separate from security acceptance. No
  attack demonstration is described as a passing isolation gate.

## Decision

Do not acquire or persist user-visible file handles and do not enable silent
Electron overwrite in this change. There is no feature flag claiming to solve the
remaining security problem. Keep the PR in draft while direct-save requirements
and mandatory validation are incomplete.

Require an explicit successful receipt from the relevant existing save operation
before save-before-leave navigation. Cancelled, failed, missing and ambiguous
responses preserve the current project and its unload guard. A receipt from a
replaced bridge/session cannot authorize navigation or clean the replacement.
Browser downloads return `{ saved: false, downloaded: true }`, retain pending
state and tell users to verify the copy before explicitly discarding changes.
Existing native receipts remain native implementation acknowledgements; this patch
does not add readback verification or claim power-loss durability.

## Consequences

### Positive

- Cancellation/failure no longer intentionally authorizes closing or replacing a project.
- Browser downloads no longer masquerade as completed disk writes.
- No reusable disk authority is added to an origin with unresolved content execution.
- The actual Electron preload signature is covered, beyond a self-consistent adapter mock.

### Negative

- Direct Save/Save As remains unimplemented. Repeated static saves still download copies.
- Static users must check the downloaded copy and explicitly choose the discard/leave
  action to transition; the application cannot observe browser download completion.
- Existing export consistency, pending-import ownership and native write recovery
  limitations remain blockers for a later direct-save implementation.

### Neutral

- No ELPX format, backend API, Yjs transport, embedding protocol or dependency changes.
- No translation catalog edits or generated architecture index.
- Native save dialogs still appear. No releases, deployments or merge are performed.

## Risks

The existing exporter reads live document and resource state. This patch does not
establish an immutable revision/resource snapshot, per-file canonical identity,
per-session base hash, a recovery journal, atomic native replacement or post-commit
reconciliation. A native save acknowledgement still does not prove that edits made
during export were included. These limitations must not be hidden by the transition
fixes or by a green unit test run.

## Validation

See the change design for measured coverage, exact test commands/results, browser
engine/harness distinctions and all remaining acceptance work. Human architecture
acceptance is pending: `status: Proposed`, with the decision-maker explicitly unassigned and no recorded human reviewers.

## Follow-up work

First resolve the full author-content boundary and upgrade/migration contract. Then
implement the session/file identity and version model, immutable ELPX snapshot,
mandatory verified backups, commit journal, recovery UI and conflict-aware writer.
Only after their tests pass should menu/shortcut integration acquire capabilities.

## References

- [File System Access](https://wicg.github.io/file-system-access/)
- [File System Standard](https://fs.spec.whatwg.org/)
- [Chrome File System Access guide](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
- [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [createWritable](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable)
- [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
