import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Marker } from '../shared/types';
import { createWrapper, makeMarker, resetDom, sequentialIds } from '../test/helpers';
import { openMarkerEditor, renderActionFields, validateMarker } from './marker-editor';

const t = (text: string): string => text;

afterEach(resetDom);

function marker(overrides: Record<string, unknown> = {}): Marker {
    return makeMarker({ id: 'm1', label: 'Summit', ...overrides }, 0, sequentialIds());
}

function open(target: Marker = marker()): {
    host: HTMLElement;
    handle: ReturnType<typeof openMarkerEditor>;
    saved: Marker[];
    cancelled: number;
    deleted: string[];
    camera: ReturnType<typeof vi.fn>;
} {
    const host = createWrapper();
    const saved: Marker[] = [];
    const deleted: string[] = [];
    let cancelled = 0;
    const camera = vi.fn(() => ({ orbit: '1 2 3', target: '0 0 0', fieldOfView: '45deg' }));
    const handle = openMarkerEditor(host, target, t, sequentialIds(), {
        onSave: value => saved.push(value),
        onCancel: () => {
            cancelled += 1;
        },
        onDelete: id => deleted.push(id),
        captureCamera: camera,
    });
    return {
        host,
        handle,
        saved,
        get cancelled() {
            return cancelled;
        },
        deleted,
        camera,
    };
}

describe('validateMarker', () => {
    it('accepts any non-question marker', () => {
        expect(validateMarker(marker(), t)).toEqual({ valid: true });
    });

    it('requires a prompt, two answers and exactly one correct option', () => {
        const noPrompt = marker({ action: { type: 'question', payload: { options: [{ text: 'a' }, { text: 'b' }] } } });
        expect(validateMarker(noPrompt, t)).toEqual({ valid: false, message: 'Enter the question prompt.' });

        const oneOption = marker({ action: { type: 'question', payload: { prompt: 'Q', options: [{ text: 'a' }] } } });
        expect(validateMarker(oneOption, t)).toEqual({ valid: false, message: 'Enter at least two answer options.' });

        const complete = marker({
            action: {
                type: 'question',
                payload: { prompt: 'Q', options: [{ text: 'a', correct: true }, { text: 'b' }] },
            },
        });
        expect(validateMarker(complete, t)).toEqual({ valid: true });
    });
});

describe('renderActionFields', () => {
    it('renders the information textarea', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'information', payload: { html: '<p>x</p>' } } });
        renderActionFields(host, draft, t, sequentialIds());
        const textarea = host.querySelector<HTMLTextAreaElement>('#tdvMkHtml');
        expect(textarea?.value).toBe('<p>x</p>');
        textarea!.value = '<p>y</p>';
        textarea?.dispatchEvent(new Event('input'));
        expect(draft.action.type === 'information' && draft.action.payload.html).toBe('<p>y</p>');
    });

    it('renders the image fields and writes them back', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'image', payload: {} } });
        renderActionFields(host, draft, t, sequentialIds());
        for (const [id, value, key] of [
            ['#tdvMkImgSrc', 'a.png', 'src'],
            ['#tdvMkImgAlt', 'Alt', 'alt'],
            ['#tdvMkImgCap', 'Cap', 'caption'],
        ] as const) {
            const input = host.querySelector<HTMLInputElement>(id);
            input!.value = value;
            input?.dispatchEvent(new Event('input'));
            expect(draft.action.type === 'image' && draft.action.payload[key]).toBe(value);
        }
    });

    it('renders the video fields', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'video', payload: {} } });
        renderActionFields(host, draft, t, sequentialIds());
        const src = host.querySelector<HTMLInputElement>('#tdvMkVidSrc');
        src!.value = 'a.mp4';
        src?.dispatchEvent(new Event('input'));
        expect(draft.action.type === 'video' && draft.action.payload.src).toBe('a.mp4');
        expect(host.querySelector('#tdvMkVidPoster')).not.toBeNull();
    });

    it('renders the link fields with the new-tab toggle', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'link', payload: {} } });
        renderActionFields(host, draft, t, sequentialIds());
        const url = host.querySelector<HTMLInputElement>('#tdvMkLinkUrl');
        url!.value = 'https://example.org';
        url?.dispatchEvent(new Event('input'));
        const newTab = host.querySelector<HTMLInputElement>('#tdvMkNewTab');
        expect(newTab?.checked).toBe(true);
        newTab!.checked = false;
        newTab?.dispatchEvent(new Event('change'));
        expect(draft.action.type === 'link' && draft.action.payload).toEqual({
            url: 'https://example.org',
            newTab: false,
        });
    });

    it('renders the question authoring fields', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'question', payload: { prompt: 'Q?' } } });
        renderActionFields(host, draft, t, sequentialIds());
        expect(host.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Q?');
        expect(host.querySelectorAll('.tdv-q-options .input-group')).toHaveLength(2);
        expect(host.querySelector<HTMLInputElement>('#tdvMkAttempts')?.value).toBe('0');
    });

    it('adds, removes and re-flags question options', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'question', payload: { prompt: 'Q?' } } });
        renderActionFields(host, draft, t, sequentialIds());
        const addOption = [...host.querySelectorAll('button')].find(node => node.textContent === 'Add option');

        addOption?.click();
        expect(host.querySelectorAll('.tdv-q-options .input-group')).toHaveLength(3);

        // The second radio becomes the only correct answer.
        const radios = host.querySelectorAll<HTMLInputElement>('.tdv-q-options input[type="radio"]');
        radios[1]?.dispatchEvent(new Event('change'));
        expect(draft.action.type === 'question' && draft.action.payload.options.map(option => option.correct)).toEqual([
            false,
            true,
            false,
        ]);

        const remove = host.querySelectorAll<HTMLButtonElement>('.tdv-q-options button');
        remove[2]?.click();
        expect(host.querySelectorAll('.tdv-q-options .input-group')).toHaveLength(2);
    });

    it('never lets the author drop below two options', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'question', payload: { prompt: 'Q?' } } });
        renderActionFields(host, draft, t, sequentialIds());
        const removeButtons = host.querySelectorAll<HTMLButtonElement>('.tdv-q-options button');
        expect(removeButtons[0]?.disabled).toBe(true);
    });

    it('caps the authored options at eight', () => {
        const host = createWrapper();
        const draft = marker({ action: { type: 'question', payload: { prompt: 'Q?' } } });
        renderActionFields(host, draft, t, sequentialIds());
        const addOption = [...host.querySelectorAll('button')].find(node => node.textContent === 'Add option');
        for (let i = 0; i < 20; i += 1) {
            addOption?.click();
        }
        expect(host.querySelectorAll('.tdv-q-options .input-group')).toHaveLength(8);
    });

    it('always keeps one correct answer after a removal', () => {
        const host = createWrapper();
        const draft = marker({
            action: {
                type: 'question',
                payload: { prompt: 'Q?', options: [{ text: 'a', correct: true }, { text: 'b' }, { text: 'c' }] },
            },
        });
        renderActionFields(host, draft, t, sequentialIds());
        host.querySelectorAll<HTMLButtonElement>('.tdv-q-options button')[0]?.click();
        expect(draft.action.type === 'question' && draft.action.payload.options.some(option => option.correct)).toBe(
            true,
        );
    });
});

describe('openMarkerEditor', () => {
    it('renders the panel prefilled from the marker', () => {
        const { host } = open(marker({ description: 'Note', icon: 'star' }));
        expect(host.querySelector<HTMLInputElement>('#tdvMkLabel')?.value).toBe('Summit');
        expect(host.querySelector<HTMLInputElement>('#tdvMkDesc')?.value).toBe('Note');
        expect(host.querySelector<HTMLSelectElement>('#tdvMkIcon')?.value).toBe('star');
        expect(host.querySelector<HTMLSelectElement>('#tdvMkType')?.value).toBe('information');
    });

    it('edits a draft, so cancelling discards the changes', () => {
        const target = marker();
        const { host, handle, cancelled } = open(target);
        host.querySelector<HTMLInputElement>('#tdvMkLabel')!.value = 'Changed';
        expect(handle.draft).not.toBe(target);
        host.querySelector<HTMLButtonElement>('[data-cancel]')?.click();
        expect(target.label).toBe('Summit');
        expect(host.innerHTML).toBe('');
        expect(cancelled).toBe(0);
    });

    it('saves the edited marker', () => {
        const { host, saved } = open();
        host.querySelector<HTMLInputElement>('#tdvMkLabel')!.value = 'Peak';
        host.querySelector<HTMLInputElement>('#tdvMkDesc')!.value = 'Note';
        host.querySelector<HTMLSelectElement>('#tdvMkIcon')!.value = 'pin';
        host.querySelector<HTMLButtonElement>('[data-save]')?.click();
        expect(saved).toHaveLength(1);
        expect(saved[0]).toMatchObject({ id: 'm1', label: 'Peak', description: 'Note', icon: 'pin' });
        expect(host.innerHTML).toBe('');
    });

    it('switches the action type and picks the question icon automatically', () => {
        const { host } = open();
        const type = host.querySelector<HTMLSelectElement>('#tdvMkType');
        type!.value = 'question';
        type?.dispatchEvent(new Event('change'));
        expect(host.querySelector<HTMLSelectElement>('#tdvMkIcon')?.value).toBe('question');
        expect(host.querySelector('.tdv-q-options')).not.toBeNull();
    });

    it('refuses to save an incomplete question and shows the reason', () => {
        const { host, saved } = open();
        const type = host.querySelector<HTMLSelectElement>('#tdvMkType');
        type!.value = 'question';
        type?.dispatchEvent(new Event('change'));
        host.querySelector<HTMLButtonElement>('[data-save]')?.click();
        expect(saved).toHaveLength(0);
        const error = host.querySelector<HTMLElement>('[data-error]');
        expect(error?.hidden).toBe(false);
        expect(error?.textContent).toBe('Enter the question prompt.');
        expect(host.querySelector('.tdv-marker-editor')).not.toBeNull();
    });

    it('captures the camera and notes it', () => {
        const { host, camera } = open();
        host.querySelector<HTMLButtonElement>('[data-capture-camera]')?.click();
        expect(camera).toHaveBeenCalled();
        expect(host.querySelector('[data-camera-note]')?.textContent).toBe('Camera captured');
    });

    it('shows the camera note straight away for a marker that already has a view', () => {
        const { host } = open(marker({ camera: { orbit: '1 2 3', target: '', fieldOfView: '' } }));
        expect(host.querySelector('[data-camera-note]')?.textContent).toBe('Camera captured');
    });

    it('leaves the camera untouched when nothing can be captured', () => {
        const host = createWrapper();
        const handle = openMarkerEditor(host, marker(), t, sequentialIds(), {
            onSave: vi.fn(),
            onCancel: vi.fn(),
            onDelete: vi.fn(),
            captureCamera: () => null,
        });
        host.querySelector<HTMLButtonElement>('[data-capture-camera]')?.click();
        expect(handle.draft.camera.orbit).toBe('');
        expect(host.querySelector('[data-camera-note]')?.textContent).toBe('');
    });

    it('reports a delete and a close', () => {
        const { host, deleted } = open();
        host.querySelector<HTMLButtonElement>('[data-delete]')?.click();
        expect(deleted).toEqual(['m1']);

        const second = open();
        second.host.querySelector<HTMLButtonElement>('[data-close]')?.click();
        expect(second.host.innerHTML).toBe('');
    });

    it('closes idempotently', () => {
        const { host, handle } = open();
        handle.close();
        handle.close();
        expect(host.innerHTML).toBe('');
    });
});
