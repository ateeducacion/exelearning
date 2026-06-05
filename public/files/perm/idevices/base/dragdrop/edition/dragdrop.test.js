/**
 * Unit tests for Drag and drop iDevice export helpers.
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('dragdrop iDevice export helpers', () => {
    let $exeDevice;
    let downloadBlob;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'dragdrop.js'));
        downloadBlob = vi.fn(() => true);
        global.$exeDevicesEdition.iDevice.gamification.share = { downloadBlob };
    });

    it('exports question text with the dragdrop filename and container', () => {
        vi.spyOn($exeDevice, 'validateData').mockReturnValue({
            wordsGame: [{ word: 'Source', definition: 'Target' }],
        });

        expect($exeDevice.exportQuestions()).toBe(true);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(downloadBlob.mock.calls[0][1]).toBe('words-dragdrop.txt');
        expect(downloadBlob.mock.calls[0][2]).toBe('dragdropQIdeviceForm');
    });

    it('exports game JSON with the dragdrop filename and container', () => {
        const dataGame = { wordsGame: [{ word: 'Source', definition: 'Target' }] };
        vi.spyOn($exeDevice, 'validateData').mockReturnValue(dataGame);

        expect($exeDevice.exportGame()).toBe(true);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(downloadBlob.mock.calls[0][1]).toBe('Activity-DragDrop.json');
        expect(downloadBlob.mock.calls[0][2]).toBe('dragdropQIdeviceForm');
    });

    it('escapes every percent sign when encoding, not just the first', () => {
        // Multiple '%' must all be escaped (global flag), otherwise the
        // unescaped ones become decoder control characters.
        const encoded = $exeDevice.encodeURIComponentSafe('100% off 50% sale');
        expect(encoded).not.toContain('%25');
        expect(encoded).toBe(encodeURIComponent('100&percnt; off 50&percnt; sale'));
    });

    it('round-trips strings containing multiple percent signs', () => {
        const original = 'a%b%c%d';
        const restored = $exeDevice.decodeURIComponentSafe(
            $exeDevice.encodeURIComponentSafe(original)
        );
        expect(restored).toBe(original);
    });

    it('preserves legitimate input without percent signs', () => {
        const original = 'https://example.com/image (1).png';
        const restored = $exeDevice.decodeURIComponentSafe(
            $exeDevice.encodeURIComponentSafe(original)
        );
        expect(restored).toBe(original);
    });

    it('returns falsy input unchanged for both safe helpers', () => {
        expect($exeDevice.encodeURIComponentSafe('')).toBe('');
        expect($exeDevice.decodeURIComponentSafe('')).toBe('');
    });
});
