# LearningML iDevice MVP

The LearningML iDevice is a small, eXeLearning-native Blockly activity for educational visual programming and introductory machine learning concepts. It is intentionally an MVP: it is not Scratch, not the LearningML editor, and not a full ML platform.

## What It Does

- Lets teachers configure a Blockly activity with a title, instructions, mode, toolbox preset, initial workspace, execution limits, and JSON assessment tests.
- Lets students edit blocks in exported HTML/SCORM content.
- Runs student blocks through a custom interpreter over Blockly JSON.
- Provides a canvas turtle world with move, turn, pen, reset, and say commands.
- Provides a lightweight toy classifier using small numeric feature vectors.
- Assesses runtime completion, block usage, final turtle position, and classifier accuracy.
- Saves progress to localStorage when SCORM is unavailable.
- Reports score through existing eXeLearning SCORM helpers when they are available.

## What It Does Not Do

- It does not embed LearningML, Scratch GUI, Scratch VM, TensorFlow.js, Pyodide, or any backend service.
- It does not execute generated JavaScript.
- It does not provide a production ML runtime.
- It does not guarantee full Blockly editing in EPUB readers.

## LearningML Research Notes

The MVP was checked against the `LearningML-Education` GitHub organization, especially
`LearningML-Education/lml-algorithms`. That repository is GPL-3.0-or-later and exposes
LearningML algorithms and feature extractors for the full LearningML platform:

- `KNN`
- `NaiveBayes`
- `LMLSequential`
- numeric, text, audio, and MobileNet feature extractors

It depends on TensorFlow.js, MobileNet/audio model loading, JSZip, file-saver, and shared
`localStorage` model persistence. Those are useful references for LearningML concepts, but they
are intentionally not imported into this iDevice MVP because they would make the first review too
large and would conflict with the lightweight offline/export constraints.

The MVP classifier is therefore a small eXeLearning-native teaching model inspired by the KNN
shape of LearningML, implemented without tensors, generated JavaScript, backend services, or
LearningML/Scratch source code.

## Why Blockly

Blockly provides the visual block editor, JSON serialization, custom blocks, toolbox presets, and offline browser assets needed for a small iDevice. The MVP uses Blockly only for editing and serialization. Execution is handled by eXeLearning code so student-authored blocks cannot run arbitrary JavaScript.

## Files

- `public/files/perm/idevices/base/learningml/config.xml` declares the JSON iDevice.
- `edition/learningml.js` renders the teacher configuration form.
- `export/learningml.js` renders student activity instances, defines Blockly blocks, validates workspace JSON, executes programs, assesses results, and handles storage/SCORM.
- `export/blockly_compressed.js`, `export/blocks_compressed.js`, and `export/en.js` are local Blockly browser assets copied from the `blockly` package.

## Persistence

Teacher-authored data is stored in the normal JSON iDevice `jsonProperties` payload with `schemaVersion: 1`. The schema includes:

- `title`
- `instructions`
- `activityMode`
- `toolboxPreset`
- `initialWorkspace`
- `studentEditing`
- `runtime`
- `assessment`
- `ml`
- `scorm`

Student progress is stored as:

```json
{
  "version": 1,
  "ideviceId": "stable-instance-id",
  "updatedAt": 0,
  "payload": {
    "workspace": {}
  }
}
```

The localStorage key is namespaced as `exe:learningml:v1:<path>:<ideviceId>`.

## SCORM Behavior

When the exported page has SCORM support, the iDevice uses existing eXeLearning gamification SCORM helpers for score reporting. If those helpers are unavailable but `window.scorm` exists, it writes a clamped raw score and pass/fail status directly through the wrapper. Progress suspend data is compact JSON and is skipped if it exceeds the MVP safety limit.

The activity works without SCORM. Missing LMS APIs are not treated as runtime errors.

## Security Model

- Blockly JSON is treated as untrusted data.
- Only allowlisted block types execute.
- Unknown blocks, oversized JSON, and excessive block counts are rejected.
- Runtime limits enforce maximum steps and wall-clock time.
- There is no `eval`, `new Function`, or generated JavaScript execution path.
- Student-controlled output uses `textContent`.
- Runtime state is closure-local per instance.
- localStorage records must match the current `ideviceId` before loading.

## Adding Blocks

To add a block:

1. Add the block JSON definition in `defineBlocks()`.
2. Add it to one or more toolbox presets in `TOOLBOXES`.
3. Add the type to `BLOCK_TYPES`.
4. Add interpreter behavior in `executeBlock()` or value evaluation helpers.
5. Add Vitest coverage for the block and any assessment interactions.

## Adding Assessment Tests

Assessment tests are JSON records in `assessment.tests`. Each test has an `id`, `type`, and `score`. Current MVP types are:

- `runtime-completion`
- `block-usage`
- `final-position`
- `classification-accuracy`

Add new types in `assess()` and cover them in `export/learningml.test.js`.

## Extending The Toy ML Runtime

The MVP classifier is deliberately small. It stores training examples as `{ features: number[], label: string }`, trains by enabling classification, and predicts by nearest example. Future extensions should keep the model deterministic, small enough for SCORM/localStorage, and free of network/backend dependencies.

## Accessibility

Controls are real buttons with labels, feedback is text, and the canvas has an accessible label. Blockly itself has known accessibility limitations; this MVP documents that limitation rather than hiding it.

## Licensing And Attribution

Blockly 12.5.1 is Apache-2.0. `LearningML-Education/lml-algorithms` is GPL-3.0-or-later, but the MVP does not copy LearningML or Scratch code. The name "LearningML" is tentative because an existing project uses that name; rename the iDevice before release if project coordination or legal review requires it.

## Roadmap

Phase 1:

- Blockly editor in export.
- Turtle/canvas runtime.
- Custom executor.
- Basic assessment.
- localStorage.
- SCORM score/completion.

Phase 2:

- Better teacher UI for assessment tests.
- More robust Intro ML presets.
- Hidden test sets in the editor UI.

Phase 3:

- Train/test split.
- Confusion matrix.
- Feature visualization.
- Confidence thresholds.

Phase 4:

- Optional interoperability with LearningML concepts.
- Preset import/export.
- Better accessibility tooling around Blockly.
