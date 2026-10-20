/**
 * Edition bundle entry point. Compiled by scripts/build-idevices.ts into
 * edition/three-sixty-viewer.js (a classic-script IIFE). The workarea
 * re-evaluates this script every time the iDevice enters edit mode, so the
 * global is (re)assigned EXPLICITLY on every execution — never rely on the
 * bundler's globalName.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { createThreeSixtyEditionDevice } from './device';
import type { ThreeSixtyEditionDevice } from './device';

declare global {
    // eslint-disable-next-line no-var
    var $exeDevice: ThreeSixtyEditionDevice | undefined;
}

globalThis.$exeDevice = createThreeSixtyEditionDevice();
