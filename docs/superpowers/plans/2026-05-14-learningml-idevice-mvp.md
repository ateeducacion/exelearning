# LearningML iDevice MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small eXeLearning-native Blockly iDevice for editable turtle and introductory ML activities in offline HTML/SCORM exports.

**Architecture:** Add a JSON-backed iDevice under `public/files/perm/idevices/base/learningml`. Teacher configuration is stored in `jsonProperties`; exported content initializes an instance-scoped Blockly workspace, interprets an allowlisted Blockly JSON structure without `eval`, draws to a canvas, assesses deterministic tests, and reports progress through localStorage or SCORM where available.

**Tech Stack:** eXeLearning iDevice API v3, vanilla JavaScript, Blockly 12.5.1 browser assets, Vitest.

---

## Architecture Findings

- Built-in iDevices are discovered from `public/files/perm/idevices/base/<type>/config.xml`.
- JSON-backed iDevices use `<component-type>json</component-type>` and receive `data-idevice-json-data` during export.
- Exporters copy files from each used iDevice `export/` directory into `idevices/<type>/`.
- Browser/static export has a shim in `src/shared/export/browser/idevice-config-browser.ts`; new JSON iDevices and extra JS dependencies must be listed there.
- Existing scored activities use `$exeDevices.iDevice.gamification.scorm` for aggregate SCORM reporting. The MVP reuses that when present and degrades when absent.
- `LearningML-Education/lml-algorithms` contains useful conceptual references (`KNN`, `NaiveBayes`, `LMLSequential`, numeric/text/audio/image feature extractors), but it depends on TensorFlow.js, model loaders, JSZip, file-saver, and shared model persistence. The MVP keeps a tiny nearest-example classifier instead of importing this library.

## Dependency Plan

- Add only `blockly` as a package dependency.
- Vendor the minimal browser files needed by this iDevice into its own `edition/` and `export/` folders: `blockly_compressed.js`, `blocks_compressed.js`, and `en.js`.
- Do not include Scratch GUI, Scratch VM, LearningML editor, TensorFlow.js, Pyodide, or generated JavaScript execution.
- Do not copy `LearningML-Education/lml-algorithms` source in the MVP; cite it as conceptual research only.

## Risk List

- Blockly accessibility is limited compared with plain forms; the UI provides labelled controls and text feedback, and the limitation is documented.
- SCORM suspend data limits vary by LMS. The MVP stores compact progress and falls back to localStorage.
- EPUB support is limited to graceful non-backend behavior; full Blockly editing in EPUB readers is not guaranteed.
- The public name may need review because LearningML is an existing project. Internal IDs are limited to `learningml` and can be renamed later.

## Exact Files

- Create `public/files/perm/idevices/base/learningml/config.xml`.
- Create `public/files/perm/idevices/base/learningml/learningml-icon.svg`.
- Create `public/files/perm/idevices/base/learningml/edition/learningml.js`.
- Create `public/files/perm/idevices/base/learningml/edition/learningml.css`.
- Create `public/files/perm/idevices/base/learningml/edition/learningml.test.js`.
- Create `public/files/perm/idevices/base/learningml/export/learningml.js`.
- Create `public/files/perm/idevices/base/learningml/export/learningml.css`.
- Create `public/files/perm/idevices/base/learningml/export/learningml.html`.
- Create `public/files/perm/idevices/base/learningml/export/learningml.test.js`.
- Modify `src/shared/export/browser/idevice-config-browser.ts`.
- Modify `package.json`.
- Modify `public/libs/README.md`.
- Add developer and usage documentation under `doc/development/`.

## MVP Task Checklist

- [x] Create the iDevice metadata, icon, and local Blockly assets.
- [x] Implement teacher configuration UI with title, instructions, mode, preset, edit/delete flags, limits, and JSON assessment tests.
- [x] Implement export runtime with instance-scoped initialization and multiple-instance safety.
- [x] Implement a safe interpreter over allowlisted Blockly JSON, not generated JavaScript.
- [x] Implement turtle/canvas operations and a small nearest-neighbor style classifier.
- [x] Implement deterministic assessment and localStorage/SCORM adapters.
- [x] Add colocated Vitest tests for edition round-trip and export runtime behavior.
- [x] Document architecture, usage, security, export behavior, licensing, and roadmap.
