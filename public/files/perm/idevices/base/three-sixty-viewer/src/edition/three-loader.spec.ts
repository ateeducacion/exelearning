import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureThreeLoaded, vendorBaseCandidates } from './three-loader';

type MutableGlobal = { THREE?: unknown };

/**
 * happy-dom auto-resolves appended scripts, which would race these tests.
 * Capture appended scripts WITHOUT inserting them, so onload/onerror fire
 * only when the test says so.
 */
let captured: HTMLScriptElement[] = [];
let restoreAppend: (() => void) | null = null;

beforeEach(() => {
    captured = [];
    const original = document.head.appendChild.bind(document.head);
    document.head.appendChild = (<T extends Node>(node: T): T => {
        if (node instanceof HTMLScriptElement && node.hasAttribute('data-three-sixty-src')) {
            captured.push(node);
            return node;
        }
        return original(node);
    }) as typeof document.head.appendChild;
    restoreAppend = () => {
        document.head.appendChild = original;
    };
});

afterEach(() => {
    restoreAppend?.();
    restoreAppend = null;
    delete (globalThis as MutableGlobal).THREE;
    document.head.querySelectorAll('script[data-three-sixty-src]').forEach(script => script.remove());
});

function pendingUrls(): string[] {
    return captured.map(script => script.getAttribute('data-three-sixty-src') ?? '');
}

describe('vendorBaseCandidates', () => {
    it('prefers the export/ sibling of the edition path', () => {
        expect(vendorBaseCandidates('/files/idevices/three-sixty-viewer/edition/')).toEqual([
            '/files/idevices/three-sixty-viewer/export/',
            '/files/idevices/three-sixty-viewer/edition/',
            '../export/',
            '',
        ]);
        expect(vendorBaseCandidates('')).toEqual(['../export/', '']);
    });
});

describe('ensureThreeLoaded', () => {
    it('invokes the callback immediately when THREE is already present', () => {
        (globalThis as MutableGlobal).THREE = { OrbitControls: class {} };
        const callback = vi.fn();
        ensureThreeLoaded('/x/edition/', callback);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(captured).toHaveLength(0);
    });

    it('loads three.min.js then OrbitControls.js and coalesces concurrent callers', () => {
        const first = vi.fn();
        const second = vi.fn();
        ensureThreeLoaded('/base/edition/', first);
        ensureThreeLoaded('/base/edition/', second);
        expect(pendingUrls()).toEqual(['/base/export/three.min.js']);
        expect(first).not.toHaveBeenCalled();
        captured[0]?.onload?.(new Event('load'));
        expect(pendingUrls()).toEqual(['/base/export/three.min.js', '/base/export/OrbitControls.js']);
        captured[1]?.onload?.(new Event('load'));
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('falls through the candidate list on failure and always fires the callback', () => {
        const callback = vi.fn();
        ensureThreeLoaded('', callback);
        // Candidates for an empty path: '../export/' then ''.
        expect(pendingUrls()).toEqual(['../export/three.min.js']);
        captured[0]?.onerror?.(new Event('error'));
        expect(pendingUrls()).toEqual(['../export/three.min.js', 'three.min.js']);
        captured[1]?.onload?.(new Event('load'));
        expect(pendingUrls()[2]).toBe('OrbitControls.js');
        captured[2]?.onerror?.(new Event('error'));
        // Every candidate exhausted → the callback still fires exactly once.
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
