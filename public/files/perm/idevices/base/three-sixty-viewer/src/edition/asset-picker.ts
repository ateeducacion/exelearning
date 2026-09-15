/**
 * Asset selection boundary: the eXeLearning file manager when the workarea
 * provides it, a hidden `<input type="file">` + FileReader data-URL fallback
 * otherwise. Injectable so tests never touch real globals.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export type MediaKind = 'image' | 'video';

export interface AssetPicker {
    /** Open the picker; resolves with an asset URL or null on cancel. */
    pick: (kind: MediaKind, onSelect: (assetUrl: string) => void) => void;
    /** Whether the rich file manager is available (fallback input if not). */
    readonly hasFileManager: boolean;
}

function fileManager(): ExeFileManagerLike | null {
    if (typeof eXeLearning === 'undefined' || !eXeLearning) return null;
    const manager = eXeLearning.app?.modals?.filemanager;
    return manager && typeof manager.show === 'function' ? manager : null;
}

export function createAssetPicker(fallbackInput: () => HTMLInputElement | null): AssetPicker {
    return {
        get hasFileManager() {
            return fileManager() !== null;
        },
        pick(kind, onSelect) {
            const manager = fileManager();
            if (manager) {
                manager.show({
                    accept: kind,
                    multiSelect: false,
                    onSelect: result => {
                        const assetUrl = result?.assetUrl;
                        if (typeof assetUrl === 'string' && assetUrl) onSelect(assetUrl);
                    },
                });
                return;
            }
            // Fallback: the hidden input; its change handler (wired by the
            // editor) reads the file as a data URL.
            fallbackInput()?.click();
        },
    };
}

/** Read a picked file as a data URL (the no-file-manager fallback). */
export function readFileAsDataUrl(file: Blob, onDone: (dataUrl: string) => void): void {
    const reader = new FileReader();
    reader.onload = () => {
        onDone(String(reader.result ?? ''));
    };
    reader.readAsDataURL(file);
}
