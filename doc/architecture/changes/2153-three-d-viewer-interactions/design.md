---
tracking_issue: 2153
title: "3D Viewer interactions: hotspots, guided navigation and questions"
status: implemented
date: 2026-07-10
authors:
  - "@erseco"
reviewers:
  - "@erseco"
implementation_prs: [2157, 40]
related_adrs: [ADR-2147-01, ADR-2153-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
  notes: "TypeScript implementation section revised with claude-opus-5"
---

# 3D Viewer interactions: hotspots, guided navigation and questions — design

## Summary

This design adds an optional **interaction layer** to the existing `three-d-viewer`
iDevice: informational **hotspots (markers)** anchored to points on a 3D model,
optional **guided navigation** between markers, and lightweight **single-choice
questions** attached to markers. It works for both render paths the iDevice already
supports — GLB/GLTF via `<model-viewer>` and STL via the shared Three.js runtime — and
across every current context (editor, internal preview, server render, static HTML,
SCORM, offline/PWA). When interactions are disabled the iDevice behaves exactly as it
does today.

The design deliberately stays minimal. It reuses the versioned-state, normalization,
accessible-dialog and editor-list patterns already proven in the sibling
`three-sixty-viewer` iDevice, and the lightweight single-choice question concept
distilled from the `3dmol` iDevice — without importing panorama coordinate math or the
3Dmol game engine. It introduces **no new runtime dependency, no CDN asset, and no new
backend endpoint**. Drag-and-drop learning activities are explicitly out of scope.

## Problem statement

Issue [#2153](https://github.com/exelearning/exelearning/issues/2153) (author
@rmerinomartin-tech) requests that the 3D Viewer allow interactivity on the object
being viewed: markers/pins that explain specific parts, visual guidance while viewing,
and object-based assessment (Q&A). The concrete driving use case is a 3D model of the
Teide stratovolcano for 4th-year ESO Biology & Geology. Today the iDevice can only
display a model with camera/animation controls; it has no way to annotate points,
guide the learner, or ask questions.

## Goals

- Add markers by clicking directly on the model, in the editor preview, for GLB/GLTF **and** STL.
- Edit each marker: label, icon, action type and action-specific content.
- Associate informational content (rich HTML, image, video, link) with a marker.
- Associate a single-choice question with a marker, with immediate accessible feedback.
- Optional guided navigation (previous/next) through markers in author-defined order.
- Optionally capture and restore a camera view per marker.
- Full editor/preview/export parity: what the author previews is what learners see.
- Transparent, idempotent migration of existing (interaction-less) saved content.
- Never persist `blob:` URLs or runtime object references.
- Meet the eXeLearning accessibility bar (real buttons, dialogs, ARIA live, keyboard, fallback).
- Ship with unit + runtime + export + Playwright tests; patch coverage ≥ 90%.

## Non-goals

- Drag-and-drop interactions or arbitrary object-manipulation tasks.
- Full gamification: lives, timers, scores, leaderboards, itineraries, badges, branching tours.
- A 3Dmol-style quiz engine or SCORM score reporting for questions.
- Multiple models/scenes per iDevice (the 360 viewer's multi-scene "tour" concept is **not** copied).
- New backend endpoints or server-side storage for interactions.
- Runtime dependencies from a CDN; new export libraries.
- Animated-surface marker anchoring as a blocking requirement (best-effort only, see Risks).

## Current state

The `three-d-viewer` iDevice is a `component-type=json`, `api-version=3.0` device
(`public/files/perm/idevices/base/three-d-viewer/config.xml`, commit f3a32e774).

- **Edition** (`edition/three-d-viewer.js`): a singleton `$exeDevice` object literal.
  `DEFAULT_STATE` (lines 4-14) is a flat object `{src, alt, modelColor, backgroundColor,
  cameraControls, autoRotate, autoRotateSpeed, showNavControls, animation:{enabled,name,speed}}`
  with **no `version` field**. `set3DViewerJSON()` (line 363) is the single load/merge/coerce
  point; `get3DViewerJSON()` (line 428) is the single serialize point and already strips
  `blob:`; `save()` (line 815) validates then returns the JSON or `false`.
- **Export** (`export/three-d-viewer.js`): `$threedviewer.renderView(data, acc, template)`
  (line 1195) builds a `.three-d-viewer-wrapper[data-three-d]` with **flat `data-*` attributes**
  and a `<model-viewer>` deliberately emitted **without `src`** (STL would crash model-viewer;
  keeping `src` out of markup prevents `blob:` leakage). `renderBehaviour` (line 1304) reads the
  attributes back and boots the runtime. Asset `asset://` refs are rewritten to
  `content/resources/...` **externally** by `IdeviceRenderer.fixAssetUrls` /
  `BaseExporter.addFilenamesToAssetUrls` (`src/shared/export/exporters/BaseExporter.ts:756`).
- **Runtime** (`export/three-d-viewer-runtime.js`): installs the shared `window.eXe3DViewer`
  global (idempotent). `init/destroy/destroyAll/getInstance` plus pure helpers and test-only
  `__registry/__track`. Per-instance shell (`buildInstanceShell`, line 246) exposes
  `{scene, camera, renderer, canvas, mesh, controls, options, rafId, stopped, eventListeners[]}`.
  The STL mesh is **recentered and uniformly scaled** (`geometry.center()` + `scale = 2/maxDim`,
  lines 478-485), so marker coordinates are only meaningful in that **normalized model space**.
  `animate()` (line 523) is the single RAF loop; `destroy()` (line 289) disposes GPU + tracked
  listeners. It is loaded by **both** edition (STL preview) and export.
- **Sibling reuse sources**: `three-sixty-viewer` has `SCHEMA_VERSION=2`, `normalizeData`/
  `migrateToV2`/`normalizeHotspot`/`normalizeHotspotPayload`/`toNumber`/`clamp` (idempotent
  round-trip), an accessible content dialog (`_openContentModal`/`_trapFocus`/`_closeContentModal`,
  export lines 981-1128), and an editor hotspot list + placement mode + draggable markers — but
  all its **coordinate math is panorama yaw/pitch** and must be replaced, not copied. `3dmol` has a
  question data model + set-match validation + per-option screen-reader labels, but its answer
  controls are anchors with no `aria-live` and it drags in a heavy game engine — only the concept
  is reused.

## Proposed design

Introduce a **renderer-agnostic interaction layer** shared by editor and export, with two
thin **renderer adapters** for the two model paths. State and rendering split by concern:

```
                          src/shared  — schema v2, migration, sanitizer, scoring
                                   │  (ONE source; both bundles compile it in)
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
  src/edition/**              src/interactions/**        src/export/**
  (editor UI: enable,          InteractionController +    (renderView markup +
   add/edit/reorder markers,   accessible dialog +         JSON <script> data block +
   placement mode,             question renderer +         accessible fallback list +
   live preview)               guided nav + ARIA           guided-nav controls)
        │                          │                          │
        │                   src/adapters/**                   │
        │              model-viewer adapter | STL adapter      │
        │                          │                          │
        └──────────────── src/runtime/** (eXe3DViewer) ───────┘
                     registry, lifecycle, STL scene, loaders
                                   │
             ┌─────────────────────┴─────────────────────┐
      edition/three-d-viewer.js                  export/three-d-viewer.js
        (GENERATED IIFE, gitignored)              (GENERATED IIFE, gitignored)
```

- The interaction layer lives **once**, in `src/interactions/`, and is used by the editor preview
  and the exported page alike. This is the key structural advantage over the 360 viewer, which had
  to duplicate that logic because it has no shared runtime.
- **Schema normalization has one source** (`src/shared/schema.ts`) rather than mirrored copies:
  both bundles import it and the compiler inlines a copy into each generated IIFE. Duplicated
  bytes are fine; duplicated *maintained source* is not. There is therefore no `// mirror edition`
  convention and no drift to police.
- There is **no separate runtime JavaScript file**. `window.eXe3DViewer` is published by whichever
  bundle loads first (idempotently), so a page still has exactly one instance registry.
- **Renderer adapters** implement one small contract (see Technical design). The `<model-viewer>`
  adapter uses **native declarative hotspots** (`slot="hotspot-*"` + `data-position`/`data-normal`,
  placement via `positionAndNormalFromPoint()`); model-viewer handles projection + occlusion. The
  STL adapter raycasts against `instance.mesh`, parents an anchor `Object3D` to the mesh (so it
  inherits the center+scale transform), and reprojects to a DOM overlay each frame via a new
  per-frame hook, hiding occluded/off-screen markers.

## User experience

Editor (`Interactions` fieldset, **collapsed and disabled by default** so authors who only
display a model are unaffected):

```
3D Model
Display options
Animations
Interactions
    ▸ Enable interactions            (checkbox; everything below hidden until on)
      Guided navigation              (checkbox)
      Show marker labels             (checkbox)
      [ Add marker ]                 (enters placement mode)
      Marker list
        • Label · icon · action type · [Capture camera] · [▲][▼] · [Edit] · [✕]
```

Marker authoring flow:

1. Enable interactions → 2. Click **Add marker** → preview enters placement mode (crosshair
cursor, ARIA-announced) → 3. Click the model → 4. a marker is created at the picked surface
point (with normal) → 5. the **marker editor** opens (accessible dialog): label, icon, action
type (`information`/`image`/`video`/`link`/`question`), action fields, **Capture current camera**,
**Delete** → 6. Save → 7. preview updates immediately.

Learner (preview + export):

- Each marker renders as a real `<button>` overlaying the model with an accessible label.
- Activating a marker opens an accessible dialog (or navigates a link) with its content or question.
- With guided navigation on, `Previous`/`Next` controls step through markers in order (no wrap
  unless configured), announcing the active step via an ARIA live region and optionally restoring
  the marker's saved camera view.
- When WebGL/`model-viewer` is unavailable, a structured text fallback lists every marker
  (order, label, content, and question prompt/options).

## Technical design

Files changed (no new registered lib; all new code lives in already-loaded files, so **no export
registration edits are required** — confirmed by directory-recursion packaging in
`src/shared/export/providers/FileSystemResourceProvider.ts:93`):

The iDevice is a **TypeScript iDevice** ([ADR-2147-01](../adr/ADR-2147-01-typescript-idevices-build-convention.md)):
all maintained source lives under `src/`, and `edition/three-d-viewer.js` /
`export/three-d-viewer.js` are generated, gitignored bundles built by
`scripts/build-idevices.ts`. `config.xml` keeps loading those two filenames, so nothing about the
engine contract changes.

```text
public/files/perm/idevices/base/three-d-viewer/
├── config.xml                 # unchanged: loads the two GENERATED bundles
├── tsconfig.json              # strict, noUncheckedIndexedAccess, no `any`
├── src/
│   ├── globals.d.ts           # minimal slices of THREE, <model-viewer>, AssetManager, eXe
│   ├── shared/                # types, schema v2, migration, colours, urls, html, model-source, scoring
│   ├── runtime/               # registry, lifecycle, asset + path resolution, loaders, STL scene, eXe3DViewer
│   ├── interactions/          # controller, answer state, dialog, question, guided nav, fallback
│   ├── adapters/              # geometry + raycast maths, model-viewer adapter, STL adapter
│   ├── edition/               # $exeDevice: template, form, preview, marker list/editor, SCORM
│   ├── export/                # $threedviewer: renderer, bootstrap, per-wrapper controller, SCORM
│   └── test/                  # THREE / model-viewer stubs, helpers, fixtures, bundle contract
├── edition/three-d-viewer.css # hand-maintained
└── export/three-d-viewer.css  # hand-maintained
```

- `edition/three-d-viewer.css` + `export/three-d-viewer.css` carry the marker button, overlay
  layer, dialog, question and guided-nav styles (no inline styles).
- Colocated `*.spec.ts` files sit next to every module, plus bundle-contract tests over the
  compiled IIFEs and a Playwright spec.
- No new registered export lib: the vendored Three.js/model-viewer files already ship from
  `export/`, and directory-recursion packaging picks up the generated bundle
  (`src/shared/export/providers/FileSystemResourceProvider.ts:93`).

**Build and debugging**

```bash
bun run typecheck:idevices                             # tsc -p for every TypeScript iDevice
bun run bundle:idevices                                # build them all
bun run bundle:idevices:watch                          # rebuild on src/ changes
bun scripts/build-idevices.ts --only three-d-viewer    # just this one
bun scripts/build-idevices.ts --typecheck --only three-d-viewer
```

Bundles ship linked `.js.map` source maps so browser stack traces point back at the TypeScript;
`scripts/build-resource-bundles.js` keeps `.map` files out of the resource ZIPs and therefore out
of production exports. Run `make bundle` after editing `src/` and **before** E2E, or the preview
service worker serves the stale bundle from `public/bundles/idevices.zip`.

**Browser globals the bundles publish**

| Global | Published by | Used by |
|---|---|---|
| `window.$exeDevice` | edition | the workarea JSON-iDevice engine (`init`, `save`) |
| `window.$threedviewer` | export | the export engine (`renderView`, `renderBehaviour`) |
| `window.ThreeDViewerExportObject` | export | the engine's serialization helper |
| `window.eXe3DViewer` | both (idempotent, first wins) | STL scene lifecycle + interaction factory |

**Renderer adapter contract** (see [ADR-2153-01](../adr/ADR-2153-01-three-d-viewer-interaction-layer.md)):

```ts
interface MarkerAdapter {
    enterPlacementMode(onPlaced: (placement: MarkerPlacement) => void): void;
    exitPlacementMode(): void;
    renderMarkers(markers: readonly Marker[], options: MarkerRenderOptions): void;
    setActive(activeId: string): void;
    focusMarker(marker: Marker): void;      // apply marker.camera if present
    captureCamera(): MarkerCamera;          // opaque, adapter-defined
    updateOverlay(): void;                  // per-frame reprojection (STL); no-op for model-viewer
    destroy(): void;
}
```

`InteractionController` owns marker state, active-marker tracking, guided navigation, dialog and
question lifecycle, ARIA announcements, and the fallback list; it is renderer-agnostic and talks to
the model only through the adapter. It is created by both the editor (live preview, `'edit'` mode) and the
export runtime (`'view'` learner mode) via the single
`window.eXe3DViewer.createInteractionLayer(handle, state, mode, hooks)` factory. Learner answer
state lives on the controller keyed by marker id, so a question's attempt allowance applies for the
whole activity session rather than resetting each time its dialog is reopened.

## Data model

State is versioned with an explicit `schemaVersion`. Original, pre-interaction content carries no
version marker and is migrated straight to v2 by adding a disabled `interaction` block and a
default `scorm` block. Existing visual fields are unchanged.

```ts
{
  schemaVersion: 2,
  src: '', alt: '',
  modelColor: '#888888', backgroundColor: '#f5f5f5',
  cameraControls: true, autoRotate: true, autoRotateSpeed: 30, showNavControls: false,
  animation: { enabled: false, name: '', speed: 1 },
  interaction: {
    enabled: false,
    guidedMode: false,
    wrapNavigation: false,
    showMarkerLabels: true,
    activeMarkerId: '',
    markers: []            // ordered
  },
  scorm: { mode: 0, weighted: 100, saveButtonText: '' }
}
```

SCORM configuration has **one canonical home** — the nested `scorm` block. The shared gamification
framework speaks a flatter dialect (`isScorm`, `weighted`, `textButtonScorm`); `normalizeScorm()`
is the single place the two vocabularies meet, in both directions.

Marker (renderer-independent):

```js
{
  id: 'marker-<base36>', label: '', description: '', icon: 'circle', order: 0,
  anchor: {
    position: { x: 0, y: 0, z: 0 },   // STL: normalized model space; GLB: model space
    normal:   { x: 0, y: 1, z: 0 },
    surface: ''                        // optional model-viewer surface reference (best-effort)
  },
  camera: { orbit: '', target: '', fieldOfView: '' },  // opaque, adapter-defined; '' = none
  action: { type: 'information', payload: { /* per type */ } }
}
```

Action payloads by `type`:

- `information` → `{ html: '' }` (sanitized rich HTML)
- `image` → `{ src: '', alt: '', caption: '' }`
- `video` → `{ src: '', poster: '' }`
- `link` → `{ url: '', newTab: true }`
- `question` → single-choice:

```js
{
  prompt: '', type: 'single-choice',
  options: [ { id: 'option-<base36>', text: '', correct: false } ],
  feedbackCorrect: '', feedbackIncorrect: '', attemptsAllowed: 0   // 0 = unlimited
}
```

All nested values are normalized: strings coerced/escaped, numbers via `toNumber`+`clamp`, enums
validated against allowlists, ids generated when missing, `blob:`/`data:` stripped from persisted
media, exactly one option may be `correct` (first wins on conflict). Normalization is **idempotent**
(`load(save(x)) === save(x)`).

## Migration and compatibility

Exactly three transitions exist, and `hydrateDocument()` is the only entry point:

| Input | Result |
|---|---|
| original unversioned 3D Viewer state | `{ status: 'ok' }` — migrated to schema v2 |
| schema v2 | `{ status: 'ok' }` — normalized schema v2 |
| `schemaVersion > 2` | `{ status: 'unsupported-version' }` — the original is preserved |
| anything that is not an object | `{ status: 'invalid' }` — the original is preserved |

- Migration branches on **data shape and `schemaVersion`**, never on `config.xml <version>`
  (informational only, `doc/elpx-format/idevices/config-xml.md:31`).
- Persisted data is parsed as `unknown` and validated; it is never cast to the document type.
- A document from a newer schema is **not opened and then overwritten**: the editor shows a notice
  instead of the form, and `save()` returns the original object untouched.
- There is deliberately **no migration for intermediate development shapes**. The interaction
  feature has never been released, so v2 is the only version that has ever been published.
- Existing visual options are preserved; a legacy project renders identically, with a disabled and
  empty interaction layer.
- Normalization is idempotent and tolerant of malformed nested values (never throws, never drops a
  valid `src`).
- Runtime-only fields (`blob:` URLs, object refs) are never serialized.
- Older exported HTML keeps working: the JSON data block is additive; absent block ⇒ interactions off.

## Security and privacy

- Escape every attribute interpolation (`escapeAttr`) and prefer `textContent` over `innerHTML`.
- Rich-text (`information`) content is sanitized through the shared DOM-based `sanitizeHtml` used by
  the slide iDevice — **no regex HTML scrubbing** (re-triggers CodeQL, is bypassable; repo memory
  `sanitizeHtml DOM fallback`).
- The JSON `<script type="application/json">` block escapes `<` to `<` to prevent `</script>`
  breakout; it is parsed with `JSON.parse` inside `try/catch`.
- Links: validate URL scheme; `target="_blank"` always paired with `rel="noopener noreferrer"`.
- No `eval`, no dynamic code execution, no inline event handlers, no scripts from marker content.
- `blob:`/`data:` URLs are stripped before persistence, matching `get3DViewerJSON`'s existing guard.

## Accessibility

- Viewer region has an accessible name (existing `aria-label` from `alt`).
- Each marker is a real `<button>` with a meaningful accessible label (`label`, falling back to
  "Marker N"); decorative icons are `aria-hidden`.
- Marker dialog: `role="dialog"`, `aria-modal="true"`, focus moved in on open, focus trap, `Escape`
  closes, focus returns to the originating marker button (reuses the 360 dialog pattern).
- Guided nav buttons expose `disabled` state at the ends; the active step is announced via an
  `aria-live="polite"` region.
- Questions use native `<fieldset><legend>` + `<input type="radio">` + `<label>`; a check button;
  feedback rendered into an `aria-live` region (improvement over 3Dmol, which had none).
- Correctness never conveyed by colour alone (text feedback + icon).
- Non-WebGL fallback: a structured `<ul>` of marker order/label/content and question prompt/options.

## Internationalization

- Editor chrome uses `_()`. Learner-facing default/baked strings (e.g. "Marker", "Previous",
  "Next", "Check", fallback headings) use `c_()`. No hardcoded English.
- **No changes under `translations/`**; no `make translations`. New keys are only wrapped in source.

## Performance

- One RAF loop remains (the existing `animate()`); the STL overlay reprojection is an added
  `onFrame` callback, O(markers) per frame with markers typically < 30. `model-viewer` hotspots are
  native and cost nothing extra.
- No new network requests; libraries are unchanged and already local.
- Marker overlays and anchors are disposed in `destroy()`; no duplicate RAF loops or leaked listeners.

## Testing strategy

- **Unit (Vitest/happy-dom, colocated `src/**/*.spec.ts`)**: normalization, migration (legacy → v2,
  future-version rejection, idempotent round-trip), invalid/malformed data,
  anchor/camera/action/question normalization, deterministic id generation through an injected id
  factory, ordering/reorder, single-choice grading, JSON block serialize/parse (incl. `</script>`
  escaping and no `blob:`), accessible-label construction, and the pure STL projection/occlusion
  maths against a small deterministic `THREE` stub. Because the sources are real ES modules, v8 can
  instrument them: `vitest.config.mts` includes
  `public/files/perm/idevices/base/*/src/**/*.ts` in coverage and excludes the generated bundles,
  the test doubles and the two entry points.
- **Generated-bundle contract** (`src/test/bundle-contract.spec.ts`): evaluates the ACTUAL compiled
  IIFEs as classic scripts and asserts the four window globals, that neither bundle carries
  top-level `import`/`export`/`require(`, that source maps are linked rather than inlined, that a
  schema-v2 document renders end to end through the export bundle, and that the two bundles share
  one `eXe3DViewer` rather than replacing each other.
- **Runtime and interactions**: registry lifecycle and teardown, multiple-instance isolation,
  marker overlay markup, active-marker state, dialog open/close + focus trap + focus return,
  Escape, guided prev/next with and without wrapping, question feedback, **attempts surviving a
  dialog reopen**, fallback rendering, listener cleanup.
- **Export**: markers reach the exported JSON block; `asset://` survives for the export rewriter;
  **no `blob:`**; legacy state exports without interactions; attributes escaped; fallback present;
  SCORM registration and score reporting.
- **Playwright** (`test/e2e/playwright/specs/idevices/three-d-viewer-interactions.spec.ts`): GLB flow
  — add viewer, enable interactions, add informational marker, add two question markers, enable
  guided mode, save, reopen, assert persistence, open preview (direct `#head-bottom-preview` click,
  wait for `article`), assert accessible labels and guided controls, answer the question, and
  confirm both a resolved question and a spent attempt allowance survive closing and reopening the
  dialog. A second spec asserts interaction-free content exports unchanged. STL: the raycasting
  adapter is unit-tested with a stub; the E2E spec asserts the WebGL-independent guarantees. Run
  `make test-e2e-static` (export/preview affected).

## Rollout plan

Single feature branch `2153-3d-viewer-edevice`, small logical commits: (1) schema + migration +
tests; (2) runtime interaction layer + adapters + tests; (3) editor UI + tests; (4) export markup +
fallback + tests; (5) CSS; (6) Playwright + docs. No feature flag needed — the feature is inert
until an author enables it.

## Risks and mitigations

- **STL occlusion / reprojection correctness** under rotation, resize, fullscreen, auto-rotate →
  drive reprojection from the shared RAF `onFrame`; hide markers with `NDC.z ≥ 1` or occluded by a
  camera→point raycast; add resize handling. Covered by pure-math unit tests + E2E smoke.
- **Animated GLB surface anchoring** may drift on skinned meshes → store position+normal anchors as
  the reliable default; use `model-viewer` `surface` only when available; document the limitation;
  never block the base feature.
- **Duplication drift** between edition and export → eliminated by construction: the schema and the
  behavioural layer have one TypeScript source that both bundles compile in. Duplicated *bytes* in
  the two generated IIFEs are accepted; duplicated maintained source is not.
- **Stale generated bundles** during development or E2E → `build:all` (and therefore `make bundle`)
  runs `typecheck:idevices` + `bundle:idevices` before `bundle:resources`, and the E2E workflow
  uploads both generated bundles as artifacts because the runners get a fresh checkout.
- **Round-trip data loss** (the #1 iDevice bug) → mandatory `load(save(x))` test for every field.

## Open questions

- Icon set: start with a small fixed allowlist (`circle`, `pin`, `info`, `question`, `star`) rendered
  as CSS/SVG glyphs; extensible later.
- Whether `description` and `information` `payload.html` should merge — kept separate per the issue
  prompt schema; `description` is an optional dialog subtitle.

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Renderer-adapter abstraction + shared-runtime interaction layer vs per-path duplication | ADR-2153-01 | Proposed |
| Mirror `normalize*` in edition/export (follow 360 convention) rather than a new shared lib | ADR-2153-01 | Proposed |
| Serialize interaction state as a JSON `<script>` block, not flat `data-*` | ADR-2153-01 | Proposed |

## Evidence

- Issue #2153 (feature request, scope).
- `public/files/perm/idevices/base/three-d-viewer/**` @ f3a32e774 (current schema, render paths, runtime, disposal).
- `public/files/perm/idevices/base/three-sixty-viewer/export/three-sixty-viewer.js:81,348,946-1128` (versioned normalize, JSON data script, accessible dialog).
- `public/files/perm/idevices/base/3dmol/export/3dmol.js:333,2010-2054` (question option labels, set-match validation).
- `src/shared/export/exporters/BaseExporter.ts:756,840`, `renderers/IdeviceRenderer.ts:304`, `providers/FileSystemResourceProvider.ts:93` (asset rewriting; directory-recursion packaging → no registration edits).
- `public/app/yjs/AssetManager.js:617` (`asset://` scheme; `blob:` never persisted).
- `vitest.config.mts:15,38,103`; `public/vitest.setup.js:811` (test env, coverage exclude, `loadIdevice`).
- `test/e2e/playwright/specs/idevices/three-d-viewer.spec.ts:713` (preview-open pattern); `test/fixtures/{sample-model.glb,Duck.glb,ascii-cube.stl}` (fixtures).

## Acceptance criteria

- [ ] Existing 3D Viewer behaviour is unchanged when interactions are disabled.
- [ ] GLB/GLTF informational markers work; STL informational markers work; markers stay attached during camera movement.
- [ ] Marker content is editable and persists across save/reopen (round-trip).
- [ ] Single-choice questions work with accessible immediate feedback and attempt limiting.
- [ ] Guided previous/next navigation works and is keyboard accessible with ARIA live announcements.
- [ ] Camera views can be captured per marker and restored on focus.
- [ ] Editor preview and exported runtime behave consistently.
- [ ] Legacy data migrates transparently and idempotently.
- [ ] No `blob:` URL and no runtime object reference is ever persisted.
- [ ] Accessibility requirements (buttons, dialog focus, ARIA live, fallback list) satisfied.
- [ ] WebGL + DOM resources cleaned up (no leaks, no duplicate RAF).
- [ ] Unit + runtime + export + Playwright tests pass; `make fix` clean; patch coverage ≥ 90%.
- [ ] No drag-and-drop learning activity introduced.

## Implementation checklist

- [x] Schema v2 + migration in `src/shared/` (one source) + unit tests.
- [x] `InteractionController` + adapters + dialog + question + guided nav + hooks + tests.
- [x] Editor UI (enable, add/edit/reorder, placement, marker editor, live preview) + tests.
- [x] Export markup (JSON block, fallback list, nav controls) + tests.
- [x] CSS (edition + export).
- [x] TypeScript build convention ([ADR-2147-01](../adr/ADR-2147-01-typescript-idevices-build-convention.md)):
      `src/` sources, generated bundles gitignored, bundle-contract tests.
- [x] Playwright spec + `make test-e2e` / `make test-e2e-static`.
- [x] ADR-2153-01; records index updates. `config.xml` unchanged — the generated bundles keep the
      existing filenames.

## References

- Issue: https://github.com/exelearning/exelearning/issues/2153
- [ADR-2153-01](../adr/ADR-2153-01-three-d-viewer-interaction-layer.md) (this feature's durable decisions).
- [ADR-2147-01](../adr/ADR-2147-01-typescript-idevices-build-convention.md) and
  [doc/development/idevices-typescript.md](../../development/idevices-typescript.md) (the build
  convention this iDevice follows).
- `doc/elpx-format/idevices/patterns.md` (Pattern 1: JSON iDevice), `config-xml.md`.
- Repo memory: `E2E preview-open gotcha`, `sanitizeHtml DOM fallback`, `Export lib registration sites`.
