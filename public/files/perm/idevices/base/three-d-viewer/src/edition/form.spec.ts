import { afterEach, describe, expect, it } from 'vitest';
import { makeDocument, resetDom, sequentialIds } from '../test/helpers';
import { collectElements, renderEditorMarkup, type EditorElements } from './editor';
import {
    applyDocumentToForm,
    readDisplaySettings,
    updateAnimationOptions,
    updateAutoRotateSpeedState,
    updateEmptyState,
    updateModelColorFieldState,
    updateNavControlsVisibility,
} from './form';

const t = (text: string): string => text;

function mount(): EditorElements {
    const root = document.createElement('div');
    root.innerHTML = renderEditorMarkup(t);
    document.body.appendChild(root);
    return collectElements(root);
}

afterEach(resetDom);

describe('applyDocumentToForm / readDisplaySettings', () => {
    it('round-trips the display settings through the form', () => {
        const elements = mount();
        const document = makeDocument(
            {
                src: 'asset://a.stl',
                alt: 'Cube',
                modelColor: '#aabbcc',
                backgroundColor: '#ffffff',
                cameraControls: false,
                autoRotate: true,
                autoRotateSpeed: 45,
                animation: { enabled: true, name: '', speed: 2 },
            },
            sequentialIds(),
        );
        applyDocumentToForm(elements, document);

        expect(elements.src.value).toBe('asset://a.stl');
        expect(elements.alt.value).toBe('Cube');
        expect(elements.cameraControls.checked).toBe(false);
        expect(elements.autoRotate.checked).toBe(true);

        expect(readDisplaySettings(elements, document.src)).toMatchObject({
            src: 'asset://a.stl',
            alt: 'Cube',
            modelColor: '#aabbcc',
            backgroundColor: '#ffffff',
            cameraControls: false,
            autoRotate: true,
            autoRotateSpeed: 45,
        });
    });

    it('mirrors the interaction flags into the form', () => {
        const elements = mount();
        const document = makeDocument(
            {
                interaction: { enabled: true, guidedMode: true, wrapNavigation: true, showMarkerLabels: false },
            },
            sequentialIds(),
        );
        applyDocumentToForm(elements, document);
        expect(elements.interactionsEnable.checked).toBe(true);
        expect(elements.guidedMode.checked).toBe(true);
        expect(elements.wrapNavigation.checked).toBe(true);
        expect(elements.showMarkerLabels.checked).toBe(false);
    });

    it('lets nav controls win over auto-rotation when reading back', () => {
        const elements = mount();
        elements.showNavControls.checked = true;
        elements.autoRotate.checked = true;
        expect(readDisplaySettings(elements, '').autoRotate).toBe(false);
    });

    it('keeps the stored source when the read-only picker field is empty', () => {
        const elements = mount();
        expect(readDisplaySettings(elements, 'asset://kept.glb').src).toBe('asset://kept.glb');
    });

    it('normalizes the colours and clamps the animation speed', () => {
        const elements = mount();
        // The colour input always yields hex; normalization guarantees the
        // canonical lowercase form regardless of what the browser reports.
        elements.modelColor.value = '#AABBCC';
        elements.animationSpeed.value = '99';
        const settings = readDisplaySettings(elements, '');
        expect(settings.modelColor).toBe('#aabbcc');
        expect(settings.animation.speed).toBe(3);

        elements.animationSpeed.value = 'abc';
        expect(readDisplaySettings(elements, '').animation.speed).toBe(1);
        expect(readDisplaySettings(elements, '').autoRotateSpeed).toBe(30);
    });
});

describe('updateAutoRotateSpeedState', () => {
    it('shows the speed control only while auto-rotation is on', () => {
        const elements = mount();
        elements.autoRotate.checked = true;
        updateAutoRotateSpeedState(elements);
        expect(elements.autoRotateSpeed.disabled).toBe(false);
        expect(elements.autoRotateSpeedRow.style.display).toBe('');

        elements.autoRotate.checked = false;
        updateAutoRotateSpeedState(elements);
        expect(elements.autoRotateSpeed.disabled).toBe(true);
        expect(elements.autoRotateSpeedRow.style.display).toBe('none');
    });
});

describe('updateModelColorFieldState', () => {
    it('enables the colour picker for STL and explains why it is off otherwise', () => {
        const elements = mount();
        updateModelColorFieldState(elements, 'asset://a.stl', t);
        expect(elements.modelColor.disabled).toBe(false);
        expect(elements.modelColor.title).toBe('Choose STL model color');

        updateModelColorFieldState(elements, 'asset://a.glb', t);
        expect(elements.modelColor.disabled).toBe(true);
        expect(elements.modelColor.title).toBe('Only STL files use this color; the current file is not STL');
    });
});

describe('updateNavControlsVisibility', () => {
    it('shows or hides the preview chrome', () => {
        const elements = mount();
        updateNavControlsVisibility(elements, false);
        expect(elements.preview.querySelector<HTMLElement>('[data-fullscreen]')?.style.display).toBe('none');
        updateNavControlsVisibility(elements, true);
        expect(elements.preview.querySelector<HTMLElement>('.three-d-viewer-nav')?.style.display).toBe('');
    });
});

describe('updateEmptyState', () => {
    it('shows the overlay only when there is no model', () => {
        const elements = mount();
        updateEmptyState(elements, '');
        expect(elements.preview.querySelector<HTMLElement>('[data-empty-state]')?.style.display).toBe('grid');
        updateEmptyState(elements, 'asset://a.glb');
        expect(elements.preview.querySelector<HTMLElement>('[data-empty-state]')?.style.display).toBe('none');
    });
});

describe('updateAnimationOptions', () => {
    it('fills the picker and reveals the animation section', () => {
        const elements = mount();
        const next = updateAnimationOptions(elements, ['Spin', 'Bounce'], { enabled: true, name: '', speed: 1 });
        expect(elements.animationName.querySelectorAll('option')).toHaveLength(2);
        expect(elements.animationName.value).toBe('Spin');
        expect(elements.animationRow.hidden).toBe(false);
        expect(elements.animationToggle.disabled).toBe(false);
        expect(next.name).toBe('Spin');
    });

    it('keeps the stored animation when the model still offers it', () => {
        const elements = mount();
        const next = updateAnimationOptions(elements, ['Spin', 'Bounce'], { enabled: true, name: 'Bounce', speed: 1 });
        expect(next.name).toBe('Bounce');
        expect(elements.animationName.value).toBe('Bounce');
    });

    it('hides and disables the section when the model has no animation', () => {
        const elements = mount();
        const next = updateAnimationOptions(elements, [], { enabled: true, name: 'Spin', speed: 1 });
        expect(elements.animationRow.hidden).toBe(true);
        expect(elements.animationToggle.disabled).toBe(true);
        expect(elements.animationToggle.checked).toBe(false);
        expect(next).toMatchObject({ enabled: false, name: '' });
    });
});
