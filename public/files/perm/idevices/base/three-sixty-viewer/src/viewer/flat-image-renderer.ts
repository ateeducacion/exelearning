/**
 * Flat (non-360°) scene rendering: a plain `<img>` shown undistorted with
 * `object-fit: contain`. Hotspots are positioned by x/y percent of the
 * CONTAINED image rectangle, so letterbox bars never shift them.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { PercentPoint, Rect } from '../shared/geometry';
import { clientToFlatPercent, containedImageRect, flatPercentToPosition } from '../shared/geometry';

export interface FlatImageRenderer {
    readonly image: HTMLImageElement;
    setImage: (src: string, alt: string) => void;
    setVisible: (visible: boolean) => void;
    /** Contained-image rect relative to `box` (the positioning host). */
    imageRect: (box: Rect) => Rect;
    /** Click → percent inside the contained image, or null outside it. */
    clientToPercent: (box: Rect, clientX: number, clientY: number) => PercentPoint | null;
    /** Percent → pixel position relative to `box`. */
    percentToPosition: (box: Rect, x: number, y: number) => { x: number; y: number };
    dispose: () => void;
}

export function createFlatImageRenderer(host: HTMLElement, className: string): FlatImageRenderer {
    const image = document.createElement('img');
    image.className = className;
    image.setAttribute('draggable', 'false');
    image.style.display = 'none';
    host.appendChild(image);

    const naturalSize = (): { width: number; height: number } => ({
        width: image.naturalWidth || 0,
        height: image.naturalHeight || 0,
    });

    return {
        image,
        setImage(src, alt) {
            image.src = src;
            image.alt = alt;
        },
        setVisible(visible) {
            image.style.display = visible ? '' : 'none';
        },
        imageRect(box) {
            const natural = naturalSize();
            return containedImageRect(natural.width, natural.height, box.width, box.height);
        },
        clientToPercent(box, clientX, clientY) {
            return clientToFlatPercent(box, this.imageRect(box), clientX, clientY);
        },
        percentToPosition(box, x, y) {
            return flatPercentToPosition(this.imageRect(box), x, y);
        },
        dispose() {
            image.parentNode?.removeChild(image);
        },
    };
}
