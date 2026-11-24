import { describe, expect, it } from 'bun:test';
import { CONTENT_LABEL_PATTERN, contentLabel, isContentLabel } from './content-label';

const SECRET = 'test-secret-for-content-labels';
const APP = 'https://app.example';

describe('contentLabel', () => {
    it('is a DNS-safe label: lowercase alphanumeric, at most 63 characters', () => {
        const label = contentLabel('view', 'public-view-id', APP, SECRET);
        expect(label).toMatch(/^[a-z0-9]{1,63}$/);
        expect(label).toMatch(CONTENT_LABEL_PATTERN);
        expect(label.startsWith('v')).toBe(true);
    });

    it('is deterministic', () => {
        expect(contentLabel('view', 'id-1', APP, SECRET)).toBe(contentLabel('view', 'id-1', APP, SECRET));
    });

    it('differs per content item, per application origin and per key', () => {
        const label = contentLabel('view', 'id-1', APP, SECRET);
        expect(contentLabel('view', 'id-2', APP, SECRET)).not.toBe(label);
        expect(contentLabel('view', 'id-1', 'https://evil.example', SECRET)).not.toBe(label);
        expect(contentLabel('view', 'id-1', APP, 'another-secret')).not.toBe(label);
    });

    it('gives the workarea preview of a project its own label, apart from a public view with the same id', () => {
        const preview = contentLabel('preview', 'id-1', APP, SECRET);
        expect(preview).toMatch(CONTENT_LABEL_PATTERN);
        expect(preview.startsWith('p')).toBe(true);
        expect(preview.slice(1)).not.toBe(contentLabel('view', 'id-1', APP, SECRET).slice(1));
        expect(isContentLabel(preview, 'view', 'id-1', APP, SECRET)).toBe(false);
    });

    it('keeps the inputs apart, so one field cannot be shifted into the next', () => {
        expect(contentLabel('view', 'a","b', 'c', SECRET)).not.toBe(contentLabel('view', 'a', 'b","c', SECRET));
    });

    it('uses the server signing secret by default', () => {
        expect(contentLabel('view', 'id-1', APP)).toMatch(CONTENT_LABEL_PATTERN);
        expect(isContentLabel(contentLabel('view', 'id-1', APP), 'view', 'id-1', APP)).toBe(true);
    });
});

describe('isContentLabel', () => {
    const label = contentLabel('view', 'id-1', APP, SECRET);

    it('accepts only the label derived for that content', () => {
        expect(isContentLabel(label, 'view', 'id-1', APP, SECRET)).toBe(true);
        expect(isContentLabel(label, 'view', 'id-2', APP, SECRET)).toBe(false);
        expect(isContentLabel(label, 'view', 'id-1', 'https://evil.example', SECRET)).toBe(false);
    });

    it('rejects labels of another length without throwing', () => {
        expect(isContentLabel('', 'view', 'id-1', APP, SECRET)).toBe(false);
        expect(isContentLabel(`${label}0`, 'view', 'id-1', APP, SECRET)).toBe(false);
        expect(isContentLabel('é'.repeat(41), 'view', 'id-1', APP, SECRET)).toBe(false);
    });
});
