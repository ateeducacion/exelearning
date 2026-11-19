# Block Programming

Block Programming is a native JSON iDevice for small offline programming assignments. It uses Blockly 13.4.0, a single SVG character and an interpreter for a fixed set of operations. It does not include Scratch, Scratch VM, a language generator or a backend execution service.

The display name is **Block Programming**, with the native iDevice identifier and directory `block-programming`. Script, stylesheet, icon and export names use the same identifier. The version 1 activity configuration and Blockly block schema are unchanged, and teacher-authored titles are preserved. Activities created with the provisional `mini-scratch` identifier in earlier drafts are not automatically migrated; recreate those draft iDevices under the new type. Existing standalone exports keep their own packaged runtime. The icon is an original SVG showing interlocking blue, green and orange blocks; it does not use the Scratch or Blockly logos.

## Create an assignment

1. Add **Interactive activities → Block Programming**.
2. In **Activity**, load one of the three examples or write the title, instructions and educational objective. Loading an example replaces the settings and starter program.
3. In **Programming**, expand **Available blocks** to choose the student toolbox, then build the starter program in the full-width workspace.
4. In **Assessment**, configure the challenge, feedback, passing threshold, activity weight and attempts. A maximum of zero means unlimited attempts. Update the activity instructions when changing challenge parameters.
5. Open **Preview** to try the current activity as a student. **Preview activity** refreshes it after edits; leaving the tab stops and releases the preview. Native eXeLearning save/load, duplication and ELPX preserve the configuration and starter program. Switching tabs keeps unsaved work.

All challenge rules are visible to students. Teachers do not write JavaScript, JSON or XML.

### Examples and assessment

| Example | Editable teacher settings | Suggested solution | Scoring |
| --- | --- | --- | --- |
| Reach a destination | Start and target x/y | Move forward 3, or repeat move forward 1 three times | Equal credit for target x and y |
| Follow a sequence | Ordered observable actions using the Add action form | Move 1, turn right, display Hello | Matching actions divided by the larger of expected and actual action counts |
| Variables and calculations | Variable name and expected numeric value | Sum 1 through 5 into `result`; alternatively compute the same value another way | Expected variable exists and matches within 0.001 |

Every example can be changed through the teacher forms. The default passing threshold is 100/100. Scores are normalized to 0–100. A lower passing threshold can permit partial credit to pass. Sequence assessment compares the actions produced, not the number or arrangement of source blocks: loops are accepted. It does not compare movement paths, ignore extra actions, or reorder expected actions. Waits and variable changes do not add observable sequence actions.

## Student controls

- **Run** executes from the configured initial stage state, with fresh variables. It shows practice feedback without using an attempt or reporting a grade.
- **Submit attempt** executes the current program again, assesses that execution and consumes an attempt. Errors and interrupted submissions score zero. If an LMS reporting error is shown, that attempt is released and can be submitted again. Repeated clicks on an unchanged submitted program do not report again; change the program to retry.
- **Stop** interrupts execution. **Reset** restores the teacher's starter and stage, preserving the attempt count. Programs must have exactly one connected start stack; remove disconnected blocks before running.
- Numeric variables are case-sensitive identifiers starting with a letter and containing letters, digits or underscores. Set a variable before reading or changing it.
- The character starts facing right. Positive x points right and positive y points down. Turns are 90 degrees. The stage shows coordinates from −10 to 10; the text readout gives the actual coordinates if a program moves outside that viewport.

The supported blocks cover start, movement/position, turns, repeat, if/else, wait, arithmetic, comparisons, booleans, numeric variables, messages and character visibility. Keep **Number** available when students need numeric inputs. There are no concurrent scripts, broadcasts, costumes, sounds, arbitrary JavaScript, sensors or networking blocks.

## SCORM 1.2 contract

Graded activities register through `$exeDevices.iDevice.gamification.scorm.reportActivity`. On a submitted execution, `updateActivity` reports the normalized result, one answered assignment and explicit completion flag. The shared registry and policy aggregate activity weights, respect the package completion policy, persist suspend data and commit the session. Block Programming never writes CMI elements, calls LMSFinish or replaces another activity's score directly.

A submitted attempt is **completed** even if it fails; its score and configured threshold determine **success**. A new submitted attempt replaces this activity's previous result. Running or resetting alone leaves the submitted grade unchanged. Ungraded activities do not hold up completion or send grades. HTML and previews work without an LMS. Only SCORM 1.2 is supported and tested for grading in this feature; SCORM 2004 is outside its scope.

The SCORM 1.2 registry owns the 4096-character suspend-data budget. It has no extension for a Blockly workspace. This iDevice therefore restores only the registry's score; it never places program source in suspend data or overwrites unrelated stored state. Student programs are not uploaded to teachers. Resume starts with the teacher's starter program. Attempt limits last for the current page visit, including SCORM: the shared schema has no attempt-count field, and its answered counter means answered assignments, not retries. They are not a security boundary; editing client state or registry compaction can defeat them.

Client-side rules, results, source programs and attempt counters are inspectable and modifiable. This activity supports formative assessment, not tamper-proof high-stakes examinations. There are no confidential hidden tests.

## Safety and lifecycle

`src/model.ts` validates and rebuilds allowlisted configuration and workspace data before Blockly loads it. Unsupported block types, serializers, executable metadata and unknown inputs cannot enter Blockly from an imported activity. Block IDs are regenerated by Blockly; the native eXeLearning component ID remains the stable activity identity.

Limits are 100,000 serialized workspace characters, 200 blocks, nesting depth 40, 2,000 execution steps, repeat counts of 0–1,000 and 15 seconds per execution. Every statement yields to the browser; expressions and empty loop iterations also consume the instruction budget. Wait is limited to five seconds per operation. Values must be finite and within ±1,000,000. Imported text is rendered with textContent or HTML escaping. No eval or Function constructor is used.

Each player owns its workspace, event AbortController, deadline, cancellable waits and ResizeObserver. A shared MutationObserver disposes detached players and disconnects when none remain. Edition cleanup is owned by the native `$lifecycle`. Blockly initialization is shared; no second Blockly copy is constructed for authoring.

## Accessibility and localization

Authoring reuses eXeLearning's native iDevice tabs with linked tab/panel roles, selected state and arrow/Home/End keyboard navigation. Tab and field identifiers are isolated per editor. Controls use native buttons and labelled fields, a visible focus outline, responsive layout, text feedback, a textual stage/variable readout and polite status announcements for results and scores. Assessment does not rely on color. There are no decorative motion transitions; the CSS also respects reduced motion.

Blockly 13 includes keyboard navigation. Tab to its workspace, press T for the toolbox, use arrows to navigate, Enter to insert/edit, M to move, Delete to remove and Escape to close menus. These are Blockly's documented controls. English Blockly system messages are shipped locally. eXeLearning-owned source strings use `_()` for authoring and `c_()` for learner content; this change does not edit translation catalogs. Other Blockly system locales are not bundled in this first version.

Full WCAG 2.2 AA compliance and assistive-technology interoperability have not been certified. Screen-reader behavior, touch editing and custom block speech need manual verification with representative learners and devices. See [Blockly accessibility](https://blockly.com/accessibility) and [keyboard navigation](https://docs.blockly.com/guides/configure/keyboard-nav/).

## Build, packaging and size

```sh
bun install --frozen-lockfile
bun run bundle:block-programming
bun run bundle:block-programming --measure
```

The existing Bun build runs this step **before** resource-bundle generation, preventing stale or missing runtime assets in browser/static exports. Generated JS, UI media and the original Apache-2.0 Blockly and AGPL-3.0 Block Programming licenses are ignored by Git and recreated from the pinned package. `config.xml` lists the shared export runtime before the separate edition bundle. The native resource pipeline copies only `export/` into learner packages. Required media resolve relative to the executing script URL, including nested LMS paths. No CDN is used. A page without this iDevice does not load its runtime.

Measurements below use Bun 1.3.11, Blockly 13.4.0 and Node-compatible Gzip level 9 on this implementation. Byte counts refer to payloads; HTTP framing is excluded. Incremental resource totals sum individual compressed resources and conservatively include the license and template even though they are not fetched by the learner UI.

| Resource / option | Bytes | Gzip bytes |
| --- | ---: | ---: |
| Published Blockly core distribution | 640,950 | 180,012 |
| Published English messages | 49,746 | 10,185 |
| Block Programming learner code, separately minified | 20,177 | 7,738 |
| Conventional Bun module core + English + learner code | 746,264 | 205,684 |
| Selected prebuilt core + English + learner code | 711,052 | 197,847 |
| Learner CSS | 1,472 | 633 |
| All static iDevice export resources, including UI media/licenses/template | 762,775 | 216,190 |

Per-activity configuration and rendered HTML grow with the instructions, challenge and starter program. They are included in the sample SCORM package, but not in this shared static-resource budget.

The selected approach is approximately **211.1 KiB Gzip for all additional exported resources**, below the 300 KiB target. It saves about 7.7 KiB compressed compared with the ordinary module bundle. It concatenates the published precompiled files verbatim with the normal Bun output; it does not run Closure Compiler or modify Blockly. The separate teacher bundle is 15,259 bytes uncompressed (14.9 KiB) and is excluded from learner exports. Shared eXeLearning/SCORM assets are not counted in these incremental figures. The main application bundle imports no Block Programming or Blockly code. A direct Bun build of the fork base and feature branch produced the same 989,364 bytes and SHA-256 `c5e1763fd8f2ae4abb6ec347f8c42aba0e87e826e27a3d9f4dba8b26cf463035`.

A representative SCORM 1.2 package from the acceptance test (two activities, one page, default theme and embedded source) is approximately **517 KiB** including standard eXeLearning/SCORM assets. The exact archived size is printed by the Playwright test and saved in its output directory.

Re-run the measurement command after changes; measurements are not guarantees for future Blockly versions.

## Verification and references

Focused frontend tests cover all configuration fields, alternative correct solutions, scores, malformed data, execution limits, retries, cancellation, isolation, native edition ownership and teardown. `scripts/build-block-programming.spec.ts` tests real build output and package-size limits. `test/e2e/playwright/specs/block-programming.spec.ts` exercises real authoring, preview, offline nested-path export and SCORM 1.2 reporting against scorm-again. This is an LMS contract test, not a live Moodle deployment certification.

Research was performed before implementation using the Internet and Context7, resolving `/raspberrypifoundation/blockly` and `/oven-sh/bun`. Current repository behavior at `c848eca0` took precedence over general documentation. Important sources:

- [Native iDevice metadata](https://exelearning.github.io/exelearning/elpx-format/idevices/config-xml/) and [storage patterns](https://exelearning.github.io/exelearning/elpx-format/idevices/patterns/).
- [SCORM 1.2 runtime contract](https://exelearning.github.io/exelearning/development/scorm12-runtime-contract/), `public/app/common/common.js`, and `public/app/common/scorm/scorm12/exe-scorm12-activities.js`.
- [Blockly documentation](https://docs.blockly.com/), [serialization](https://docs.blockly.com/guides/configure/serialization/), [toolboxes](https://docs.blockly.com/guides/configure/toolboxes/category/) and [published package](https://www.npmjs.com/package/blockly).
- [Blockly source and license](https://github.com/RaspberryPiFoundation/blockly) and [Bun build API](https://bun.sh/docs/bundler).
- `src/shared/export/providers/FileSystemResourceProvider.ts`, `public/app/workarea/project/idevices/content/ideviceNode.js` and the existing Slide iDevice build split.

The product name avoids using the Scratch brand, following the [Scratch trademark guidelines](https://mitscratch.freshdesk.com/es/support/solutions/articles/4000232107-normas-sobre-las-marcas-registradas-de-scratch). Blockly attribution follows its [official guidance](https://docs.blockly.com/guides/app-integration/attribution/); library use does not make this an official Blockly product.
