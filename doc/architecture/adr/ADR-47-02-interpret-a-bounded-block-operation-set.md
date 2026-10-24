---
id: ADR-47-02
title: "Interpret a bounded block operation set"
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
  adrs: [ADR-47-01, ADR-47-03, ADR-2293-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "OpenAI Codex"
  model: "GPT-6"
---

# ADR-47-02: Interpret a bounded block operation set

## Context

Learners must construct programs using movement, conditions, loops, variables and output. Activity and workspace JSON can be imported from untrusted projects. Execution runs inside a normal browser, including offline exports.

## Problem

How can supported student programs run without arbitrary JavaScript, an external service or an unbounded loop freezing the page?

## Decision drivers

- Predictable educational semantics.
- Bounded CPU, memory and elapsed time.
- Safe import and independent instances.
- Public Blockly serialization and normal browser APIs.

## Options considered

### Option 1: Interpret a fixed operation set
Validate and rebuild a Blockly JSON workspace, then interpret only the supported operations.

### Option 2: Generate and evaluate JavaScript
Blockly generators are conventional for general code editors, but executing arbitrary generated or imported source adds a trust boundary and unnecessary bytes.

### Option 3: Embed Scratch VM or a general interpreter
Offers broader language semantics at a larger dependency and maintenance cost.

## Evidence

`src/model.ts` is independent of Blockly and the DOM; its tests demonstrate equivalent direct/loop solutions, variable computations, malformed input rejection and bounded empty/nested loops. Blockly public save/load APIs are documented at https://docs.blockly.com/guides/configure/serialization/. Native lifecycle ownership is established by ADR-2293-01.

## Decision

Interpret one connected start stack with the supported blocks. Rebuild imported JSON from an allowlist before passing it to Blockly, discarding extra serializers and executable metadata. Bound serialized input, blocks, depth, numeric magnitude, repetitions, steps and elapsed time. Yield between statements and count expressions/empty loops against the budget. Use cancellable waits and native DOM/SVG output. Each player owns its state and cleanup resources; edition is owned by `$lifecycle`.

## Consequences

### Positive
- No eval, Function constructor, user scripts or backend endpoint.
- Small deterministic semantics that can be unit tested without a browser.
- One activity cannot mutate another activity state.

### Negative
- This is a deliberately small language, not Scratch compatibility.
- Very large valid programs may exceed limits and receive zero on submission.

### Neutral
- Timings are cooperative; valid programs should remain comfortably below the deadline. Messages are text, not HTML.

## Risks

Client scripts remain modifiable by learners, and browser limits are not examination security. Visual stage coordinates are clipped to the viewport while the textual readout exposes actual coordinates. Runtime deadline behavior depends on browser scheduling; the step limit is the deterministic work limit.

## Validation

Unit tests exercise every operation, arithmetic errors, missing inputs, disallowed blocks, malformed imports, alternate solutions, isolation, cancellation and teardown. Browser tests use the actual published Blockly UI and exported runtime. Manual screen-reader/touch review remains required.

## Follow-up work

Any language extension must add its validated data shape, semantics, limits and behavioral tests together. Add concurrency only with a new explicit decision; do not silently broaden the interpreter.

## References

- `public/files/perm/idevices/base/block-programming/src/model.ts`
- `public/files/perm/idevices/base/block-programming/src/player.ts`
- https://docs.blockly.com/guides/configure/serialization/
- [ADR-2293-01](ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md)

- https://github.com/ateeducacion/exelearning/pull/47
- [Block Programming design](../changes/47-block-programming/design.md)
