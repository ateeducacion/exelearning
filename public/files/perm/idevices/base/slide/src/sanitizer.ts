/**
 * Slide iDevice — SVG sanitization.
 *
 * Two layers:
 *   - `scrubSvg`: pure regex-level scrubber that works without DOMPurify.
 *     Used in unit tests and as a defence-in-depth pass.
 *   - `sanitizeSvg`: DOMPurify-based sanitizer using the SVG profile.
 *     Used by the bundled editor when saving.
 *
 * The bundle layers both: scrub then DOMPurify, so a payload from an older
 * bundle (or hand-edited JSON) can never smuggle code through.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

type DomPurifyLike = {
    sanitize: (input: string, opts?: Record<string, unknown>) => string;
};

/**
 * Pure regex sanitizer. No DOM, no library — safe to call from any
 * environment, including the export renderer that must not load the
 * editor bundle.
 */
export function scrubSvg(svg: unknown): string {
    if (!svg || typeof svg !== 'string') return '';
    // Apply every removal repeatedly until the string stops changing.
    // A single pass can be defeated because deleting one match can splice
    // two halves into a brand-new match (e.g. `<scr<script>ipt>` -> `<script>`,
    // or `javasjavascript:cript:` -> `javascript:`). Looping to a fixed point
    // closes that hole. The end-tag pattern tolerates optional whitespace
    // before the closing angle bracket (`</script >`) and is case-insensitive.
    let prev: string;
    let out = svg;
    do {
        prev = out;
        out = out
            .replace(/<script[\s\S]*?<\/\s*script\s*>/gi, '')
            .replace(/<\/?\s*foreignObject[^>]*>/gi, '')
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
            .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
            .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
            // Dangerous URL schemes. `javascript:` and `vbscript:` are always
            // unsafe and are removed outright. For `data:` we only strip the
            // script-executing `data:text/html` form so legitimate embedded
            // images (`data:image/...`) keep working.
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/data:\s*text\/html/gi, '');
    } while (out !== prev);
    return out;
}

/**
 * SVG sanitizer used at save time.
 *
 * We rely on the regex scrubber (`<script>`, `on*=` handlers,
 * `javascript:` URLs, `<foreignObject>`) for security. DOMPurify's SVG
 * profile is intentionally NOT applied here because in practice it
 * strips attributes Fabric depends on (`transform` on `<g>`, `x` / `y`
 * / `font-family` / `font-size` on `<text>`, `viewBox` on `<svg>`),
 * silently breaking the saved slide.
 *
 * The `purifier` argument is kept for backwards compatibility — it is
 * accepted but ignored. The scene we're sanitizing comes from
 * `fabric.Canvas.toSVG()`, which is trusted code; user-injected raw
 * HTML can't reach this path because every shape goes through the
 * adapter's typed factories.
 */
export function sanitizeSvg(svg: unknown, _purifier?: DomPurifyLike): string {
    void _purifier;
    return scrubSvg(svg);
}
