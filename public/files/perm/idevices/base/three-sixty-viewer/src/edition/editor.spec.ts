import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import type { ThreeSixtyDocumentV2 } from '../shared/types';
import { createManualScheduler } from '../test/helpers';
import { createEditor } from './editor';

const identity = (text: string): string => text;

afterEach(() => {
    document.body.innerHTML = '';
});

function docFrom(input: unknown): ThreeSixtyDocumentV2 {
    const result = hydrateDocument(input, createSequentialIdGenerator());
    if (result.status !== 'ok') throw new Error('fixture');
    return result.document;
}

function makeEditor(input: unknown = null, options: { confirm?: (message: string) => boolean } = {}) {
    const body = document.createElement('div');
    body.setAttribute('idevice-id', 'idev-editor-test');
    document.body.appendChild(body);
    const manual = createManualScheduler();
    const editor = createEditor(body, docFrom(input), '/base/edition/', {
        translate: identity,
        ids: createSequentialIdGenerator(),
        confirm: options.confirm ?? (() => true),
        scheduler: manual.scheduler,
        loadThree: vi.fn(),
        reducedMotion: false,
    });
    return { body, editor, manual };
}

function click(body: HTMLElement, selector: string): void {
    const element = body.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`missing ${selector}`);
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('createEditor — form and scenes', () => {
    it('builds the form with one default scene from empty data', () => {
        const { body, editor } = makeEditor();
        expect(body.querySelector('#threeSixtySceneList .three-sixty-scene-item')).toBeTruthy();
        expect(body.querySelectorAll('.three-sixty-scene-item')).toHaveLength(1);
        expect(body.querySelector<HTMLInputElement>('#threeSixtyYaw')?.value).toBe('0');
        expect(body.querySelector<HTMLInputElement>('#threeSixtyFov')?.value).toBe('75');
        editor.destroy();
    });

    it('adds, selects and removes scenes, keeping start scene and fields in sync', () => {
        const { body, editor } = makeEditor();
        click(body, '#threeSixtyAddScene');
        expect(body.querySelectorAll('.three-sixty-scene-item')).toHaveLength(2);
        // The new scene became active.
        expect(editor.state.activeSceneIndex).toBe(1);
        expect(body.querySelector<HTMLInputElement>('#threeSixtySceneTitle')?.value).toBe('Scene 2');

        // Set it as the start scene.
        click(body, '.three-sixty-scene-item:nth-child(2) [data-action="set-start"]');
        expect(editor.state.doc.startSceneId).toBe(editor.state.doc.scenes[1]?.id);

        // Select the first scene again.
        click(body, '.three-sixty-scene-item:first-child [data-action="select"]');
        expect(editor.state.activeSceneIndex).toBe(0);

        // Remove the second scene (confirm() returns true).
        click(body, '.three-sixty-scene-item:nth-child(2) [data-action="remove"]');
        expect(body.querySelectorAll('.three-sixty-scene-item')).toHaveLength(1);
        expect(editor.state.doc.startSceneId).toBe(editor.state.doc.scenes[0]?.id);
        editor.destroy();
    });

    it('scene removal is aborted when the confirmation is declined', () => {
        const confirm = vi.fn().mockReturnValue(false);
        const { body, editor } = makeEditor(null, { confirm });
        click(body, '#threeSixtyAddScene');
        click(body, '.three-sixty-scene-item:nth-child(2) [data-action="remove"]');
        expect(confirm).toHaveBeenCalled();
        expect(body.querySelectorAll('.three-sixty-scene-item')).toHaveLength(2);
        editor.destroy();
    });

    it('duplicating copies the scene below the original', () => {
        const { body, editor } = makeEditor({ version: 2, scenes: [{ id: 'a', title: 'Original' }] });
        click(body, '.three-sixty-scene-item:first-child [data-action="duplicate"]');
        expect(editor.state.doc.scenes).toHaveLength(2);
        expect(editor.state.doc.scenes[1]?.title).toBe('Original (copy)');
        editor.destroy();
    });

    it('the projection toggle rebuilds the form for flat editing', () => {
        const { body, editor } = makeEditor();
        const toggle = body.querySelector<HTMLInputElement>('#threeSixtyIsPanorama');
        if (!toggle) throw new Error('missing toggle');
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(editor.state.activeScene().projection).toBe('flat');
        expect(body.querySelector('#threeSixtyYaw')).toBeNull();
        expect(body.querySelector('#threeSixtyIsPanorama')).toBeTruthy();
        editor.destroy();
    });
});

describe('createEditor — hotspots', () => {
    it('adds a hotspot through the list button (panorama uses the camera pose)', () => {
        const { body, editor } = makeEditor();
        click(body, '#threeSixtyAddHotspot');
        expect(editor.state.activeScene().hotspots).toHaveLength(1);
        expect(body.querySelectorAll('.three-sixty-hotspot-item')).toHaveLength(1);
        expect(body.querySelector('#threeSixtyStatus')?.textContent).toBe('Hotspot added.');
        editor.destroy();
    });

    it('adds a centred hotspot on flat scenes through the list button', () => {
        const { body, editor } = makeEditor({ version: 2, scenes: [{ id: 'a', projection: 'flat', src: 'x.jpg' }] });
        click(body, '#threeSixtyAddHotspot');
        const hotspot = editor.state.hotspotAt(0);
        expect(hotspot?.x).toBe(50);
        expect(hotspot?.y).toBe(50);
        expect(body.querySelector('.hotspot-x')).toBeTruthy();
        editor.destroy();
    });

    it('toggles placement mode from the button with aria-pressed feedback', () => {
        const { body, editor } = makeEditor();
        const button = body.querySelector('#threeSixtyPlaceHotspot');
        click(body, '#threeSixtyPlaceHotspot');
        expect(button?.getAttribute('aria-pressed')).toBe('true');
        expect(body.querySelector('#threeSixtyStatus')?.textContent).toContain('Placement mode on');
        // Escape cancels.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(button?.getAttribute('aria-pressed')).toBe('false');
        editor.destroy();
    });

    it('placement clicks on a flat preview create and select a hotspot', () => {
        const { body, editor } = makeEditor({
            version: 2,
            scenes: [{ id: 'a', projection: 'flat', src: 'photo.jpg' }],
        });
        const stage = body.querySelector<HTMLElement>('#threeSixtyPreview');
        if (!stage) throw new Error('missing stage');
        stage.getBoundingClientRect = () =>
            ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        click(body, '#threeSixtyPlaceHotspot');
        const image = stage.querySelector('img');
        if (!image) throw new Error('missing preview image');
        Object.defineProperty(image, 'naturalWidth', { value: 400, configurable: true });
        Object.defineProperty(image, 'naturalHeight', { value: 400, configurable: true });
        image.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 300 }));
        expect(editor.state.activeScene().hotspots).toHaveLength(1);
        expect(editor.state.hotspotAt(0)?.x).toBe(25);
        expect(editor.state.hotspotAt(0)?.y).toBe(75);
        expect(editor.state.selectedHotspotIndex).toBe(0);
        // Placement mode ended and was announced.
        expect(body.querySelector('#threeSixtyPlaceHotspot')?.getAttribute('aria-pressed')).toBe('false');
        expect(body.querySelector('#threeSixtyStatus')?.textContent).toBe('Hotspot placed.');
        editor.destroy();
    });
});

describe('createEditor — saving', () => {
    it('save returns the normalized v2 document with the body ideviceId', () => {
        const { body, editor } = makeEditor({ src: 'legacy.jpg', alt: 'Legacy' });
        const altInput = body.querySelector<HTMLInputElement>('#threeSixtyAlt');
        if (altInput) {
            altInput.value = 'Edited alt';
            altInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const saved = editor.save() as { version: number; ideviceId: string; scenes: Array<{ alt: string; src: string }> };
        expect(saved).not.toBe(false);
        expect(saved.version).toBe(2);
        expect(saved.ideviceId).toBe('idev-editor-test');
        expect(saved.scenes[0]?.src).toBe('legacy.jpg');
        expect(saved.scenes[0]?.alt).toBe('Edited alt');
        expect(body.querySelector('#threeSixtyStatus')?.textContent).toBe('Saved.');
        editor.destroy();
    });

    it('save returns false when a link hotspot has an unsafe URL', () => {
        const { body, editor } = makeEditor();
        click(body, '#threeSixtyAddHotspot');
        editor.state.setHotspotActionType(0, 'link');
        const hotspot = editor.state.hotspotAt(0);
        if (hotspot?.action.type === 'link') hotspot.action.payload.url = 'javascript:alert(1)';
        expect(editor.save()).toBe(false);
        editor.destroy();
    });
});

describe('createEditor — assets and selection', () => {
    afterEach(() => {
        delete (globalThis as { eXeLearning?: unknown }).eXeLearning;
    });

    function installFileManager(assetUrl: string): void {
        (globalThis as { eXeLearning?: unknown }).eXeLearning = {
            app: {
                modals: {
                    filemanager: {
                        show: (options: { onSelect: (result: { assetUrl?: string }) => void }) =>
                            options.onSelect({ assetUrl }),
                    },
                },
            },
        };
    }

    it('picks the scene image through the file manager', () => {
        const { body, editor } = makeEditor();
        installFileManager('asset://picked-scene.jpg');
        click(body, '#threeSixtyImageButton');
        expect(editor.state.activeScene().src).toBe('asset://picked-scene.jpg');
        expect(body.querySelector('#threeSixtyImageName')?.textContent).toBe('asset://picked-scene.jpg');
        editor.destroy();
    });

    it('reads a fallback file into a data URL for the scene image', async () => {
        const { body, editor } = makeEditor();
        const input = body.querySelector<HTMLInputElement>('#threeSixtyImageFile');
        if (!input) throw new Error('missing file input');
        const file = new File(['fake-bytes'], 'p.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await expect
            .poll(() => editor.state.activeScene().src.startsWith('data:'), { timeout: 3000 })
            .toBe(true);
        editor.destroy();
    });

    it('picks hotspot media through the file manager', () => {
        const { body, editor } = makeEditor();
        click(body, '#threeSixtyAddHotspot');
        installFileManager('asset://hotspot-image.jpg');
        // Switch the expanded row to "image" so the Choose image… control appears.
        const actionType = body.querySelector<HTMLSelectElement>('.hotspot-action-type');
        if (!actionType) throw new Error('missing action type');
        actionType.value = 'image';
        actionType.dispatchEvent(new Event('change', { bubbles: true }));
        const pick = body.querySelector<HTMLButtonElement>('.hotspot-payload-pickImage');
        if (!pick) throw new Error('missing pick button');
        pick.click();
        const hotspot = editor.state.hotspotAt(0);
        expect(hotspot?.action.type === 'image' && hotspot.action.payload.src).toBe('asset://hotspot-image.jpg');
        editor.destroy();
    });

    it('clicking a hotspot row header selects it; Done collapses the editor', () => {
        const { body, editor } = makeEditor();
        click(body, '#threeSixtyAddHotspot');
        click(body, '#threeSixtyAddHotspot');
        // Second hotspot is selected after add; switch to the first via its header.
        click(body, '.three-sixty-hotspot-item[data-hotspot-index="0"] .three-sixty-hotspot-select');
        expect(editor.state.selectedHotspotIndex).toBe(0);
        expect(body.querySelector('.three-sixty-hotspot-item.is-selected')?.getAttribute('data-hotspot-index')).toBe(
            '0',
        );
        expect(body.querySelector('.three-sixty-hotspot-detail')).toBeTruthy();
        // Done collapses the accordion (Interactive Video pattern).
        click(body, '.three-sixty-hotspot-done');
        expect(editor.state.selectedHotspotIndex).toBe(-1);
        expect(body.querySelector('.three-sixty-hotspot-detail')).toBeNull();
        editor.destroy();
    });

    it('editing the scene title live-updates the scene list', () => {
        const { body, editor } = makeEditor();
        const title = body.querySelector<HTMLInputElement>('#threeSixtySceneTitle');
        if (!title) throw new Error('missing title');
        title.value = 'Renamed scene';
        title.dispatchEvent(new Event('input', { bubbles: true }));
        expect(body.querySelector('#threeSixtySceneList')?.textContent).toContain('Renamed scene');
        editor.destroy();
    });

    it('behaviour toggles reach the state through the wired controls', () => {
        const { body, editor } = makeEditor();
        const zoom = body.querySelector<HTMLInputElement>('#threeSixtyZoom');
        if (!zoom) throw new Error('missing zoom');
        zoom.checked = false;
        zoom.dispatchEvent(new Event('change', { bubbles: true }));
        expect(editor.state.doc.behaviour.zoomEnabled).toBe(false);
        editor.destroy();
    });
});

describe('createEditor — lifecycle', () => {
    it('destroy() releases the placement Escape listener', () => {
        const { body, editor } = makeEditor();
        click(body, '#threeSixtyPlaceHotspot');
        editor.destroy();
        // After destroy, Escape no longer reaches a controller (no crash, no
        // state flip on the dead form).
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(body.querySelector('#threeSixtyPlaceHotspot')?.getAttribute('aria-pressed')).toBe('true');
    });
});
