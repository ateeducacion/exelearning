import { afterEach, describe, expect, it } from 'vitest';
import { tr } from './i18n';

type MutableGlobal = { _?: unknown };

afterEach(() => {
    delete (globalThis as MutableGlobal)._;
});

describe('tr', () => {
    it('returns the identity without a page translator', () => {
        expect(tr('Hello')).toBe('Hello');
    });

    it('uses the page-provided _() when present', () => {
        (globalThis as MutableGlobal)._ = (text: string) => `[${text}]`;
        expect(tr('Hello')).toBe('[Hello]');
    });

    it('falls back to identity when the translator throws', () => {
        (globalThis as MutableGlobal)._ = () => {
            throw new Error('broken translator');
        };
        expect(tr('Hello')).toBe('Hello');
    });
});
