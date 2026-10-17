import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlacementController } from './hotspot-placement';
import type { PlacementController } from './hotspot-placement';

const LABELS = { started: 'Placement on.', cancelled: 'Placement cancelled.', placed: 'Hotspot placed.' };

let button: HTMLButtonElement;
let stage: HTMLElement;
let hint: HTMLElement;
let announce: ReturnType<typeof vi.fn<(message: string) => void>>;
let controller: PlacementController;

beforeEach(() => {
    button = document.createElement('button');
    button.setAttribute('aria-pressed', 'false');
    stage = document.createElement('div');
    hint = document.createElement('p');
    hint.hidden = true;
    document.body.append(button, stage, hint);
    announce = vi.fn<(message: string) => void>();
    controller = createPlacementController(
        { button: () => button, stage: () => stage, hint: () => hint, announce },
        LABELS,
    );
});

afterEach(() => {
    controller.dispose();
    document.body.innerHTML = '';
});

describe('createPlacementController', () => {
    it('toggles mode, reflecting state in aria-pressed, class, stage and hint', () => {
        expect(controller.active).toBe(false);
        controller.toggle();
        expect(controller.active).toBe(true);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.classList.contains('active')).toBe(true);
        expect(stage.classList.contains('three-sixty-preview-stage--placing')).toBe(true);
        expect(hint.hidden).toBe(false);
        expect(announce).toHaveBeenCalledWith(LABELS.started);

        controller.toggle();
        expect(controller.active).toBe(false);
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(stage.classList.contains('three-sixty-preview-stage--placing')).toBe(false);
        expect(hint.hidden).toBe(true);
        expect(announce).toHaveBeenCalledWith(LABELS.cancelled);
    });

    it('Escape cancels an active placement (and only then)', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(announce).not.toHaveBeenCalled();
        controller.toggle();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(controller.active).toBe(false);
        expect(announce).toHaveBeenLastCalledWith(LABELS.cancelled);
    });

    it('complete() ends the mode with the placed announcement', () => {
        controller.toggle();
        controller.complete();
        expect(controller.active).toBe(false);
        expect(announce).toHaveBeenLastCalledWith(LABELS.placed);
        // Completing when inactive announces nothing new.
        announce.mockClear();
        controller.complete();
        expect(announce).not.toHaveBeenCalled();
    });

    it('cancel() is idempotent and dispose() detaches the Escape listener', () => {
        controller.toggle();
        controller.cancel();
        expect(controller.active).toBe(false);
        controller.dispose();
        controller.toggle();
        const before = controller.active;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(controller.active).toBe(before); // listener is gone
    });
});
