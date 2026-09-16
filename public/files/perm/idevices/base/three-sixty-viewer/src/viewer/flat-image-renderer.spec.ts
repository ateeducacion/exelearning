import { describe, expect, it } from 'vitest';
import { createFlatImageRenderer } from './flat-image-renderer';

function withNaturalSize(image: HTMLImageElement, width: number, height: number): void {
    Object.defineProperty(image, 'naturalWidth', { value: width, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: height, configurable: true });
}

describe('createFlatImageRenderer', () => {
    it('creates a hidden draggable-false image inside the host', () => {
        const host = document.createElement('div');
        const flat = createFlatImageRenderer(host, 'my-flat');
        expect(flat.image.parentNode).toBe(host);
        expect(flat.image.className).toBe('my-flat');
        expect(flat.image.getAttribute('draggable')).toBe('false');
        expect(flat.image.style.display).toBe('none');
        flat.setVisible(true);
        expect(flat.image.style.display).toBe('');
        flat.setImage('photo.jpg', 'A photo');
        expect(flat.image.getAttribute('src')).toBe('photo.jpg');
        expect(flat.image.alt).toBe('A photo');
        flat.dispose();
        expect(flat.image.parentNode).toBeNull();
    });

    it('computes the letterboxed rect from the natural size', () => {
        const host = document.createElement('div');
        const flat = createFlatImageRenderer(host, 'x');
        withNaturalSize(flat.image, 2000, 1000);
        const box = { left: 0, top: 0, width: 400, height: 400 };
        expect(flat.imageRect(box)).toEqual({ left: 0, top: 100, width: 400, height: 200 });
        expect(flat.clientToPercent(box, 200, 200)).toEqual({ x: 50, y: 50 });
        expect(flat.clientToPercent(box, 200, 50)).toBeNull(); // letterbox bar
        expect(flat.percentToPosition(box, 50, 50)).toEqual({ x: 200, y: 200 });
        flat.dispose();
    });

    it('falls back to the whole box while the image is undecoded', () => {
        const host = document.createElement('div');
        const flat = createFlatImageRenderer(host, 'x');
        withNaturalSize(flat.image, 0, 0);
        const box = { left: 0, top: 0, width: 300, height: 150 };
        expect(flat.imageRect(box)).toEqual({ left: 0, top: 0, width: 300, height: 150 });
        expect(flat.clientToPercent(box, 150, 75)).toEqual({ x: 50, y: 50 });
        flat.dispose();
    });
});
