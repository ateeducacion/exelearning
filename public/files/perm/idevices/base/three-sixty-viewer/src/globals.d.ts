/**
 * Ambient declarations for the page-provided globals the bundles rely on.
 *
 * Three.js and OrbitControls are NOT bundled — they are vendored export
 * resources (export/three.min.js, export/OrbitControls.js) loaded as classic
 * scripts before (export) or lazily by (edition) the generated bundles. Only
 * the small structural surface actually used is declared here; everything
 * else stays `unknown`.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { ThreeNamespace } from './viewer/types';

declare global {
    /** Vendored three.js global; absent until its script is loaded. */
    // eslint-disable-next-line no-var
    var THREE: ThreeNamespace | undefined;

    /** eXeLearning GUI translation function (workarea only). */
    // eslint-disable-next-line no-var
    var _: ((text: string) => string) | undefined;

    /** The eXeLearning application global (workarea/preview only). */
    // eslint-disable-next-line no-var
    var eXeLearning: ExeLearningGlobal | undefined;

    interface ExeAssetManagerLike {
        resolveAssetURLSync?: (src: string) => string | null | undefined;
        resolveAssetURL?: (src: string) => unknown;
    }

    interface ExeFileManagerSelection {
        assetUrl?: string;
    }

    interface ExeFileManagerLike {
        show: (options: {
            accept: string;
            multiSelect: boolean;
            onSelect: (result: ExeFileManagerSelection | null) => void;
        }) => void;
    }

    interface ExeLearningGlobal {
        app?: {
            project?: {
                _yjsBridge?: {
                    assetManager?: ExeAssetManagerLike;
                };
            };
            modals?: {
                filemanager?: ExeFileManagerLike;
            };
        };
    }
}

export {};
