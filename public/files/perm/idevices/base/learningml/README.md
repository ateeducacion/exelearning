# LearningML iDevice

A native JSON iDevice that brings the LearningML model editor into eXeLearning content. Learners work
through the same three columns as [LearningML](https://learningml.org):

1. **Training data**: the teacher's classes, with optional starter examples. Learners add or remove
   their own examples.
2. **Train**: pick an algorithm and train the model in the browser.
3. **Result**: type an example and see the predicted class with a confidence bar per class.
   When the teacher adds evaluation examples, **Check my model** scores the trained model.

It runs offline in HTML5, single-page and SCORM 1.2 exports: one 20 kB script (about 6 kB gzip) and
one stylesheet. It has no dependencies and makes no network requests.

## Authoring

- **Type of data**: text, or numbers separated by commas (`1.5, 2`). Every numeric example must
  have the same number of values.
- **Default algorithm**: Naive Bayes or nearest neighbours (k-NN). Learners can switch.
- **Classes**: at least two, with distinct names. Each one has training examples (shown to the
  learner) and evaluation examples (used only to score the model), one per line.
- **Assessment**: when enabled, the score is the percentage of evaluation examples classified as
  their own class. It is reported to the LMS through the shared SCORM 1.2 activity registry
  (`$exeDevices.iDevice.gamification.scorm.reportActivity/updateActivity`), with the activity's
  weight and passing score.

## Machine learning

The classifiers follow the LearningML NG research (`learningml-ng`, DEC-0011: pure code instead of
TensorFlow.js):

- Text is encoded as a bag of words over the training vocabulary. Words are lowercased and accents
  are removed, so `Canción` and `cancion` match.
- **Naive Bayes** is Gaussian, as in LearningML (`lml-algorithms`): variance smoothing `1e-9`,
  prior smoothing `1`.
- **k-NN** uses k = 3 with weighted votes: cosine similarity for text, and `1 / (1 + distance)`
  (Euclidean) for numbers. Cosine alone would ignore magnitude, so 1 and 10 would look the same.
  An example that shares no word with the input does not vote.

## Scope and limits

Not included, on purpose:

- **Images and sound.** They need a pretrained feature extractor: MobileNet through
  TensorFlow.js is about 124 kB gzip of runtime plus a 2 MB model in every package, and the
  quality of smaller models has not been validated. WASM/WebGPU runtimes measured heavier
  (about 3.2 MB gzip of WASM) in the LearningML NG benchmarks.
- **The neural network (MLP)**, which in LearningML NG depends on `tfjs-layers`.
- **Programming blocks.** This iDevice is the model editor only.
- **Persistence.** Learner examples and the model live in the page; reloading starts again from the
  teacher's examples. The LMS keeps the score, not the examples.
- **SCORM 2004.** Only SCORM 1.2 reports a score.

Evaluation examples are in the exported page, so they can be read by a learner who inspects it:
assessment is formative, not tamper-proof.

## Tests

```sh
npx vitest run public/files/perm/idevices/base/learningml/
bun x playwright test --project=chromium test/e2e/playwright/specs/learningml.spec.ts
```

The Playwright spec authors an activity, reopens it, previews it, exports a SCORM 1.2 package and
runs it offline under scorm-again, checking the reported score and lesson status.
