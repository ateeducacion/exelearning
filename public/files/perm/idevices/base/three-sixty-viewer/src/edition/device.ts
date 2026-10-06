/**
 * The eXeLearning edition contract (`window.$exeDevice`): init/save/destroy.
 *
 * A thin bridge over one Editor instance. Re-initializing destroys the
 * previous editor (no leaked previews); a document from a NEWER schema
 * version is never edited or rewritten — the form shows an explanation and
 * save() returns the original payload untouched.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { hydrateDocument } from '../shared/schema';
import { unsupportedVersionHtml } from './form';
import { createEditor } from './editor';
import type { Editor, EditorDeps } from './editor';
import { tr } from './i18n';

/**
 * The slice of the workarea's `EditionLifecycle` (editionLifecycle.js) this
 * iDevice uses. The workarea attaches it as `$exeDevice.$lifecycle` before
 * `init()` and destroys it when the editor closes, saved or not.
 */
export interface EditionLifecycleLike {
    /** Register a teardown; returns a function that runs it early. */
    own: (disposer: () => void) => () => void;
}

export interface ThreeSixtyEditionDevice {
    /** Attached by the workarea per edition; absent in standalone use. */
    $lifecycle?: EditionLifecycleLike;
    readonly i18n: { readonly name: string };
    init: (element: HTMLElement, previousData: unknown, idevicePath?: string) => void;
    save: () => Record<string, unknown> | false;
    destroy: () => void;
    /** Exposed for integrations/tests: the shared hydration entry point. */
    hydrateDocument: typeof hydrateDocument;
}

export function createThreeSixtyEditionDevice(deps: EditorDeps = {}): ThreeSixtyEditionDevice {
    let editor: Editor | null = null;
    /** Set when the stored payload comes from a newer schema version. */
    let passthrough: unknown = null;

    return {
        i18n: {
            get name() {
                return tr('360° panorama viewer');
            },
        },

        init(element, previousData, idevicePath) {
            this.destroy();
            // Closing the editor without saving must release the WebGL
            // preview, its render loop and any drag or file read in flight.
            // The editor already owns all of that; the lifecycle only has to
            // trigger its teardown.
            this.$lifecycle?.own(() => this.destroy());
            const result = hydrateDocument(previousData);
            if (result.status === 'unsupported-version') {
                passthrough = result.original;
                element.innerHTML = unsupportedVersionHtml(result.version, deps.translate ?? tr);
                return;
            }
            if (result.status === 'invalid') {
                // Unreadable data cannot be preserved meaningfully; start the
                // editor on a fresh document (legacy behaviour).
                const fallback = hydrateDocument(null);
                if (fallback.status !== 'ok') return;
                editor = createEditor(element, fallback.document, idevicePath ?? '', deps);
                return;
            }
            editor = createEditor(element, result.document, idevicePath ?? '', deps);
        },

        save() {
            if (passthrough !== null) {
                // Never rewrite content from a newer version.
                return passthrough as Record<string, unknown>;
            }
            if (!editor) return false;
            return editor.save();
        },

        destroy() {
            editor?.destroy();
            editor = null;
            passthrough = null;
        },

        hydrateDocument,
    };
}
