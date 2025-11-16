import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FileHelperService } from '../../../src/modules/file-management/services/file-helper.service';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('FileHelperService', () => {
  let service: FileHelperService;
  let configService: ConfigService;
  let testDir: string;
  let filesDir: string;
  let publicDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../fixtures/temp');
    filesDir = path.join(testDir, 'files');
    publicDir = path.join(testDir, 'public');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileHelperService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FILES_DIR') return filesDir;
              if (key === 'PUBLIC_DIR') return publicDir;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FileHelperService>(FileHelperService);
    configService = module.get<ConfigService>(ConfigService);

    await fs.ensureDir(testDir);
    await fs.ensureDir(filesDir);
    await fs.ensureDir(publicDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('getOdeSessionDistDir', () => {
    it('should return correct session dist path', () => {
      const sessionId = 'test-session-123';
      const result = service.getOdeSessionDistDir(sessionId);

      expect(result).toBe(path.join(filesDir, 'dist', sessionId));
    });

    it('should handle special characters in session ID', () => {
      const sessionId = 'session_2024-01-01_v2';
      const result = service.getOdeSessionDistDir(sessionId);

      expect(result).toBe(path.join(filesDir, 'dist', sessionId));
    });
  });

  describe('getOdeSessionTempDir', () => {
    it('should return correct session temp path', () => {
      const sessionId = 'test-session-456';
      const result = service.getOdeSessionTempDir(sessionId);

      expect(result).toBe(path.join(filesDir, 'tmp', sessionId));
    });

    it('should return different path than dist dir', () => {
      const sessionId = 'test-session-789';
      const distDir = service.getOdeSessionDistDir(sessionId);
      const tempDir = service.getOdeSessionTempDir(sessionId);

      expect(distDir).not.toBe(tempDir);
    });
  });

  describe('getPermanentStorageDir', () => {
    it('should return correct permanent storage path', () => {
      const result = service.getPermanentStorageDir();

      expect(result).toBe(path.join(filesDir, 'permanent'));
    });
  });

  describe('getSymfonyPublicDir', () => {
    it('should return correct public directory path', () => {
      const result = service.getSymfonyPublicDir();

      expect(result).toBe(publicDir);
    });
  });

  describe('getLibsDir', () => {
    it('should return correct libs directory path', () => {
      const result = service.getLibsDir();

      expect(result).toBe(path.join(publicDir, 'libs'));
    });
  });

  describe('getThemesDir', () => {
    it('should return correct themes directory path', () => {
      const result = service.getThemesDir();

      expect(result).toBe(path.join(publicDir, 'style', 'themes'));
    });
  });

  describe('getIdevicesDir', () => {
    it('should return correct idevices directory path', () => {
      const result = service.getIdevicesDir();

      expect(result).toBe(path.join(publicDir, 'app', 'idevice'));
    });
  });

  describe('createSessionDirectories', () => {
    it('should create all required directories', async () => {
      const sessionId = 'test-create-session';

      await service.createSessionDirectories(sessionId);

      const distDir = service.getOdeSessionDistDir(sessionId);
      const tempDir = service.getOdeSessionTempDir(sessionId);

      expect(await fs.pathExists(distDir)).toBe(true);
      expect(await fs.pathExists(tempDir)).toBe(true);
      expect(await fs.pathExists(path.join(distDir, 'resources'))).toBe(true);
      expect(await fs.pathExists(path.join(distDir, 'temp'))).toBe(true);
    });

    it('should not fail if directories already exist', async () => {
      const sessionId = 'test-existing-session';

      // Create first time
      await service.createSessionDirectories(sessionId);

      // Create again - should not throw
      await expect(
        service.createSessionDirectories(sessionId),
      ).resolves.not.toThrow();
    });

    it('should handle multiple concurrent session creations', async () => {
      const sessions = ['session-1', 'session-2', 'session-3'];

      await Promise.all(
        sessions.map((id) => service.createSessionDirectories(id)),
      );

      for (const sessionId of sessions) {
        const distDir = service.getOdeSessionDistDir(sessionId);
        expect(await fs.pathExists(distDir)).toBe(true);
      }
    });
  });

  describe('cleanupSessionDirectories', () => {
    it('should remove temp directory', async () => {
      const sessionId = 'test-cleanup-temp';

      await service.createSessionDirectories(sessionId);
      const tempDir = service.getOdeSessionTempDir(sessionId);

      expect(await fs.pathExists(tempDir)).toBe(true);

      await service.cleanupSessionDirectories(sessionId, true);

      expect(await fs.pathExists(tempDir)).toBe(false);
    });

    it('should keep dist directory when keepDist is true', async () => {
      const sessionId = 'test-cleanup-keep-dist';

      await service.createSessionDirectories(sessionId);
      const distDir = service.getOdeSessionDistDir(sessionId);

      await service.cleanupSessionDirectories(sessionId, true);

      expect(await fs.pathExists(distDir)).toBe(true);
    });

    it('should remove dist directory when keepDist is false', async () => {
      const sessionId = 'test-cleanup-remove-dist';

      await service.createSessionDirectories(sessionId);
      const distDir = service.getOdeSessionDistDir(sessionId);

      await service.cleanupSessionDirectories(sessionId, false);

      expect(await fs.pathExists(distDir)).toBe(false);
    });

    it('should not fail if directories do not exist', async () => {
      const sessionId = 'test-cleanup-nonexistent';

      await expect(
        service.cleanupSessionDirectories(sessionId, false),
      ).resolves.not.toThrow();
    });
  });

  describe('copyDirectory', () => {
    it('should copy directory recursively', async () => {
      const sourceDir = path.join(testDir, 'source');
      const destDir = path.join(testDir, 'destination');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'Content 1');
      await fs.ensureDir(path.join(sourceDir, 'subdir'));
      await fs.writeFile(
        path.join(sourceDir, 'subdir', 'file2.txt'),
        'Content 2',
      );

      await service.copyDirectory(sourceDir, destDir);

      expect(await fs.pathExists(path.join(destDir, 'file1.txt'))).toBe(true);
      expect(
        await fs.pathExists(path.join(destDir, 'subdir', 'file2.txt')),
      ).toBe(true);

      const content = await fs.readFile(
        path.join(destDir, 'file1.txt'),
        'utf-8',
      );
      expect(content).toBe('Content 1');
    });

    it('should respect filter option', async () => {
      const sourceDir = path.join(testDir, 'source-filter');
      const destDir = path.join(testDir, 'dest-filter');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'include.txt'), 'Include');
      await fs.writeFile(path.join(sourceDir, 'exclude.log'), 'Exclude');

      await service.copyDirectory(sourceDir, destDir, {
        filter: (src) => !src.endsWith('.log'),
      });

      expect(await fs.pathExists(path.join(destDir, 'include.txt'))).toBe(
        true,
      );
      expect(await fs.pathExists(path.join(destDir, 'exclude.log'))).toBe(
        false,
      );
    });

    it('should overwrite files when overwrite is true', async () => {
      const sourceDir = path.join(testDir, 'source-overwrite');
      const destDir = path.join(testDir, 'dest-overwrite');

      await fs.ensureDir(sourceDir);
      await fs.ensureDir(destDir);
      await fs.writeFile(path.join(sourceDir, 'file.txt'), 'New content');
      await fs.writeFile(path.join(destDir, 'file.txt'), 'Old content');

      await service.copyDirectory(sourceDir, destDir, { overwrite: true });

      const content = await fs.readFile(
        path.join(destDir, 'file.txt'),
        'utf-8',
      );
      expect(content).toBe('New content');
    });

    it('should handle empty directories', async () => {
      const sourceDir = path.join(testDir, 'source-empty');
      const destDir = path.join(testDir, 'dest-empty');

      await fs.ensureDir(sourceDir);

      await service.copyDirectory(sourceDir, destDir);

      expect(await fs.pathExists(destDir)).toBe(true);
    });
  });

  describe('getDirectorySize', () => {
    it('should calculate size recursively', async () => {
      const dir = path.join(testDir, 'size-test');

      await fs.ensureDir(dir);
      await fs.writeFile(path.join(dir, 'file1.txt'), 'A'.repeat(100)); // 100 bytes
      await fs.ensureDir(path.join(dir, 'subdir'));
      await fs.writeFile(path.join(dir, 'subdir', 'file2.txt'), 'B'.repeat(50)); // 50 bytes

      const size = await service.getDirectorySize(dir);

      expect(size).toBe(150);
    });

    it('should return 0 for empty directory', async () => {
      const dir = path.join(testDir, 'empty-dir');

      await fs.ensureDir(dir);
      const size = await service.getDirectorySize(dir);

      expect(size).toBe(0);
    });

    it('should handle deeply nested directories', async () => {
      const dir = path.join(testDir, 'nested-size');

      await fs.ensureDir(path.join(dir, 'a', 'b', 'c'));
      await fs.writeFile(path.join(dir, 'a', 'b', 'c', 'deep.txt'), 'X'.repeat(25));

      const size = await service.getDirectorySize(dir);

      expect(size).toBe(25);
    });
  });

  describe('getFileSize', () => {
    it('should return file size in bytes', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      const content = 'Hello World'; // 11 bytes

      await fs.writeFile(filePath, content);
      const size = await service.getFileSize(filePath);

      expect(size).toBe(11);
    });

    it('should return 0 for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');

      const size = await service.getFileSize(filePath);

      expect(size).toBe(0);
    });
  });

  describe('getTempPath', () => {
    it('should generate unique temporary path', () => {
      const path1 = service.getTempPath();
      const path2 = service.getTempPath();

      expect(path1).not.toBe(path2);
    });

    it('should use provided prefix', () => {
      const prefix = 'custom-prefix';
      const tempPath = service.getTempPath(prefix);

      expect(tempPath).toContain(prefix);
    });

    it('should be within files/tmp directory', () => {
      const tempPath = service.getTempPath();

      expect(tempPath).toContain(path.join(filesDir, 'tmp'));
    });
  });

  describe('ensureWritableDirectory', () => {
    it('should return true for writable directory', async () => {
      const dir = path.join(testDir, 'writable');

      const result = await service.ensureWritableDirectory(dir);

      expect(result).toBe(true);
      expect(await fs.pathExists(dir)).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      const dir = path.join(testDir, 'new-writable');

      expect(await fs.pathExists(dir)).toBe(false);

      const result = await service.ensureWritableDirectory(dir);

      expect(result).toBe(true);
      expect(await fs.pathExists(dir)).toBe(true);
    });

    it('should return true for existing writable directory', async () => {
      const dir = path.join(testDir, 'existing-writable');

      await fs.ensureDir(dir);
      const result = await service.ensureWritableDirectory(dir);

      expect(result).toBe(true);
    });
  });

  describe('getRelativePath', () => {
    it('should return correct relative path', () => {
      const from = '/home/user/project';
      const to = '/home/user/project/src/app/main.ts';

      const result = service.getRelativePath(from, to);

      expect(result).toBe(path.join('src', 'app', 'main.ts'));
    });

    it('should handle paths with common parent', () => {
      const from = '/home/user/project/src';
      const to = '/home/user/project/dist';

      const result = service.getRelativePath(from, to);

      expect(result).toBe(path.join('..', 'dist'));
    });
  });

  describe('normalizePath', () => {
    it('should normalize path separators to forward slashes', () => {
      const windowsPath = 'C:\\Users\\test\\file.txt';

      const result = service.normalizePath(windowsPath);

      expect(result).not.toContain('\\');
      expect(result).toContain('/');
    });

    it('should resolve relative path components', () => {
      const pathWithDots = '/home/user/../admin/./file.txt';

      const result = service.normalizePath(pathWithDots);

      expect(result).not.toContain('..');
      expect(result).not.toContain('./');
    });
  });

  describe('isPathSafe', () => {
    it('should allow safe paths within base directory', () => {
      const basePath = '/home/user/project';
      const targetPath = '/home/user/project/src/file.txt';

      const result = service.isPathSafe(basePath, targetPath);

      expect(result).toBe(true);
    });

    it('should reject path traversal attempts using ../', () => {
      const basePath = '/home/user/project';
      const targetPath = '/home/user/project/../../../etc/passwd';

      const result = service.isPathSafe(basePath, targetPath);

      expect(result).toBe(false);
    });

    it('should reject absolute paths outside base directory', () => {
      const basePath = '/home/user/project';
      const targetPath = '/etc/passwd';

      const result = service.isPathSafe(basePath, targetPath);

      expect(result).toBe(false);
    });

    it('should allow path equal to base path', () => {
      const basePath = '/home/user/project';
      const targetPath = '/home/user/project';

      const result = service.isPathSafe(basePath, targetPath);

      expect(result).toBe(true);
    });

    it('should handle relative paths correctly', () => {
      const basePath = path.resolve(testDir, 'base');
      const targetPath = path.resolve(testDir, 'base', 'subdir', 'file.txt');

      const result = service.isPathSafe(basePath, targetPath);

      // After resolution, the target should be within base
      expect(result).toBe(true);
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for HTML', () => {
      expect(service.getMimeType('test.html')).toBe('text/html');
      expect(service.getMimeType('test.htm')).toBe('text/html');
    });

    it('should return correct MIME type for CSS', () => {
      expect(service.getMimeType('styles.css')).toBe('text/css');
    });

    it('should return correct MIME type for JavaScript', () => {
      expect(service.getMimeType('script.js')).toBe('application/javascript');
    });

    it('should return correct MIME type for JSON', () => {
      expect(service.getMimeType('data.json')).toBe('application/json');
    });

    it('should return correct MIME type for XML', () => {
      expect(service.getMimeType('content.xml')).toBe('application/xml');
    });

    it('should return correct MIME type for images', () => {
      expect(service.getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(service.getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(service.getMimeType('icon.png')).toBe('image/png');
      expect(service.getMimeType('animation.gif')).toBe('image/gif');
      expect(service.getMimeType('vector.svg')).toBe('image/svg+xml');
    });

    it('should return correct MIME type for PDF', () => {
      expect(service.getMimeType('document.pdf')).toBe('application/pdf');
    });

    it('should return correct MIME type for ZIP archives', () => {
      expect(service.getMimeType('archive.zip')).toBe('application/zip');
      expect(service.getMimeType('project.elp')).toBe('application/zip');
      expect(service.getMimeType('package.elpx')).toBe('application/zip');
    });

    it('should return default MIME type for unknown extensions', () => {
      expect(service.getMimeType('unknown.xyz')).toBe(
        'application/octet-stream',
      );
    });

    it('should be case insensitive', () => {
      expect(service.getMimeType('FILE.HTML')).toBe('text/html');
      expect(service.getMimeType('FILE.JSON')).toBe('application/json');
    });

    it('should handle files with multiple dots', () => {
      expect(service.getMimeType('my.backup.file.json')).toBe(
        'application/json',
      );
    });

    it('should handle files without extension', () => {
      expect(service.getMimeType('README')).toBe('application/octet-stream');
    });
  });
});
