/**
 * Tests for Request Payload Types
 *
 * These are type-only definitions, so we just verify they compile correctly
 * and can be used for type checking.
 */

import { describe, it, expect } from 'bun:test';
import { type FileGatorDirRequest, type FileGatorCreateRequest, type ExportOptionsRequest } from './request-payloads';

describe('Request Payload Types', () => {
    describe('FileGatorDirRequest', () => {
        it('should accept directory path', () => {
            const request: FileGatorDirRequest = {
                dir: '/path/to/dir',
            };
            expect(request.dir).toBe('/path/to/dir');
        });
    });

    describe('FileGatorCreateRequest', () => {
        it('should accept file creation params', () => {
            const request: FileGatorCreateRequest = {
                type: 'file',
                name: 'newfile.txt',
                path: '/some/path',
            };
            expect(request.type).toBe('file');
        });

        it('should accept dir creation params', () => {
            const request: FileGatorCreateRequest = {
                type: 'dir',
                name: 'newfolder',
            };
            expect(request.type).toBe('dir');
        });
    });

    describe('ExportOptionsRequest', () => {
        it('should accept export options', () => {
            const request: ExportOptionsRequest = {
                format: 'scorm12',
                theme: 'base',
                singlePage: false,
            };
            expect(request.format).toBe('scorm12');
        });
    });
});
