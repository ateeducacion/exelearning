import { describe, expect, it, vi } from 'vitest';
import { createDefaultHotspot } from '../shared/normalization';
import type { Hotspot, HotspotAction } from '../shared/types';
import { openContentModal } from './modal';

function hotspotWith(action: HotspotAction, label = ''): Hotspot {
    return { ...createDefaultHotspot('hs-m'), label, action };
}

function makeDeps() {
    return {
        resolveSrc: (src: string) => `resolved:${src}`,
        fallbackLabel: () => 'Details',
        onClose: vi.fn(),
    };
}

describe('openContentModal', () => {
    it('renders an accessible dialog with title and close button', () => {
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        const modal = openContentModal(wrapper, hotspotWith({ type: 'text', payload: { html: '<p>Hi</p>' } }, 'About'), null, makeDeps());
        expect(modal.dialog.getAttribute('role')).toBe('dialog');
        expect(modal.dialog.getAttribute('aria-modal')).toBe('true');
        expect(modal.dialog.getAttribute('aria-label')).toBe('About');
        expect(modal.dialog.querySelector('.three-sixty-viewer-modal-title')?.textContent).toBe('About');
        expect(modal.dialog.querySelector('.three-sixty-viewer-modal-body')?.innerHTML).toBe('<p>Hi</p>');
        modal.close();
        wrapper.remove();
    });

    it('renders image payloads with alt, caption and resolved src', () => {
        const wrapper = document.createElement('div');
        const modal = openContentModal(
            wrapper,
            hotspotWith({ type: 'image', payload: { src: 'a.jpg', alt: 'An image', caption: 'Caption' } }),
            null,
            makeDeps(),
        );
        const image = modal.dialog.querySelector('img');
        expect(image?.getAttribute('src')).toBe('resolved:a.jpg');
        expect(image?.alt).toBe('An image');
        expect(modal.dialog.querySelector('.three-sixty-viewer-modal-caption')?.textContent).toBe('Caption');
        modal.close();
    });

    it('embeds provider videos in an iframe and direct files in <video>', () => {
        const wrapper = document.createElement('div');
        const deps = { ...makeDeps(), resolveSrc: (src: string) => src };
        const embedded = openContentModal(
            wrapper,
            hotspotWith({ type: 'video', payload: { src: 'https://youtu.be/abc', poster: '' } }),
            null,
            deps,
        );
        expect(embedded.dialog.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc');
        embedded.close();

        const direct = openContentModal(
            wrapper,
            hotspotWith({ type: 'video', payload: { src: 'movie.mp4', poster: 'p.jpg' } }),
            null,
            deps,
        );
        const video = direct.dialog.querySelector('video');
        expect(video?.getAttribute('src')).toBe('movie.mp4');
        expect(video?.getAttribute('poster')).toBe('p.jpg');
        direct.close();
    });

    it('explains unsupported actions instead of rendering nothing', () => {
        const wrapper = document.createElement('div');
        const modal = openContentModal(
            wrapper,
            hotspotWith({ type: 'unsupported', originalType: 'quiz3d', originalPayload: {} }),
            null,
            makeDeps(),
        );
        expect(modal.dialog.querySelector('.three-sixty-viewer-modal-unsupported')?.textContent).toContain('newer version');
        modal.close();
    });

    it('closes on Escape, restores focus and reports onClose once', () => {
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        const deps = makeDeps();
        const modal = openContentModal(wrapper, hotspotWith({ type: 'text', payload: { html: 'x' } }), trigger, deps);
        // Close button gets initial focus.
        expect(document.activeElement?.className).toBe('three-sixty-viewer-modal-close');
        modal.dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(wrapper.querySelector('.three-sixty-viewer-modal')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(deps.onClose).toHaveBeenCalledTimes(1);
        modal.close(); // double close is a no-op
        expect(deps.onClose).toHaveBeenCalledTimes(1);
        trigger.remove();
        wrapper.remove();
    });

    it('traps Tab focus inside the dialog', () => {
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        const modal = openContentModal(
            wrapper,
            hotspotWith({ type: 'text', payload: { html: '<button id="inner-btn">inner</button>' } }),
            null,
            makeDeps(),
        );
        const focusable = modal.dialog.querySelectorAll('button');
        const last = focusable[focusable.length - 1] as HTMLButtonElement;
        last.focus();
        const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        modal.dialog.dispatchEvent(tab);
        expect(tab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(focusable[0]);

        const first = focusable[0] as HTMLButtonElement;
        first.focus();
        const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        modal.dialog.dispatchEvent(shiftTab);
        expect(shiftTab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(last);
        modal.close();
        wrapper.remove();
    });
});
