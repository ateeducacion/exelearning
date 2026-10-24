/** Native JSON edition bridge. SPDX-License-Identifier: AGPL-3.0-or-later */
import { Editor } from './editor';
import { media, gui as _ } from './editor-host';
globalThis.$exeDevice = {
    init: function (element: HTMLElement, previousData: unknown) {
        this.editor = null;
        try {
            this.editor = new Editor(element, previousData, media);
            this.$lifecycle.own(this.editor, 'dispose');
        } catch {
            element.textContent = _(
                'This Block Programming activity could not be loaded. Original data is preserved; discard to leave without changes.',
            );
        }
    },
    save: function () {
        if (!this.editor) {
            globalThis.eXe.app.alert(_('The activity could not be loaded and has not been changed.'));
            return false;
        }
        try {
            return this.editor.save();
        } catch (error) {
            globalThis.eXe.app.alert(_((error as Error).message));
            return false;
        }
    },
};
