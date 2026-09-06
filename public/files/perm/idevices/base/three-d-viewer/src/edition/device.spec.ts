import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionController, InteractionHooks } from '../interactions/types';
import type { AnimationSettings, ThreeDViewerDocumentV2 } from '../shared/types';
import { readFixture, resetDom, sequentialIds } from '../test/helpers';
import { createThreeDViewerDevice, type DeviceDependencies } from './device';
import type { EditorPreview } from './preview';

/**
 * A preview double: it records what the device asked for and lets a test drive
 * the callbacks the real preview would fire, so the editor is exercised without
 * a WebGL context or a `<model-viewer>` upgrade.
 */
interface PreviewSpy extends EditorPreview {
    readonly updates: Array<{ src: string; force: boolean }>;
    readonly attachments: ThreeDViewerDocumentV2[];
    readonly animations: AnimationSettings[];
    hooks: InteractionHooks | null;
    layer: InteractionController | null;
    fireLoaded(animations: readonly string[]): void;
    fireError(): void;
}

function createPreviewSpy(): {
    factory: DeviceDependencies['createPreview'];
    get: () => PreviewSpy;
    all: () => PreviewSpy[];
} {
    const created: PreviewSpy[] = [];
    const factory: DeviceDependencies['createPreview'] = (_container, callbacks) => {
        const updates: Array<{ src: string; force: boolean }> = [];
        const attachments: ThreeDViewerDocumentV2[] = [];
        const animations: AnimationSettings[] = [];
        const controller: InteractionController = {
            setState: vi.fn(),
            render: vi.fn(),
            enterPlacementMode: vi.fn(),
            exitPlacementMode: vi.fn(),
            focusMarker: vi.fn(),
            captureCamera: () => ({ orbit: '1 2 3', target: '0 0 0', fieldOfView: '45deg' }),
            next: vi.fn(),
            previous: vi.fn(),
            getActiveId: () => '',
            markerLabel: marker => marker.label,
            destroy: vi.fn(),
        };
        const preview: PreviewSpy = {
            updates,
            attachments,
            animations,
            hooks: null,
            layer: controller,
            mount: async () => {},
            update: async (document, force = false) => {
                updates.push({ src: document.src, force });
                animations.push(document.animation);
            },
            applyAnimation: animation => {
                animations.push(animation);
            },
            attachInteractions: async (document, hooks) => {
                attachments.push(document);
                preview.hooks = hooks;
                return document.interaction.enabled && document.src ? preview.layer : null;
            },
            getInteractions: () => preview.layer,
            syncInteractions: vi.fn(),
            nudgeCamera: vi.fn(),
            getModelViewer: () => null,
            resolveMediaUrl: url => url,
            destroy: vi.fn(),
            fireLoaded: animations => callbacks.onModelLoaded(animations),
            fireError: () => callbacks.onModelError(),
        };
        created.push(preview);
        return preview;
    };
    return {
        factory,
        get: () => {
            const latest = created[created.length - 1];
            if (!latest) {
                throw new Error('The preview was never created');
            }
            return latest;
        },
        all: () => created,
    };
}

function build(overrides: Partial<DeviceDependencies> = {}): {
    device: ReturnType<typeof createThreeDViewerDevice>;
    host: HTMLElement;
    preview: () => PreviewSpy;
    previews: () => PreviewSpy[];
    alerts: string[];
} {
    const alerts: string[] = [];
    const previewSpy = createPreviewSpy();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const device = createThreeDViewerDevice({
        translate: text => text,
        createId: sequentialIds(),
        createPreview: previewSpy.factory,
        alert: message => alerts.push(message),
        ...overrides,
    });
    return { device, host, preview: previewSpy.get, previews: previewSpy.all, alerts };
}

beforeEach(() => {
    globalThis.$exeDevicesEdition = undefined;
});

afterEach(() => {
    globalThis.$exeDevicesEdition = undefined;
    globalThis.eXeLearning = undefined;
    resetDom();
    vi.restoreAllMocks();
});

describe('init', () => {
    it('renders the editor and reflects a legacy document', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('legacy/unversioned.json'));

        expect(host.querySelector('#threeDViewerEditor')).not.toBeNull();
        expect(host.querySelector<HTMLInputElement>('#threeD3DModelFile')?.value).toBe(
            'asset://8f3c2a10-0b41-4f0f-9a1c-2b7d5e6f7a90.glb',
        );
        expect(host.querySelector<HTMLInputElement>('#threeDAlt')?.value).toBe('A cube');
        // Legacy content has no interactions, so the section stays collapsed.
        expect(host.querySelector<HTMLInputElement>('#threeDInteractionsEnable')?.checked).toBe(false);
        expect(host.querySelector<HTMLElement>('#threeDInteractionsBody')?.hidden).toBe(true);
        expect(host.querySelector('.tdv-marker-row')).toBeNull();
    });

    it('renders a schema-v2 document with its markers', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));
        expect(host.querySelector<HTMLElement>('#threeDInteractionsBody')?.hidden).toBe(false);
        expect(host.querySelectorAll('.tdv-marker-row')).toHaveLength(2);
        expect(host.querySelector('.tdv-marker-row-label')?.textContent).toBe('1. Summit — Information');
    });

    it('starts from the defaults with no previous data', async () => {
        const { device, host } = build();
        await device.init(host);
        expect(device.getDocument().schemaVersion).toBe(2);
        expect(host.querySelector<HTMLInputElement>('#threeD3DModelFile')?.value).toBe('');
    });

    it('refuses to open a document from a newer schema and shows why', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('schema-v2/future.json'));
        expect(host.querySelector('[data-unsupported-version="99"]')).not.toBeNull();
        expect(host.querySelector('#threeDViewerEditor')?.className).toContain('unsupported');
        expect(host.querySelector('#threeD3DModelFile')).toBeNull();
    });

    it('tears the previous preview down before rebuilding', async () => {
        const { device, host, previews } = build();
        await device.init(host, { src: 'asset://a.glb' });
        // Re-opening the same iDevice replaces the form markup; without this
        // teardown the previous WebGL context and animation loop would leak.
        await device.init(host, { src: 'asset://a.glb' });
        expect(previews()).toHaveLength(2);
        expect(previews()[0]?.destroy).toHaveBeenCalledTimes(1);
        expect(host.querySelectorAll('#threeDViewerEditor')).toHaveLength(1);
    });

    it('mirrors the model into the preview and attaches the interaction layer', async () => {
        const { device, host, preview } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));
        expect(preview().updates.at(-1)).toMatchObject({ force: true });
        await Promise.resolve();
        expect(preview().attachments.length).toBeGreaterThan(0);
    });
});

describe('save', () => {
    it('refuses to save without a model', async () => {
        const { device, host, alerts } = build();
        await device.init(host, {});
        expect(device.save()).toBe(false);
        expect(alerts).toContain('Please select a 3D model file');
    });

    it('refuses to save an unsupported file type', async () => {
        const { device, host, alerts } = build();
        await device.init(host, { src: 'asset://a.obj' });
        expect(device.save()).toBe(false);
        expect(alerts).toContain('Please select a valid 3D model file (GLB, GLTF, or STL)');
    });

    it('returns a normalized schema-v2 document', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));
        const saved = device.save() as ThreeDViewerDocumentV2;
        expect(saved.schemaVersion).toBe(2);
        expect(saved.interaction.markers).toHaveLength(2);
        expect(saved.scorm).toEqual({ mode: 1, weighted: 80, saveButtonText: '' });
    });

    it('picks up form edits made after init', async () => {
        const { device, host } = build();
        await device.init(host, { src: 'asset://a.glb' });
        host.querySelector<HTMLInputElement>('#threeDAlt')!.value = ' A cube ';
        host.querySelector<HTMLInputElement>('#threeDCameraControls')!.checked = false;
        const saved = device.save() as ThreeDViewerDocumentV2;
        expect(saved.alt).toBe('A cube');
        expect(saved.cameraControls).toBe(false);
    });

    it('never overwrites a document from a newer schema', async () => {
        const original = readFixture('schema-v2/future.json');
        const { device, host, alerts } = build();
        await device.init(host, original);
        expect(device.save()).toBe(original);
        expect(alerts[0]).toContain('newer version');
    });

    it('works before init, without a rendered form', () => {
        const { device, alerts } = build();
        expect(device.save()).toBe(false);
        expect(alerts).toContain('Please select a 3D model file');
    });
});

describe('set3DViewerJSON / get3DViewerJSON', () => {
    it('round-trips a document', () => {
        const { device } = build();
        device.set3DViewerJSON(readFixture('schema-v2/with-markers.json'));
        const serialized = device.get3DViewerJSON() as ThreeDViewerDocumentV2;
        expect(serialized.schemaVersion).toBe(2);
        expect(serialized.src).toBe('asset://8f3c2a10-0b41-4f0f-9a1c-2b7d5e6f7a90.glb');
    });

    it('recovers an asset:// handle from a blob URL through AssetManager', () => {
        globalThis.eXeLearning = {
            app: {
                project: {
                    assetManager: {
                        reverseBlobCache: { get: () => 'uuid' },
                        getAssetMetadata: () => ({ filename: 'Cube.GLB' }),
                    },
                },
            },
        };
        const { device } = build();
        device.set3DViewerJSON({ schemaVersion: 2, src: 'blob:http://x/1' });
        expect(device.getDocument().src).toBe('asset://uuid.glb');
    });

    it('drops a stale blob URL that cannot be recovered', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { device } = build();
        device.set3DViewerJSON({ schemaVersion: 2, src: 'blob:http://x/1' });
        expect(device.getDocument().src).toBe('');
        expect(warn).toHaveBeenCalled();
    });

    it('never serializes a blob URL', () => {
        const { device } = build();
        device.set3DViewerJSON({ schemaVersion: 2, src: 'blob:http://x/1' });
        expect((device.get3DViewerJSON() as ThreeDViewerDocumentV2).src).toBe('');
    });

    it('returns the original for a document from a newer schema', () => {
        const original = readFixture('schema-v2/future.json');
        const { device } = build();
        device.set3DViewerJSON(original);
        expect(device.getHydration().status).toBe('unsupported-version');
        expect(device.get3DViewerJSON()).toBe(original);
    });
});

describe('interaction authoring', () => {
    it('reveals the interaction body when the author enables interactions', async () => {
        const { device, host } = build();
        await device.init(host, { src: 'asset://a.glb' });
        const toggle = host.querySelector<HTMLInputElement>('#threeDInteractionsEnable');
        toggle!.checked = true;
        toggle?.dispatchEvent(new Event('change'));
        expect(host.querySelector<HTMLElement>('#threeDInteractionsBody')?.hidden).toBe(false);
        expect(device.getDocument().interaction.enabled).toBe(true);
    });

    it('syncs the guided, wrap and label flags into the live preview', async () => {
        const { device, host, preview } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));
        for (const [id, key] of [
            ['#threeDGuidedMode', 'guidedMode'],
            ['#threeDWrapNavigation', 'wrapNavigation'],
            ['#threeDShowMarkerLabels', 'showMarkerLabels'],
        ] as const) {
            const input = host.querySelector<HTMLInputElement>(id);
            input!.checked = true;
            input?.dispatchEvent(new Event('change'));
            expect(device.getDocument().interaction[key]).toBe(true);
        }
        expect(preview().syncInteractions).toHaveBeenCalled();
    });

    it('disables Add marker until a model is chosen', async () => {
        const { device, host } = build();
        await device.init(host, {});
        expect(host.querySelector<HTMLButtonElement>('#threeDAddMarker')?.disabled).toBe(true);

        const picker = host.querySelector<HTMLInputElement>('#threeD3DModelFile');
        picker!.value = 'asset://a.glb';
        picker?.dispatchEvent(new Event('change'));
        await Promise.resolve();
        expect(host.querySelector<HTMLButtonElement>('#threeDAddMarker')?.disabled).toBe(false);
        expect(device.getDocument().src).toBe('asset://a.glb');
    });

    it('refuses a blob URL from the file picker', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { device, host } = build();
        await device.init(host, { src: 'asset://kept.glb' });
        const picker = host.querySelector<HTMLInputElement>('#threeD3DModelFile');
        picker!.value = 'blob:http://x/1';
        picker?.dispatchEvent(new Event('change'));
        await Promise.resolve();
        expect(device.getDocument().src).toBe('asset://kept.glb');
        expect(picker?.value).toBe('asset://kept.glb');
        expect(warn).toHaveBeenCalled();
    });

    it('enters placement mode from the Add marker button, enabling interactions', async () => {
        const { device, host, preview } = build();
        await device.init(host, { src: 'asset://a.glb' });
        host.querySelector<HTMLButtonElement>('#threeDAddMarker')?.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(device.getDocument().interaction.enabled).toBe(true);
        expect(preview().layer?.enterPlacementMode).toHaveBeenCalled();
        expect(host.querySelector<HTMLElement>('#threeDPlacementHint')?.hidden).toBe(false);
    });

    it('adds a normalized marker on placement and opens its editor', async () => {
        const { device, host } = build();
        await device.init(host, { src: 'asset://a.glb' });
        device.handleMarkerPlaced({
            position: { x: 1, y: 2, z: 3 },
            normal: { x: 0, y: 0, z: 1 },
            surface: '',
            camera: { orbit: '', target: '', fieldOfView: '' },
        });

        const markers = device.getDocument().interaction.markers;
        expect(markers).toHaveLength(1);
        expect(markers[0]?.anchor.position).toEqual({ x: 1, y: 2, z: 3 });
        expect(markers[0]?.action.type).toBe('information');
        expect(host.querySelector('#threeDMarkerEditorHost .tdv-marker-editor')).not.toBeNull();
        expect(host.querySelector<HTMLElement>('#threeDPlacementHint')?.hidden).toBe(true);
    });

    it('saves an edited marker back into the document', async () => {
        const { device, host } = build();
        await device.init(host, { src: 'asset://a.glb' });
        device.handleMarkerPlaced({
            position: { x: 0, y: 0, z: 0 },
            normal: { x: 0, y: 1, z: 0 },
            surface: '',
            camera: { orbit: '', target: '', fieldOfView: '' },
        });
        host.querySelector<HTMLInputElement>('#tdvMkLabel')!.value = 'Summit';
        host.querySelector<HTMLButtonElement>('#threeDMarkerEditorHost [data-save]')?.click();

        expect(device.getDocument().interaction.markers[0]?.label).toBe('Summit');
        expect(host.querySelector('.tdv-marker-row-label')?.textContent).toContain('Summit');
    });

    it('reorders and deletes markers, keeping order contiguous', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));

        host.querySelectorAll<HTMLButtonElement>('.tdv-marker-row .tdv-move-down')[0]?.click();
        expect(device.getDocument().interaction.markers.map(marker => marker.id)).toEqual([
            'marker-quiz',
            'marker-summit',
        ]);

        host.querySelectorAll<HTMLButtonElement>('.tdv-marker-row .tdv-delete-marker')[0]?.click();
        const markers = device.getDocument().interaction.markers;
        expect(markers.map(marker => marker.id)).toEqual(['marker-summit']);
        expect(markers.map(marker => marker.order)).toEqual([0]);
    });

    it('closes the editor when the marker being edited is deleted', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));
        host.querySelectorAll<HTMLButtonElement>('.tdv-edit-marker')[0]?.click();
        expect(host.querySelector('.tdv-marker-editor')).not.toBeNull();
        host.querySelectorAll<HTMLButtonElement>('.tdv-delete-marker')[0]?.click();
        expect(host.querySelector('.tdv-marker-editor')).toBeNull();
    });

    it('captures the preview camera into the marker being edited', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));
        host.querySelectorAll<HTMLButtonElement>('.tdv-edit-marker')[1]?.click();
        host.querySelector<HTMLButtonElement>('[data-capture-camera]')?.click();
        host.querySelector<HTMLButtonElement>('#threeDMarkerEditorHost [data-save]')?.click();
        expect(device.getDocument().interaction.markers[1]?.camera.orbit).toBe('1 2 3');
    });

    it('preserves markers when a display option changes', async () => {
        const { device, host } = build();
        await device.init(host, readFixture('schema-v2/with-markers.json'));
        const background = host.querySelector<HTMLInputElement>('#threeDBackground');
        background!.value = '#123456';
        background?.dispatchEvent(new Event('change'));
        expect(device.getDocument().interaction.markers).toHaveLength(2);
        expect(device.getDocument().backgroundColor).toBe('#123456');
    });

    it('shows the SCORM section only once a question marker exists', async () => {
        globalThis.$exeDevicesEdition = {
            iDevice: {
                gamification: {
                    scorm: { getTab: () => '<div class="scorm-tab"></div>', init: vi.fn(), setValues: vi.fn() },
                },
            },
        };
        const { device, host } = build();
        await device.init(host, { schemaVersion: 2, src: 'asset://a.glb', interaction: { enabled: true } });
        expect(host.querySelector<HTMLElement>('#threeDScormSection')?.hidden).toBe(true);

        await device.init(host, readFixture('schema-v2/with-markers.json'));
        expect(host.querySelector<HTMLElement>('#threeDScormSection')?.hidden).toBe(false);
        expect(host.querySelector('.scorm-tab')).not.toBeNull();
    });
});

describe('display behaviour', () => {
    it('keeps auto-rotate and nav controls mutually exclusive', async () => {
        const { device, host } = build();
        await device.init(host, { src: 'asset://a.glb' });
        const autoRotate = host.querySelector<HTMLInputElement>('#threeDAutoRotate');
        const navControls = host.querySelector<HTMLInputElement>('#threeDShowNavControls');

        navControls!.checked = true;
        navControls?.dispatchEvent(new Event('change'));
        expect(autoRotate?.checked).toBe(false);
        expect(device.getDocument().showNavControls).toBe(true);

        autoRotate!.checked = true;
        autoRotate?.dispatchEvent(new Event('change'));
        expect(navControls?.checked).toBe(false);
        expect(device.getDocument().autoRotate).toBe(true);
    });

    it('populates the animation picker once the model reports its animations', async () => {
        const { device, host, preview } = build();
        await device.init(host, { src: 'asset://a.glb' });
        preview().fireLoaded(['Spin', 'Bounce']);
        expect(host.querySelectorAll('#threeDAnimationName option')).toHaveLength(2);
        expect(device.getDocument().animation.name).toBe('Spin');
    });

    it('applies the resolved animation to the preview once the model has loaded', async () => {
        const { device, host, preview } = build();
        await device.init(host, {
            schemaVersion: 2,
            src: 'asset://a.glb',
            animation: { enabled: true, name: 'Bounce', speed: 2 },
        });
        preview().fireLoaded(['Spin', 'Bounce']);
        expect(preview().animations.at(-1)).toMatchObject({ enabled: true, name: 'Bounce', speed: 2 });
    });

    it('retries a failed preview a bounded number of times', async () => {
        vi.useFakeTimers();
        try {
            const { device, host, preview } = build();
            await device.init(host, { src: 'asset://a.glb' });
            const before = preview().updates.length;
            for (let i = 0; i < 5; i += 1) {
                preview().fireError();
                vi.advanceTimersByTime(2000);
            }
            expect(preview().updates.length - before).toBe(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not retry when there is no model to load', async () => {
        vi.useFakeTimers();
        try {
            const { device, host, preview } = build();
            await device.init(host, {});
            const before = preview().updates.length;
            preview().fireError();
            vi.advanceTimersByTime(2000);
            expect(preview().updates.length).toBe(before);
        } finally {
            vi.useRealTimers();
        }
    });

    it('nudges the preview camera from the arrow pad', async () => {
        const { device, host, preview } = build();
        await device.init(host, { src: 'asset://a.glb' });
        host.querySelector<HTMLButtonElement>('[data-nav="right"]')?.click();
        expect(preview().nudgeCamera).toHaveBeenCalledWith(expect.any(Number), 0);
    });
});

describe('device identity', () => {
    it('exposes the translated name', () => {
        const { device } = build({ translate: text => `~${text}` });
        expect(device.name).toBe('~3D Viewer');
        expect(device.i18n.name).toBe('~3D Viewer');
    });
});
