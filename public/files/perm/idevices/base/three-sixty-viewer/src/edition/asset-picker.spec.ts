import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssetPicker } from './asset-picker';

type MutableGlobal = { eXeLearning?: unknown };

afterEach(() => {
    delete (globalThis as MutableGlobal).eXeLearning;
});

function installFileManager(show: unknown): void {
    (globalThis as MutableGlobal).eXeLearning = { app: { modals: { filemanager: { show } } } };
}

describe('createAssetPicker', () => {
    it('uses the eXeLearning file manager when available', () => {
        const show = vi.fn((options: { accept: string; onSelect: (result: { assetUrl?: string } | null) => void }) => {
            options.onSelect({ assetUrl: 'asset://picked.jpg' });
        });
        installFileManager(show);
        const picker = createAssetPicker(() => null);
        expect(picker.hasFileManager).toBe(true);
        const onSelect = vi.fn();
        picker.pick('image', onSelect);
        expect(show).toHaveBeenCalledWith(expect.objectContaining({ accept: 'image', multiSelect: false }));
        expect(onSelect).toHaveBeenCalledWith('asset://picked.jpg');
    });

    it('ignores cancelled or empty selections', () => {
        const show = vi.fn((options: { onSelect: (result: { assetUrl?: string } | null) => void }) => {
            options.onSelect(null);
            options.onSelect({});
        });
        installFileManager(show);
        const onSelect = vi.fn();
        createAssetPicker(() => null).pick('video', onSelect);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('falls back to clicking the hidden file input without a file manager', () => {
        const input = document.createElement('input');
        const click = vi.spyOn(input, 'click');
        const picker = createAssetPicker(() => input);
        expect(picker.hasFileManager).toBe(false);
        picker.pick('image', vi.fn());
        expect(click).toHaveBeenCalledTimes(1);
    });

    it('survives a missing fallback input', () => {
        createAssetPicker(() => null).pick('image', vi.fn());
    });
});
