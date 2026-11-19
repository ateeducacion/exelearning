---
id: ADR-47-03
title: "Assess behavior through the shared SCORM 1.2 policy"
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
  adrs: [ADR-47-01, ADR-47-02, ADR-2209-02]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "OpenAI Codex"
  model: "GPT-6"
---

# ADR-47-03: Assess behavior through the shared SCORM 1.2 policy

## Context

The existing SCORM 1.2 registry owns activity identity, weights, completion, score aggregation and the 4096-character suspend-data payload. Teachers need understandable assessment rules rather than custom test scripts. The requested first version targets SCORM 1.2 only.

## Problem

How should Block Programming assess different valid programs, distinguish practice from submission and report grades without corrupting another activity or inventing a second SCORM wrapper?

## Decision drivers

- Observable outcomes and teacher-editable criteria.
- Explicit completion separate from passing.
- Existing activity weights and completion policy.
- Honest client-side assessment and persistence limits.

## Options considered

### Option 1: Declarative behavioral criteria and shared reporting
Score destination coordinates, an observable action trace or a numeric variable result. Use the existing reportActivity/updateActivity APIs.

### Option 2: Match a fixed Blockly solution
Smaller to implement but rejects equivalent valid programs and assesses arrangement rather than behavior.

### Option 3: A separate SCORM wrapper or custom JavaScript tests
Duplicates aggregate/persistence policy or requires teachers to program their own tests. Neither is needed.

## Evidence

At c848eca0, `public/app/common/common.js` implements `reportActivity`, `updateActivity`, weight/threshold aggregation and shared commits; `exe-scorm12-activities.js` owns suspend-data serialization and compaction. Its schema stores structural activity outcomes, not source programs. The official repository runtime contract documents that boundary. Unit tests demonstrate equivalent loop/direct solutions and no grades on practice.

## Decision

Store versioned declarative challenge parameters and a starter workspace using the native JSON iDevice pattern. Score actual interpreter results on a 0–100 scale. A submitted execution is completed even when its score fails its threshold; practice does not consume attempts or report. Report via the shared helpers with the native component ID, author weight, threshold and one answered assignment. Deduplicate unchanged submissions. Ungraded activities are optional and never publish grades. Restore only the shared registry score; never write workspace JSON into suspend data. SCORM 2004 is outside this feature scope.

## Consequences

### Positive
- Alternative correct programs receive the same score.
- Shared policy preserves other activities, package weighting and completion rules.
- Offline HTML remains usable without an LMS.

### Negative
- Students rebuild from the starter when resuming; source is not uploaded or restored.
- All assessment rules and attempt counters are inspectable and tamperable.

### Neutral
- Sequence assessment is an exact observable trace, not a block arrangement. Partial credit is explicit and documented.

## Risks

An unchanged program submitted again in another browser session cannot be deduplicated without workspace persistence; per-session deduplication is intentional. Attempt limits apply to the current page visit: the shared registry has no attempt counter, and its answered counter must not be repurposed as retries. Attempt limits are formative UI policy, not tamper-proof enforcement. No claim of live Moodle certification is made from a stand-in LMS test.

## Validation

Unit tests separate practice/submission, completed/failed outcomes, partial credit, attempts, reporting errors and multiple players. The exported-package E2E test runs under a nested LMS route with all external requests blocked and verifies SCORM raw score and lesson_status against scorm-again.

## Follow-up work

Consider source submission or workspace resume only when the shared persistence contract provides a suitable budget and extension. Test with a live Moodle deployment before claiming deployment-specific certification.

## References

- https://exelearning.github.io/exelearning/development/scorm12-runtime-contract/
- https://exelearning.github.io/exelearning/elpx-format/idevices/patterns/
- `public/app/common/common.js` @ c848eca0
- `public/app/common/scorm/scorm12/exe-scorm12-activities.js` @ c848eca0
- `test/e2e/playwright/specs/block-programming.spec.ts`

- https://github.com/ateeducacion/exelearning/pull/47
- [Block Programming design](../changes/47-block-programming/design.md)
