---
id: ADR-47-01
title: "Ship the published Blockly core offline"
status: Proposed
date: 2026-10-24
tracking_issue: 47
deciders:
  - "eXeLearning maintainers"
reviewers:
  - "eXeLearning maintainers"
related:
  prs: [47]
  changes: [47-block-programming]
  adrs: [ADR-47-02, ADR-47-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "OpenAI Codex"
  model: "GPT-6"
---

# ADR-47-01: Ship the published Blockly core offline

## Context

Teachers and learners both need editable blocks in offline HTML and SCORM 1.2 content. The fork at c848eca0 already has per-iDevice export resources, Bun builds and separate edition resources. Blockly 13.4.0 is published under Apache-2.0.

## Problem

Which conventional packaging option keeps learner editing functional, avoids another toolchain and approaches the 300 KiB Gzip target?

## Decision drivers

- Offline editing and public APIs.
- Transfer size and reproducible dependencies.
- Native browser/static export behavior.
- Separate teacher code and learner assets.

## Options considered

### Option 1: Published prebuilt core and English messages
Copy the package distribution verbatim, concatenate it with the normal Bun learner bundle, and ship only needed UI media.

### Option 2: Standard module imports through Bun
Bundle blockly/core and blockly/msg/en normally. It is conventional but measured larger.

### Option 3: Full Blockly or Scratch runtime
Adds blocks/generators/media not used by this interpreter. Custom Closure builds were excluded because their maintenance cost conflicts with the task.

## Evidence

`bun run bundle:block-programming --measure` compares the options with the same Bun minifier and Gzip level 9. See the measurement table in `public/files/perm/idevices/base/block-programming/README.md`. The published core is 640,950 bytes raw / 180,012 bytes Gzip. Conventional module bundling produces 746,264 / 205,684 bytes for learner JavaScript; the selected published-core bundle is 711,052 / 197,847 bytes. All shared export resources, including media, template and both licenses, total 762,775 / 216,190 bytes (211.1 KiB Gzip). The interpreter/UI portion is 20,177 / 7,738 bytes. The main app bundle is byte-identical to the base at 989,364 bytes; a representative two-activity SCORM package is approximately 517 KiB including the normal theme and embedded source. Per-activity authored data is additional. Measurements use Bun minification and independent Gzip level 9 compression, not HTTP overhead. Context7 resolved `/raspberrypifoundation/blockly` and `/oven-sh/bun` before implementation. The actual native config parser and resource provider were inspected at c848eca0.

## Decision

Pin blockly 13.4.0. Use its published core and English messages verbatim, with custom block definitions and no language generators. Generate the learner runtime before the existing resource ZIPs. Edition loads that same runtime before its separate teacher bundle; a guard prevents another core initialization. URLs resolve media from the runtime script location. No new global app import or data model is introduced.

## Consequences

### Positive
- Both learners and teachers edit real programs offline.
- Published core updates remain reproducible and independently attributable.
- One runtime per page and no teacher UI in learner exports.

### Negative
- Blockly still accounts for most bytes.
- Blockly system messages are initially English only.

### Neutral
- Generated assets follow the existing ignored-build-output policy. The Apache license is included in exports.

## Risks

A distribution upgrade can change media requirements or size. Stale resource ZIPs would break browser/static export; build ordering and package tests cover that boundary. Public Blockly globals require the initialization guard when edition scripts are reloaded.

## Validation

Real build-output tests verify original core bytes, license, absence of generators/teacher text and the compressed budget. Playwright verifies authoring, preview and offline nested-path SCORM 1.2 exports. Compare measured output after each dependency update.

## Follow-up work

Review the proposed decision and manually verify other Blockly system locales before adding them. Do not claim accessibility certification from upstream features alone.

## References

- https://github.com/RaspberryPiFoundation/blockly
- https://docs.blockly.com/
- https://bun.sh/docs/bundler
- `scripts/build-block-programming.ts` and its colocated spec
- `src/shared/export/providers/FileSystemResourceProvider.ts` @ c848eca0
- `scripts/build-resource-bundles.js` @ c848eca0

- https://github.com/ateeducacion/exelearning/pull/47
- [Block Programming design](../changes/47-block-programming/design.md)
