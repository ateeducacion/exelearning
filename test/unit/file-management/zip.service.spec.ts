import { Test, TestingModule } from '@nestjs/testing';
import { ZipService } from '../../../src/modules/file-management/services/zip.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as archiver from 'archiver';

describe('ZipService', () => {
  let service: ZipService;
  let testDir: string;
  let fixturesDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZipService],
    }).compile();

    service = module.get<ZipService>(ZipService);
    testDir = path.join(__dirname, '../../fixtures/temp');
    fixturesDir = path.join(__dirname, '../../fixtures');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('extract', () => {
    it('should extract ZIP file successfully', async () => {
      // Create a test ZIP file first
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');
      const destPath = path.join(testDir, 'extracted');

      // Create source directory with test files
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Hello World');
      await fs.writeFile(path.join(sourceDir, 'test.html'), '<html></html>');
      await fs.ensureDir(path.join(sourceDir, 'subdir'));
      await fs.writeFile(
        path.join(sourceDir, 'subdir', 'nested.txt'),
        'Nested content',
      );

      // Create ZIP
      await service.create(sourceDir, zipPath);

      // Extract ZIP
      const result = await service.extract(zipPath, destPath);

      expect(result).toBe(true);
      expect(await fs.pathExists(path.join(destPath, 'test.txt'))).toBe(true);
      expect(await fs.pathExists(path.join(destPath, 'test.html'))).toBe(true);
      expect(
        await fs.pathExists(path.join(destPath, 'subdir', 'nested.txt')),
      ).toBe(true);

      const content = await fs.readFile(
        path.join(destPath, 'test.txt'),
        'utf-8',
      );
      expect(content).toBe('Hello World');
    });

    it('should handle non-existent ZIP file', async () => {
      const zipPath = path.join(testDir, 'nonexistent.zip');
      const destPath = path.join(testDir, 'extracted');

      await expect(service.extract(zipPath, destPath)).rejects.toThrow(
        'ZIP file not found',
      );
    });

    it('should respect overwrite option when set to false', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');
      const destPath = path.join(testDir, 'extracted');

      // Create source and ZIP
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Original content');
      await service.create(sourceDir, zipPath);

      // Create existing file in destination
      await fs.ensureDir(destPath);
      await fs.writeFile(
        path.join(destPath, 'test.txt'),
        'Existing content',
      );

      // Extract without overwrite
      await service.extract(zipPath, destPath, { overwrite: false });

      const content = await fs.readFile(
        path.join(destPath, 'test.txt'),
        'utf-8',
      );
      expect(content).toBe('Existing content');
    });

    it('should overwrite existing files when overwrite is true', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');
      const destPath = path.join(testDir, 'extracted');

      // Create source and ZIP
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'New content');
      await service.create(sourceDir, zipPath);

      // Create existing file in destination
      await fs.ensureDir(destPath);
      await fs.writeFile(path.join(destPath, 'test.txt'), 'Old content');

      // Extract with overwrite
      await service.extract(zipPath, destPath, { overwrite: true });

      const content = await fs.readFile(
        path.join(destPath, 'test.txt'),
        'utf-8',
      );
      expect(content).toBe('New content');
    });

    it('should create destination directory if it does not exist', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');
      const destPath = path.join(testDir, 'new', 'nested', 'path');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Content');
      await service.create(sourceDir, zipPath);

      const result = await service.extract(zipPath, destPath);

      expect(result).toBe(true);
      expect(await fs.pathExists(destPath)).toBe(true);
      expect(await fs.pathExists(path.join(destPath, 'test.txt'))).toBe(true);
    });

    it('should preserve directory structure', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');
      const destPath = path.join(testDir, 'extracted');

      // Create complex directory structure
      await fs.ensureDir(path.join(sourceDir, 'level1', 'level2', 'level3'));
      await fs.writeFile(
        path.join(sourceDir, 'level1', 'level2', 'level3', 'deep.txt'),
        'Deep content',
      );
      await service.create(sourceDir, zipPath);

      await service.extract(zipPath, destPath);

      expect(
        await fs.pathExists(
          path.join(destPath, 'level1', 'level2', 'level3', 'deep.txt'),
        ),
      ).toBe(true);
    });
  });

  describe('create', () => {
    it('should create ZIP from directory', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'output.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'File 1');
      await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'File 2');

      const result = await service.create(sourceDir, zipPath);

      expect(result).toBe(zipPath);
      expect(await fs.pathExists(zipPath)).toBe(true);

      // Verify ZIP contains files
      const contents = await service.listContents(zipPath);
      expect(contents).toContain('file1.txt');
      expect(contents).toContain('file2.txt');
    });

    it('should handle non-existent source directory', async () => {
      const sourceDir = path.join(testDir, 'nonexistent');
      const zipPath = path.join(testDir, 'output.zip');

      await expect(service.create(sourceDir, zipPath)).rejects.toThrow(
        'Source directory not found',
      );
    });

    it('should apply compression level 0 (no compression)', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'uncompressed.zip');

      await fs.ensureDir(sourceDir);
      const largeContent = 'A'.repeat(10000); // 10KB of repeated 'A'
      await fs.writeFile(path.join(sourceDir, 'large.txt'), largeContent);

      await service.create(sourceDir, zipPath, { compressionLevel: 0 });

      const zipSize = (await fs.stat(zipPath)).size;
      // With no compression, ZIP should be close to original size
      expect(zipSize).toBeGreaterThan(9000);
    });

    it('should apply compression level 9 (maximum compression)', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'compressed.zip');

      await fs.ensureDir(sourceDir);
      const largeContent = 'A'.repeat(10000); // 10KB of repeated 'A'
      await fs.writeFile(path.join(sourceDir, 'large.txt'), largeContent);

      await service.create(sourceDir, zipPath, { compressionLevel: 9 });

      const zipSize = (await fs.stat(zipPath)).size;
      // With maximum compression, repeated content should compress significantly
      expect(zipSize).toBeLessThan(1000);
    });

    it('should exclude files matching patterns', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'filtered.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'include.txt'), 'Include');
      await fs.writeFile(path.join(sourceDir, 'exclude.log'), 'Exclude');
      await fs.writeFile(path.join(sourceDir, 'exclude.tmp'), 'Exclude');

      await service.create(sourceDir, zipPath, {
        excludePatterns: ['.log', '.tmp'],
      });

      const contents = await service.listContents(zipPath);
      expect(contents).toContain('include.txt');
      expect(contents).not.toContain('exclude.log');
      expect(contents).not.toContain('exclude.tmp');
    });

    it('should create output directory if it does not exist', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'new', 'nested', 'output.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Content');

      await service.create(sourceDir, zipPath);

      expect(await fs.pathExists(zipPath)).toBe(true);
    });
  });

  describe('listContents', () => {
    it('should list all files in ZIP', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'Content 1');
      await fs.writeFile(path.join(sourceDir, 'file2.html'), 'Content 2');
      await fs.ensureDir(path.join(sourceDir, 'subdir'));
      await fs.writeFile(
        path.join(sourceDir, 'subdir', 'file3.json'),
        '{}',
      );

      await service.create(sourceDir, zipPath);
      const contents = await service.listContents(zipPath);

      expect(contents).toContain('file1.txt');
      expect(contents).toContain('file2.html');
      expect(contents).toContain('subdir/file3.json');
      expect(contents.length).toBe(3);
    });

    it('should exclude directories from listing', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(path.join(sourceDir, 'emptydir'));
      await fs.writeFile(path.join(sourceDir, 'file.txt'), 'Content');

      await service.create(sourceDir, zipPath);
      const contents = await service.listContents(zipPath);

      // Should only include files, not directories
      expect(contents.every((entry) => !entry.endsWith('/'))).toBe(true);
      expect(contents).toContain('file.txt');
    });

    it('should handle non-existent ZIP file', async () => {
      const zipPath = path.join(testDir, 'nonexistent.zip');

      await expect(service.listContents(zipPath)).rejects.toThrow(
        'ZIP file not found',
      );
    });
  });

  describe('hasFile', () => {
    it('should return true for existing file', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'exists.txt'), 'Content');
      await service.create(sourceDir, zipPath);

      const result = await service.hasFile(zipPath, 'exists.txt');
      expect(result).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'exists.txt'), 'Content');
      await service.create(sourceDir, zipPath);

      const result = await service.hasFile(zipPath, 'notexists.txt');
      expect(result).toBe(false);
    });

    it('should handle paths with subdirectories', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(path.join(sourceDir, 'subdir'));
      await fs.writeFile(path.join(sourceDir, 'subdir', 'file.txt'), 'Content');
      await service.create(sourceDir, zipPath);

      const result = await service.hasFile(zipPath, 'subdir/file.txt');
      expect(result).toBe(true);
    });

    it('should return false for non-existent ZIP file', async () => {
      const zipPath = path.join(testDir, 'nonexistent.zip');

      const result = await service.hasFile(zipPath, 'anyfile.txt');
      expect(result).toBe(false);
    });
  });

  describe('getFile', () => {
    it('should extract single file without full extraction', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'target.txt'), 'Target content');
      await fs.writeFile(path.join(sourceDir, 'other.txt'), 'Other content');
      await service.create(sourceDir, zipPath);

      const buffer = await service.getFile(zipPath, 'target.txt');

      expect(buffer).not.toBeNull();
      expect(buffer.toString('utf-8')).toBe('Target content');
    });

    it('should return null for non-existing file', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'exists.txt'), 'Content');
      await service.create(sourceDir, zipPath);

      const buffer = await service.getFile(zipPath, 'notexists.txt');

      expect(buffer).toBeNull();
    });

    it('should handle binary files', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'test.zip');

      await fs.ensureDir(sourceDir);
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      await fs.writeFile(path.join(sourceDir, 'image.png'), binaryData);
      await service.create(sourceDir, zipPath);

      const buffer = await service.getFile(zipPath, 'image.png');

      expect(buffer).not.toBeNull();
      expect(buffer.equals(binaryData)).toBe(true);
    });

    it('should throw error for non-existent ZIP file', async () => {
      const zipPath = path.join(testDir, 'nonexistent.zip');

      await expect(service.getFile(zipPath, 'anyfile.txt')).rejects.toThrow(
        'ZIP file not found',
      );
    });
  });

  describe('isValidZip', () => {
    it('should validate correct ZIP file', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'valid.zip');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Content');
      await service.create(sourceDir, zipPath);

      const result = await service.isValidZip(zipPath);
      expect(result).toBe(true);
    });

    it('should reject invalid ZIP file', async () => {
      const zipPath = path.join(testDir, 'invalid.zip');

      // Create a file that's not a ZIP
      await fs.writeFile(zipPath, 'This is not a ZIP file');

      const result = await service.isValidZip(zipPath);
      expect(result).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const zipPath = path.join(testDir, 'nonexistent.zip');

      const result = await service.isValidZip(zipPath);
      expect(result).toBe(false);
    });

    it('should reject corrupted ZIP file', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'corrupted.zip');

      // Create a valid ZIP first
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Content');
      await service.create(sourceDir, zipPath);

      // Corrupt the ZIP by truncating it
      const originalSize = (await fs.stat(zipPath)).size;
      await fs.truncate(zipPath, Math.floor(originalSize / 2));

      const result = await service.isValidZip(zipPath);
      expect(result).toBe(false);
    });
  });
});
