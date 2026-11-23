import { afterAll, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stageRuntimeDependencies } from './stage-runtime';

const directory = mkdtempSync(join(tmpdir(), 'synology-runtime-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('standalone runtime dependencies', () => {
    it('loads jsdom from a relocated production tree, including its disk assets', () => {
        stageRuntimeDependencies(directory);
        const require = createRequire(join(directory, 'package.json'));
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM('<!doctype html><p>runtime check</p>');
        expect(dom.window.document.querySelector('p').textContent).toBe('runtime check');
        expect(dom.window.getComputedStyle(dom.window.document.querySelector('p')).display).toBe('block');
        dom.window.close();
        expect(
            readFileSync(join(directory, 'node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css'), 'utf8'),
        ).not.toBe('');
        expect(existsSync(join(directory, 'node_modules/vitest'))).toBe(false);
        expect(existsSync(join(directory, 'node_modules/jsdom/LICENSE.txt'))).toBe(true);
    });
});
