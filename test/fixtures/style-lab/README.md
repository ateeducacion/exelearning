# Style Lab fixtures

This directory holds `.elpx` fixtures used by the Developer > Style Lab.

The manifest lives in
[`public/app/workarea/developer/style-lab/fixtures.manifest.json (or fixtures.manifest.js for the browser module)`](../../../public/app/workarea/developer/style-lab/fixtures.manifest.json)
and maps fixture IDs (URL-safe slugs) to paths inside this folder.

## Reused assets

The owner of `exelearning/exelearning-style-designer` has authorized reuse of
its `.elpx` files (notably `leer-para-aprender.elpx`) and example exports as
source material for the Style Lab. When importing one, please:

1. Drop it into this folder.
2. Add an entry to `fixtures.manifest.json (or fixtures.manifest.js for the browser module)` with a stable `id` and an honest
   `source` tag (e.g. `"source": "exelearning-style-designer"`).
3. Make sure the file is under a permissive license (the Style Designer
   ships AGPL-3.0 content).

Fixtures are loaded client-side via the existing import pipeline. No new
upload mechanism is introduced for them.
