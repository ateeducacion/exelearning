# Developer Tools — Style Lab, iDevice Lab and REST API

> **Production safety**: every developer tool described here is gated by
> `APP_ENV=dev`. In production builds the menu is not rendered, the routes
> return `404 Not Found`, and the bundled JavaScript is unreferenced. Do
> not rely on the labs for production behavior — they are debugging
> surfaces designed for developers, automated Playwright tests and AI
> coding agents.

## Overview

The Developer menu adds three entries to the workarea navbar:

| Entry        | URL                            | Purpose                                                 |
|--------------|--------------------------------|---------------------------------------------------------|
| Style Lab    | `/developer/style-lab`         | Test eXeLearning themes against export targets/viewports |
| iDevice Lab  | `/developer/idevice-lab`       | Exercise an iDevice through its edit → save → export    |
| REST API     | `/api/v1/docs`                 | Swagger UI for the REST API (relocated from Help)        |

## Enabling the Developer menu

Add `APP_ENV=dev` to your `.env` (or export it in the shell) before
starting the backend:

```bash
APP_ENV=dev make up-local
```

Optional override for non-dev environments where the labs need to be
exposed (staging, demo deployments):

```bash
DEV_TOOLS_ENABLED=1
```

`DEV_TOOLS_ENABLED` accepts `1`, `true`, `yes`, `on` (case-insensitive).
Production deployments should leave both variables unset.

## Architecture

The labs are built on a small shared kernel at
[`public/app/workarea/developer/shared/`](../../public/app/workarea/developer/shared/):

| Module                    | Responsibility                                              |
|---------------------------|-------------------------------------------------------------|
| `DeveloperUrlState`       | Serialize/deserialize lab state via URL parameters          |
| `ViewportManager`         | Apply desktop/tablet/mobile presets to a preview iframe     |
| `FixtureRegistry`         | Manifest-driven fixture lookup with strict ID sanitization  |
| `ExportPresetManager`     | Toggle bundles for export-option presets                    |
| `DeveloperStatusReporter` | Human/Playwright/AI-readable status + state JSON            |
| `RoundtripValidator`      | Run the save → load → save cycle and diff the snapshots     |

The shared kernel deliberately does not depend on iDevice or export
internals. The labs inject their own sandboxes/adapters at runtime so
the kernel stays portable.

## Deterministic URL state

Both labs honor URL parameters and write them back as you interact.
Examples — these URLs can be opened directly by Playwright, AI agents
or humans:

```
/developer/style-lab?fixture=leer-para-aprender&themeSource=base&theme=modern&export=scorm12&viewport=mobile

/developer/idevice-lab?idevice=rubric&sample=basic-score&export=scorm12&viewport=desktop
```

Parameter rules:

* IDs must match `^[A-Za-z0-9_-]{1,64}$`. Anything else is silently dropped.
* `viewport` ∈ {`desktop`, `tablet`, `mobile`}.
* `export` ∈ {`website`, `single-page`, `scorm12`, `scorm2004`, `ims`, `epub3`}.
  Only targets that are actually wired are exposed in the UI; the rest fall back.
* `themeSource` ∈ {`base`, `site`, `user`}.

Invalid values are replaced with safe defaults — they never reach the
filesystem.

## Machine-readable state

Each lab embeds a JSON `<script>` element so automation can read the
current state in a single `evaluate` call:

```html
<script type="application/json" id="developer-style-lab-state" data-testid="developer-style-lab-state">
{"fixture":"leer-para-aprender","viewport":"mobile","status":"ready"}
</script>
```

The `data-status` attribute on the status node mirrors the same value
so Playwright can wait without parsing JSON:

```ts
await page.waitForFunction(
    () => document.querySelector('[data-testid="developer-style-lab-status"]')?.getAttribute('data-status') === 'ready',
);
```

## Fixtures

The Style Lab consumes a manifest at
[`public/app/workarea/developer/style-lab/fixtures.manifest.json`](../../public/app/workarea/developer/style-lab/fixtures.manifest.json).
The iDevice Lab consumes
[`public/app/workarea/developer/idevice-lab/samples.manifest.json`](../../public/app/workarea/developer/idevice-lab/samples.manifest.json).

Reusable fixtures from
[`exelearning/exelearning-style-designer`](https://github.com/exelearning/exelearning-style-designer)
are welcome — the owner has explicitly authorized reuse. When adding a
Style-Designer-sourced fixture, set `"source": "exelearning-style-designer"`
in the manifest entry.

Fixtures live under [`test/fixtures/style-lab/`](../../test/fixtures/style-lab/)
and `test/fixtures/idevices/<idevice>/`.

## Theme sources

The Style Lab understands the three official theme types:

| Source | Where it lives                         | Reload-from-disk supported |
|--------|----------------------------------------|----------------------------|
| Base   | `public/files/perm/themes/base/`       | Yes                        |
| Site   | `FILES_DIR/themes/site/`               | Yes                        |
| User   | Client IndexedDB + Yjs (browser-only)  | No (reports unsupported)   |

User themes are never served from the backend; the lab respects the
existing client-side storage model.

## Roundtrip validation

The iDevice Lab's "Validate save/load roundtrip" button drives the
`RoundtripValidator`:

1. Take initial data (the selected sample, or `{}` for a blank instance).
2. `loadData(initial)` → `save()` → snapshot A.
3. `loadData(snapshot A)` → `save()` → snapshot B.
4. Diff A vs B. Any lost, added, or mutated field becomes a structured
   report.

The result is mirrored to:

* the **Roundtrip** tab (formatted JSON)
* `data-status` on `[data-testid="developer-idevice-lab-roundtrip-status"]`
  (`passed` | `failed` | `error`)
* the `roundtrip` key inside the machine-readable state JSON

## SCORM debug panel — limitations

The SCORM debug tab is labeled clearly in the UI:

> **Simulator only.** The SCORM panel is a developer simulator, not a
> full LMS runtime. Always verify SCORM behavior in a real LMS before
> release.

Score/completion/success values are pulled from the iDevice's serialized
state via an adapter pattern. iDevices without an adapter show "Not
supported" rather than fake data.

## Automation surface

Stable `data-testid` attributes:

```text
Menu
  developer-menu
  developer-menu-style-lab
  developer-menu-idevice-lab
  developer-menu-rest-api

Style Lab
  developer-style-lab-root
  developer-style-lab-fixture-select
  developer-style-lab-theme-source-select
  developer-style-lab-theme-select
  developer-style-lab-export-target-select
  developer-style-lab-viewport-select
  developer-style-lab-viewport-desktop / -tablet / -mobile
  developer-style-lab-export-options-panel
  developer-style-lab-preview-frame
  developer-style-lab-reload-theme
  developer-style-lab-status
  developer-style-lab-error
  developer-style-lab-state

iDevice Lab
  developer-idevice-lab-root
  developer-idevice-lab-idevice-select
  developer-idevice-lab-sample-select
  developer-idevice-lab-theme-source-select
  developer-idevice-lab-theme-select
  developer-idevice-lab-export-target-select
  developer-idevice-lab-viewport-select
  developer-idevice-lab-tab-edition / -saved / -export / -roundtrip / -scorm
  developer-idevice-lab-edition-view
  developer-idevice-lab-saved-state
  developer-idevice-lab-copy-state
  developer-idevice-lab-export-view
  developer-idevice-lab-run-roundtrip
  developer-idevice-lab-roundtrip-result
  developer-idevice-lab-roundtrip-status
  developer-idevice-lab-scorm-panel
  developer-idevice-lab-status
  developer-idevice-lab-state
```

## AI agent recipes

### Style visual check

```
1. GET /developer/style-lab?fixture=leer-para-aprender&themeSource=base&theme=modern&export=website&viewport=mobile
2. Wait for [data-testid="developer-style-lab-status"][data-status="ready"]
3. Screenshot [data-testid="developer-style-lab-preview-frame"]
4. Diff against the baseline image
```

### Style reload-from-disk check

```
1. Edit public/files/perm/themes/base/<theme>/style.css
2. Open /developer/style-lab?themeSource=base&theme=<theme>
3. Click [data-testid="developer-style-lab-reload-theme"]
4. Wait for reloadToken in the state JSON to change
```

### iDevice roundtrip check

```
1. GET /developer/idevice-lab?idevice=rubric&sample=basic-score
2. Wait for [data-testid="developer-idevice-lab-status"][data-status="ready"]
3. Click [data-testid="developer-idevice-lab-run-roundtrip"]
4. Read roundtrip.status from the state JSON; expect "passed"
```

## Known limitations / follow-up work

This is the initial scaffold. Items not yet wired to real production
infrastructure:

* Style Lab preview iframe is currently a placeholder. Wiring it to the
  existing `Html5Exporter.generateForPreview()` + Service Worker pipeline
  (see [`public/preview-sw.js`](../../public/preview-sw.js)) is the next
  step.
* iDevice Lab edition/export views render their containers but do not
  yet mount real iDevice modules. The Sandbox interface in
  `RoundtripValidator.run()` is the integration point.
* SCORM debug adapters: only the simulator scaffold exists; per-iDevice
  adapters need to be added one at a time, starting with the rubric.
* `Reload style from disk` is a state token + status broadcast today;
  the actual filesystem reload for Base/Site themes lives behind a
  follow-up backend endpoint.

When extending the labs, prefer reusing the existing preview/export
pipeline (`SharedExporters`, `DeveloperPreviewManager`) over building a
parallel renderer.
