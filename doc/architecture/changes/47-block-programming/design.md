---
tracking_issue: 47
title: "Block Programming programming assignments"
status: in-review
date: 2026-10-24
authors:
  - "@erseco"
reviewers: []
implementation_prs: [47]
related_adrs:
  - ADR-47-01
  - ADR-47-02
  - ADR-47-03
supersedes: []
superseded_by: []
ai_assistance:
  tool: "OpenAI Codex"
  model: "GPT-6"
---

# Block Programming programming assignments — design

## Current state

The fork at c848eca0 discovers native iDevices from config.xml and supports JSON-backed edition, rendered HTML, shared exporter resources and native component identity. The existing SCORM 1.2 registry and common gamification helpers already own weighting, outcome aggregation, completion policy, commits and suspend-data serialization. Slide demonstrates separate edition bundles; EditionLifecycle owns edition resources.

## Technical design

One iDevice lives at `public/files/perm/idevices/base/block-programming/`. `model.ts` contains the pure validated configuration, workspace projection, deterministic interpreter and declarative assessment. `blocks.ts` registers only supported custom blocks through Blockly's public APIs. `player.ts` supplies an SVG stage, workspace, accessible controls, cancellable execution, feedback and the shared reporting adapter. `index.ts` implements native renderView/renderBehaviour/init and player disposal. `editor.ts` provides labelled teacher forms, sequence rows, block restrictions, starter editing and a student preview. It reuses the native iDevice tabs for Activity, Programming, Assessment and Preview, augments their keyboard/ARIA semantics locally, resizes Blockly when its panel becomes visible and releases the preview when the author leaves its tab. Unsaved configuration and the starter workspace stay alive across tab changes. `edition.ts` bridges the native init/save contract and lifecycle.

The published Blockly core and English messages precede the normal minified learner code. A separate edition bundle reuses that core and the runtime authoring bridge. The config explicitly loads shared export resources before edition. The build runs before resource ZIP generation, uses standard Bun APIs, copies local UI media and the original license, and adds no imports to the main application bundle. Native exporters copy only export resources. No application model, database, backend API or SCORM wrapper changes are needed.

## Data model

Version 1 JSON stores title, instructions, objective, hints/feedback, challenge kind, starting coordinates, destination coordinates, an expected numeric variable, a short observable sequence, the block allowlist, a serialized starter workspace, graded flag, weight, passing threshold and attempt policy. The native JSON properties are authoritative; derived HTML embeds a safely encoded copy for offline initialization. Unknown properties and executable workspace metadata are discarded by validation. A single connected start stack is required for execution. Native component IDs identify activities; Blockly block IDs can be regenerated without losing program meaning.

## Migration and compatibility

This adds a new iDevice type without migrating existing projects or changing their schema. Its public name is Block Programming; its canonical native identifier, directory and resource names are `block-programming`. The version 1 configuration schema, Blockly block schema and authored titles are unchanged. The earlier draft identifier `mini-scratch` is retired without automatic migration; draft iDevices using it must be recreated. Already-exported standalone packages retain their packaged runtime. Its original multicolor SVG icon does not reuse third-party logos. Version 1 configuration is validated on authoring and learner initialization; malformed imported data produces a visible error and is preserved for recovery. Offline packages include all required editor assets using existing exporters. Older eXeLearning versions without the Block Programming resources cannot edit this new type; exported HTML remains self-contained. SCORM 1.2 is the only graded export target in scope.

## Security and privacy

Only fixed operations are interpreted. No eval, Function constructor, user JavaScript, external services or new endpoints are used. Input size, block count/depth, numeric ranges, repetition counts, total work and elapsed time are bounded. Every statement yields. Messages and feedback are text. Player state is instance-owned; edition disposal follows the existing lifecycle. The public-view sandbox is untouched. Assessment and attempt limits remain inspectable and tamperable. Programs are never uploaded to teachers.

## Accessibility

Use native labelled forms/buttons, visible focus, text feedback/readout, polite result announcements, responsive layout and no color-only verdicts. Blockly 13 provides built-in keyboard navigation. Keep the documented shortcuts visible. Full screen-reader/touch interoperability and WCAG 2.2 AA certification require manual review and are not claimed by automated tests.

## Internationalization

All eXeLearning-owned strings use English source text through `_()` or `c_()`. No translation extraction or catalog changes are included. Blockly's English system messages are packaged locally; additional Blockly locales are future work.

## Performance

The selected packaging and alternatives are measured by `bun run bundle:block-programming --measure`; current numbers and reproduction details are in the iDevice README. The incremental learner resource budget is below 300 KiB Gzip. Assets are shared per type and only included on pages using Block Programming. No game engine, generators, plugin ecosystem or custom compiler is bundled.

## Testing strategy

The model tests cover all operations, validation failures, deterministic alternative solutions and safety limits. Player tests cover practice/submission separation, partial credit, retries, saved outcomes, multiple independent activities, cancellation, reporting errors and cleanup. Editor tests round-trip all configuration fields, sequence rows, block restrictions, examples and starter state. Native bootstrap/edition lifecycle tests cover ownership and detached players. Real build-output tests check original core/license bytes, media, absence of teacher/generator payloads and measured size. Playwright exercises authoring, save/reopen, preview, ELPX import/duplication, static operation and offline nested-path SCORM 1.2 score/status reporting against scorm-again. This does not certify a live Moodle deployment.

## Rollout plan

Review the feature in the fork before merging into that fork's main. Decisions remain Proposed until approved. Do not target upstream. Manually verify assistive technologies and a representative Moodle SCORM 1.2 course before wider classroom rollout. Generated assets are rebuilt by the existing pipeline.

## Risks and mitigations

- Shared suspend data has no workspace extension. Restore scores only, preserve other activities and explain that programs restart from the starter.
- Client-side assessment cannot protect examination rules; state the formative use and tampering limitations explicitly.
- Sequence scoring intentionally compares observable actions exactly; describe partial credit and additional-action behavior to teachers.
- Block/API upgrades may affect media, accessibility and size. Keep pinned dependencies and behavioral/export tests.
- Existing repository-wide failures must be reported separately from feature checks; do not weaken gates or alter unrelated tests.

## ADRs required or referenced

| Decision | ADR |
| --- | --- |
| Published Blockly packaging and offline resource split | [ADR-47-01](../../adr/ADR-47-01-ship-the-published-blockly-core-offline.md) |
| Validated bounded interpreter and lifecycle | [ADR-47-02](../../adr/ADR-47-02-interpret-a-bounded-block-operation-set.md) |
| Behavioral assessment and shared SCORM 1.2 policy | [ADR-47-03](../../adr/ADR-47-03-assess-behavior-through-the-shared-scorm12-policy.md) |
| Native edition resource ownership | [ADR-2293-01](../../adr/ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md) |
| Shared SCORM 1.2 activity registry | [ADR-2209-02](../../adr/ADR-2209-02-scorm12-activity-completion-registry.md) |

Tracking uses [fork PR #47](https://github.com/ateeducacion/exelearning/pull/47). No issue was opened solely to obtain an identifier.
