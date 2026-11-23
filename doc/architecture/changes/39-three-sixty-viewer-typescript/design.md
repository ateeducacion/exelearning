---
tracking_issue: 39
title: "360° Viewer iDevice: TypeScript refactor on the centralized build convention"
status: implemented
date: 2026-07-30
authors:
  - "@erseco"
reviewers: []
implementation_prs: [39]
related_adrs: [ADR-2147-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude"
---

# 360° Viewer iDevice: TypeScript refactor on the centralized build convention — design

## Summary

The 360° Viewer (`public/files/perm/idevices/base/three-sixty-viewer/`) moves
its maintained source from two hand-written classic scripts
(`edition/three-sixty-viewer.js`, `export/three-sixty-viewer.js`) to a typed,
modular `src/` tree compiled by the centralized TypeScript-iDevice build
([ADR-2147-01](../../adr/ADR-2147-01-typescript-idevices-build-convention.md)).
The generic conventions — discovery, bundling, typecheck, testing, gitignored
bundles — are documented in
[doc/development/idevices-typescript.md](../../../development/idevices-typescript.md);
this record covers only what is specific to the 360° Viewer.

## Source architecture

```text
src/
├── globals.d.ts        # THREE / eXeLearning / _ ambient declarations
├── shared/             # pure, DOM-free logic used by BOTH bundles
│   ├── types.ts        # v1/v2 document model, hotspot-action union
│   ├── schema.ts       # hydrateDocument / serializeDocument
│   ├── migration.ts    # v1 → v2 lift
│   ├── normalization.ts# idempotent v2 normalization + defaults
│   ├── hotspot-actions.ts # per-action normalize/serialize/validate/repair
│   ├── geometry.ts     # yaw/pitch ↔ direction, letterbox math, NDC
│   ├── ids.ts, urls.ts, html.ts
├── viewer/             # browser layer shared by preview and runtime
│   ├── panorama-renderer.ts, flat-image-renderer.ts, hotspot-renderer.ts
│   ├── scene-controller.ts, controls.ts, lifecycle.ts, assets.ts, types.ts
├── edition/            # window.$exeDevice (editor)
│   ├── index.ts, device.ts, editor.ts, state.ts, form.ts
│   ├── scene-list.ts, scene-editor.ts, hotspot-list.ts, hotspot-editor.ts
│   ├── hotspot-placement.ts, preview.ts, asset-picker.ts, three-loader.ts
├── export/             # window.$threesixtyviewer (learner runtime)
│   ├── index.ts, runtime.ts, renderer.ts, instance.ts, modal.ts, actions.ts
└── test/               # THREE mock harness, bundle-contract, fixtures
```

Before the refactor, edition and export each carried a full copy of the state
normalization and letterbox geometry ("mirror edition/three-sixty-viewer.js"
comments in the legacy bundles). `src/shared/` is now the single source of
truth for both.

## Persisted formats and compatibility

- **v1** (original single-image shape: top-level `src`, `alt`, `initialView`,
  `autorotate`, `zoomEnabled`, `fullscreenEnabled`, `showNavControls`) is
  never written any more but remains readable; `hydrateDocument()` lifts it
  into a one-scene v2 tour with nothing lost. Detection mirrors the legacy
  checks exactly.
- **v2** (`version: 2`, `ideviceId`, `startSceneId`, `scenes[]`, `behaviour`)
  is unchanged by this refactor: same property names, same ranges, same enum
  values, same hotspot actions (`goToScene`, `text`, `image`, `video`,
  `link`). The persisted `version` property stays `version: 2`.
- **Future versions** (`version > 2`) are rejected explicitly
  (`status: 'unsupported-version'`): the editor shows a notice and `save()`
  returns the ORIGINAL payload untouched; the runtime renders an accessible
  notice. Unknown hotspot ACTION types inside a v2 document are preserved as
  `{ type: 'unsupported', originalType, originalPayload }` in memory and
  serialized back verbatim — opening and saving old or future content never
  destroys data.

## Runtime contracts

- `edition/three-sixty-viewer.js` (generated) assigns
  `globalThis.$exeDevice` on every evaluation — the workarea re-runs the
  script for each edit session. Contract: `init(element, previousData,
  idevicePath)`, `save(): document | false`, `destroy()`.
- `export/three-sixty-viewer.js` (generated) assigns
  `globalThis.$threesixtyviewer` with the JSON-iDevice engine API
  (`renderView` / `renderBehaviour` / `init`) used by
  `public/app/common/exe_export.js`.
- three.js and OrbitControls stay EXTERNAL vendored files
  (`export/three.min.js`, `export/OrbitControls.js`, declared in
  `config.xml`'s `<export-js>`). Neither bundle inlines them; the bundles
  only dereference `THREE` when a viewer is actually built
  (`renderBehaviour()` / preview construction), so bundle evaluation order
  relative to the vendor scripts is not critical, and the editor lazy-loads
  them (`edition/three-loader.ts`) for its preview. This is asserted by the
  bundle-contract tests.

## Lifecycle

Every runtime viewer is one instance in a `WeakMap`-backed registry keyed by
its wrapper element. An instance owns its scene controller, panorama/flat
renderers, hotspot layer, nav/fullscreen controls, animation frame, resize
observer, drag blockers and modal; `destroy()` releases all of them (LIFO
disposer bag) and re-rendering a node disposes its predecessor first.
Multiple viewers per page never share state. The editor mirrors the same
pattern: one Editor per `init()`, destroyed on re-init.

The export bundle binds `pagehide` (not `beforeunload`) so SCORM 1.2 packages
stay eligible for the back/forward cache. A persisted `pagehide` leaves
WebGL contexts intact; a real teardown calls `destroyAll()`.

## Hotspot placement

Direct placement is an additional authoring path next to list-based creation:
an explicit "Place hotspot by clicking" toggle (`aria-pressed`, visible hint,
aria-live announcements, Escape cancels), then one click on the preview.
Equirectangular scenes unproject the click through the camera to yaw/pitch
(`shared/geometry.ts` + `viewer/panorama-renderer.ts`); flat scenes convert
the click to percentages of the `object-fit: contain` rectangle, and clicks
on letterbox bars are ignored rather than snapped to an edge. Numeric fields
remain available for precise adjustment. Deleting a scene referenced by
`goToScene` hotspots asks for confirmation, states how many hotspots are
affected, and clears their targets deterministically (flagged inline until
retargeted).

## Testing

- Colocated `*.spec.ts` (Vitest, happy-dom) next to every module; three.js is
  injected as a structural mock (`src/test/helpers.ts`), frames are stepped
  manually.
- `src/test/bundle-contract.spec.ts` evaluates the real generated IIFEs and
  asserts the window globals and their public APIs.
- `test/e2e/playwright/specs/idevices/three-sixty-viewer.spec.ts` covers the
  authoring flows (scenes, hotspots, placement, persistence) and the bundle
  contracts in a real browser.
- Fixtures for v1, v2, future-version and invalid payloads live in
  `src/test/fixtures/`.

## ADRs required or referenced

- [ADR-2147-01](../../adr/ADR-2147-01-typescript-idevices-build-convention.md) —
  TypeScript iDevices build convention (reused, no new durable decision
  introduced by this refactor).
