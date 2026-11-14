/**
 * Tests for Request Payload Types
 *
 * These are type-only definitions, so we just verify they compile correctly
 * and can be used for type checking.
 */

import { describe, it, expect } from 'bun:test';
import {
    type AssetUploadRequest,
    type LoginRequest,
    type FileGatorDirRequest,
    type FileGatorCreateRequest,
    type ExportOptionsRequest,
    type ConvertRequest,
    type IdeviceFileUploadRequest,
} from './request-payloads';

describe('Request Payload Types', () => {
    describe('AssetUploadRequest', () => {
        it('should accept asset with metadata', () => {
            const request: AssetUploadRequest = {
                file: Buffer.from('test'),
                componentId: 'comp-1',
                clientId: 'client-1',
            };
            expect(request.componentId).toBe('comp-1');
        });
    });

    describe('LoginRequest', () => {
        it('should accept Symfony style login', () => {
            const request: LoginRequest = {
                _username: 'user@test.com',
                _password: 'secret',
            };
            expect(request._username).toBe('user@test.com');
        });

        it('should accept REST style login', () => {
            const request: LoginRequest = {
                email: 'user@test.com',
                password: 'secret',
            };
            expect(request.email).toBe('user@test.com');
        });
    });

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

    describe('ConvertRequest', () => {
        it('should accept convert params', () => {
            const request: ConvertRequest = {
                file: Buffer.from('test'),
                format: 'html5',
            };
            expect(request.format).toBe('html5');
        });
    });

    describe('IdeviceFileUploadRequest', () => {
        it('should accept idevice file upload', () => {
            const request: IdeviceFileUploadRequest = {
                odeIdeviceId: 'idevice-1',
                filename: 'image.png',
                file: Buffer.from('test'),
            };
            expect(request.odeIdeviceId).toBe('idevice-1');
        });

        it('should accept base64 upload', () => {
            const request: IdeviceFileUploadRequest = {
                odeIdeviceId: 'idevice-1',
                filename: 'image.png',
                base64String: 'data:image/png;base64,abc123',
            };
            expect(request.base64String).toBeDefined();
        });
    });
});
