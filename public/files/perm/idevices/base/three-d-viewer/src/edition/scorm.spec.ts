import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, makeMarker, resetDom, sequentialIds } from '../test/helpers';
import { createScormSection, getScormEdition, shouldShowScormSection } from './scorm';

function installFramework(overrides: Partial<ExeScormEdition> = {}): ExeScormEdition {
    const framework: ExeScormEdition = {
        getTab: () => '<div class="scorm-tab"></div>',
        init: vi.fn(),
        setValues: vi.fn(),
        getValues: () => ({ isScorm: 2, weighted: 70, textButtonScorm: 'Send' }),
        ...overrides,
    };
    globalThis.$exeDevicesEdition = { iDevice: { gamification: { scorm: framework } } };
    return framework;
}

afterEach(() => {
    globalThis.$exeDevicesEdition = undefined;
    resetDom();
    vi.restoreAllMocks();
});

describe('getScormEdition', () => {
    it('finds the framework, or reports its absence', () => {
        const framework = installFramework();
        expect(getScormEdition()).toBe(framework);
        globalThis.$exeDevicesEdition = undefined;
        expect(getScormEdition()).toBeNull();
    });
});

describe('shouldShowScormSection', () => {
    const question = makeMarker({ id: 'q', action: { type: 'question', payload: {} } }, 0, sequentialIds());
    const info = makeMarker({ id: 'i' }, 0, sequentialIds());

    it('is visible only with interactions on and at least one question', () => {
        expect(shouldShowScormSection(true, [question])).toBe(true);
        expect(shouldShowScormSection(true, [info])).toBe(false);
        expect(shouldShowScormSection(false, [question])).toBe(false);
        expect(shouldShowScormSection(true, [])).toBe(false);
    });
});

describe('createScormSection', () => {
    it('mounts the framework tab and reflects the stored configuration', () => {
        const framework = installFramework();
        const host = createWrapper();
        const section = createScormSection(host);
        section.render({ mode: 1, weighted: 80, saveButtonText: '' }, 'Save score');
        expect(host.querySelector('.scorm-tab')).not.toBeNull();
        expect(framework.init).toHaveBeenCalled();
        expect(framework.setValues).toHaveBeenCalledWith(1, 'Save score', true, 80);
        expect(section.isRendered()).toBe(true);
    });

    it('keeps a stored button label instead of the default', () => {
        const framework = installFramework();
        const section = createScormSection(createWrapper());
        section.render({ mode: 1, weighted: 100, saveButtonText: 'Enviar' }, 'Save score');
        expect(framework.setValues).toHaveBeenCalledWith(1, 'Enviar', true, 100);
    });

    it('reads the tab back into the canonical shape', () => {
        installFramework();
        const section = createScormSection(createWrapper());
        section.render({ mode: 0, weighted: 100, saveButtonText: '' }, 'Save score');
        expect(section.read({ mode: 0, weighted: 100, saveButtonText: '' })).toEqual({
            mode: 2,
            weighted: 70,
            saveButtonText: 'Send',
        });
    });

    it('preserves the stored values when the tab was never mounted', () => {
        installFramework();
        const section = createScormSection(createWrapper());
        const stored = { mode: 1, weighted: 55, saveButtonText: 'Keep' } as const;
        expect(section.read(stored)).toEqual(stored);
    });

    it('preserves the stored values when the framework throws or returns nothing', () => {
        installFramework({
            getValues: () => {
                throw new Error('not ready');
            },
        });
        const section = createScormSection(createWrapper());
        section.render({ mode: 1, weighted: 55, saveButtonText: '' }, 'Save score');
        expect(section.read({ mode: 1, weighted: 55, saveButtonText: '' }).weighted).toBe(55);

        installFramework({ getValues: () => null });
        const other = createScormSection(createWrapper());
        other.render({ mode: 1, weighted: 40, saveButtonText: '' }, 'Save score');
        expect(other.read({ mode: 1, weighted: 40, saveButtonText: '' }).weighted).toBe(40);
    });

    it('degrades silently when the framework is missing or its tab throws', () => {
        globalThis.$exeDevicesEdition = undefined;
        const host = createWrapper();
        const section = createScormSection(host);
        section.render({ mode: 1, weighted: 100, saveButtonText: '' }, 'Save score');
        expect(section.isRendered()).toBe(false);
        expect(host.innerHTML).toBe('');

        installFramework({
            getTab: () => {
                throw new Error('broken');
            },
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        section.render({ mode: 1, weighted: 100, saveButtonText: '' }, 'Save score');
        expect(section.isRendered()).toBe(false);
        expect(warn).toHaveBeenCalled();
    });

    it('resets back to unmounted', () => {
        installFramework();
        const host = createWrapper();
        const section = createScormSection(host);
        section.render({ mode: 1, weighted: 100, saveButtonText: '' }, 'Save score');
        section.reset();
        expect(section.isRendered()).toBe(false);
        expect(host.innerHTML).toBe('');
    });
});
