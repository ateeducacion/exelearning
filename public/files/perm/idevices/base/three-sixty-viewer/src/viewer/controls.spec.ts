import { describe, expect, it, vi } from 'vitest';
import { PITCH_STEP, YAW_STEP, blockNativeDragInside, captureDragEvents, createFullscreenButton, createNavControls } from './controls';

const NAV_LABELS = { group: 'Pan navigation', left: 'Pan left', up: 'Pan up', down: 'Pan down', right: 'Pan right' };

describe('createNavControls', () => {
    it('creates four labelled arrows that nudge in the right direction', () => {
        const host = document.createElement('div');
        const onNudge = vi.fn();
        const nav = createNavControls(host, NAV_LABELS, onNudge);
        const buttons = nav.element.querySelectorAll('button');
        expect(buttons).toHaveLength(4);
        expect(nav.element.getAttribute('role')).toBe('group');
        expect(nav.element.getAttribute('aria-label')).toBe('Pan navigation');
        (buttons[0] as HTMLButtonElement).click(); // left
        (buttons[1] as HTMLButtonElement).click(); // up
        (buttons[3] as HTMLButtonElement).click(); // right
        expect(onNudge).toHaveBeenNthCalledWith(1, YAW_STEP, 0);
        expect(onNudge).toHaveBeenNthCalledWith(2, 0, -PITCH_STEP);
        expect(onNudge).toHaveBeenNthCalledWith(3, -YAW_STEP, 0);
        nav.dispose();
        expect(host.querySelector('.three-sixty-viewer-nav')).toBeNull();
    });
});

describe('createFullscreenButton', () => {
    it('toggles labels with fullscreen state and cleans up listeners', () => {
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        const fullscreen = createFullscreenButton(wrapper, { enter: 'Fullscreen', exit: 'Exit fullscreen' });
        expect(fullscreen.button.getAttribute('aria-label')).toBe('Fullscreen');

        Object.defineProperty(document, 'fullscreenElement', { value: wrapper, configurable: true });
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(fullscreen.button.getAttribute('aria-label')).toBe('Exit fullscreen');

        Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(fullscreen.button.getAttribute('aria-label')).toBe('Fullscreen');

        fullscreen.dispose();
        expect(wrapper.querySelector('.three-sixty-viewer-fullscreen-button')).toBeNull();
        wrapper.remove();
    });

    it('requests and exits fullscreen through the standard API', () => {
        const wrapper = document.createElement('div') as HTMLElement & { requestFullscreen: () => void };
        const request = vi.fn();
        wrapper.requestFullscreen = request;
        const fullscreen = createFullscreenButton(wrapper, { enter: 'Fullscreen', exit: 'Exit fullscreen' });
        fullscreen.button.click();
        expect(request).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'fullscreenElement', { value: wrapper, configurable: true });
        const exit = vi.fn();
        Object.defineProperty(document, 'exitFullscreen', { value: exit, configurable: true });
        fullscreen.button.click();
        expect(exit).toHaveBeenCalledTimes(1);
        Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
        fullscreen.dispose();
    });
});

describe('captureDragEvents', () => {
    it('stops propagation of pointer gestures and prevents native drag', () => {
        const parent = document.createElement('div');
        const canvas = document.createElement('canvas');
        parent.appendChild(canvas);
        captureDragEvents(canvas);
        expect(canvas.getAttribute('draggable')).toBe('false');
        expect(canvas.getAttribute('contenteditable')).toBe('false');

        const parentSaw = vi.fn();
        parent.addEventListener('mousedown', parentSaw);
        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        expect(parentSaw).not.toHaveBeenCalled();

        const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
        canvas.dispatchEvent(dragStart);
        expect(dragStart.defaultPrevented).toBe(true);
    });
});

describe('blockNativeDragInside', () => {
    it('kills dragstart originating inside the wrapper only, until disposed', () => {
        const wrapper = document.createElement('div');
        const inner = document.createElement('span');
        wrapper.appendChild(inner);
        document.body.appendChild(wrapper);
        const outside = document.createElement('div');
        document.body.appendChild(outside);

        const blocker = blockNativeDragInside(wrapper);
        const insideEvent = new Event('dragstart', { bubbles: true, cancelable: true });
        inner.dispatchEvent(insideEvent);
        expect(insideEvent.defaultPrevented).toBe(true);

        const outsideEvent = new Event('dragstart', { bubbles: true, cancelable: true });
        outside.dispatchEvent(outsideEvent);
        expect(outsideEvent.defaultPrevented).toBe(false);

        blocker.dispose();
        const afterDispose = new Event('dragstart', { bubbles: true, cancelable: true });
        inner.dispatchEvent(afterDispose);
        expect(afterDispose.defaultPrevented).toBe(false);

        wrapper.remove();
        outside.remove();
    });
});
