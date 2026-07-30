/**
 * GUI translation boundary. The workarea provides the global `_()`; tests and
 * degraded environments fall back to identity so the editor never crashes on
 * a missing translator.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export type Translate = (text: string) => string;

/** Translate through the page-provided `_` when it exists. */
export function tr(text: string): string {
    if (typeof _ === 'function') {
        try {
            return _(text);
        } catch {
            return text;
        }
    }
    return text;
}
