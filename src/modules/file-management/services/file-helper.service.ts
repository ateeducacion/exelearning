import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileHelperService {
  private readonly logger = new Logger(FileHelperService.name);
  private readonly filesDir: string;
  private readonly publicDir: string;

  constructor(private configService: ConfigService) {
    // Get base directories from config or use defaults
    this.filesDir =
      this.configService.get<string>('FILES_DIR') ||
      path.join(process.cwd(), '..', 'files');
    this.publicDir =
      this.configService.get<string>('PUBLIC_DIR') ||
      path.join(process.cwd(), '..', 'public');
  }

  /**
   * Get the ODE session distribution directory
   * @param odeSessionId Session ID
   * @returns string Path to session directory
   */
  getOdeSessionDistDir(odeSessionId: string): string {
    return path.join(this.filesDir, 'dist', odeSessionId);
  }

  /**
   * Get the temporary directory for session
   * @param odeSessionId Session ID
   * @returns string Path to temp directory
   */
  getOdeSessionTempDir(odeSessionId: string): string {
    return path.join(this.filesDir, 'tmp', odeSessionId);
  }

  /**
   * Get permanent storage directory (for saved ELP files)
   * @returns string Path to permanent storage
   */
  getPermanentStorageDir(): string {
    return path.join(this.filesDir, 'permanent');
  }

  /**
   * Get Symfony public directory
   * @returns string Path to public directory
   */
  getSymfonyPublicDir(): string {
    return this.publicDir;
  }

  /**
   * Get libraries directory
   * @returns string Path to libs directory
   */
  getLibsDir(): string {
    return path.join(this.publicDir, 'libs');
  }

  /**
   * Get themes directory
   * @returns string Path to themes directory
   */
  getThemesDir(): string {
    return path.join(this.publicDir, 'style', 'themes');
  }

  /**
   * Get iDevices directory
   * @returns string Path to idevices directory
   */
  getIdevicesDir(): string {
    return path.join(this.publicDir, 'app', 'idevice');
  }

  /**
   * Create all necessary directories for a session
   * @param odeSessionId Session ID
   * @returns Promise<void>
   */
  async createSessionDirectories(odeSessionId: string): Promise<void> {
    try {
      const distDir = this.getOdeSessionDistDir(odeSessionId);
      const tempDir = this.getOdeSessionTempDir(odeSessionId);

      await Promise.all([
        fs.ensureDir(distDir),
        fs.ensureDir(tempDir),
        fs.ensureDir(path.join(distDir, 'resources')),
        fs.ensureDir(path.join(distDir, 'temp')),
      ]);

      this.logger.debug(`Created session directories for ${odeSessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to create session directories: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clean up session directories
   * @param odeSessionId Session ID
   * @param keepDist Keep distribution directory
   * @returns Promise<void>
   */
  async cleanupSessionDirectories(
    odeSessionId: string,
    keepDist: boolean = false,
  ): Promise<void> {
    try {
      const tempDir = this.getOdeSessionTempDir(odeSessionId);
      const distDir = this.getOdeSessionDistDir(odeSessionId);

      // Always remove temp directory
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
        this.logger.debug(`Removed temp directory: ${tempDir}`);
      }

      // Remove dist directory if not keeping
      if (!keepDist && (await fs.pathExists(distDir))) {
        await fs.remove(distDir);
        this.logger.debug(`Removed dist directory: ${distDir}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup session directories: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Copy directory recursively
   * @param source Source directory
   * @param destination Destination directory
   * @param options Copy options
   * @returns Promise<void>
   */
  async copyDirectory(
    source: string,
    destination: string,
    options: { overwrite?: boolean; filter?: (src: string) => boolean } = {},
  ): Promise<void> {
    try {
      await fs.copy(source, destination, {
        overwrite: options.overwrite ?? true,
        filter: options.filter,
      });

      this.logger.debug(`Copied directory: ${source} -> ${destination}`);
    } catch (error) {
      this.logger.error(
        `Failed to copy directory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate directory size recursively
   * @param dirPath Directory path
   * @returns Promise<number> Size in bytes
   */
  async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      this.logger.error(
        `Failed to calculate directory size: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get file size in bytes
   * @param filePath File path
   * @returns Promise<number> Size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      this.logger.error(`Failed to get file size: ${error.message}`);
      return 0;
    }
  }

  /**
   * Generate a unique temporary path
   * @param prefix Optional prefix for temp directory
   * @returns string Unique temp directory path
   */
  getTempPath(prefix: string = 'tmp'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return path.join(this.filesDir, 'tmp', `${prefix}_${timestamp}_${random}`);
  }

  /**
   * Ensure directory exists and is writable
   * @param dirPath Directory path
   * @returns Promise<boolean> True if directory is writable
   */
  async ensureWritableDirectory(dirPath: string): Promise<boolean> {
    try {
      await fs.ensureDir(dirPath);

      // Test write permissions by creating and removing a temp file
      const testFile = path.join(dirPath, '.write_test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);

      return true;
    } catch (error) {
      this.logger.error(
        `Directory not writable: ${dirPath} - ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get relative path from base
   * @param from Base path
   * @param to Target path
   * @returns string Relative path
   */
  getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Normalize path for cross-platform compatibility
   * @param filePath File path
   * @returns string Normalized path
   */
  normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  /**
   * Check if path is within allowed directory (security check)
   * @param basePath Base directory
   * @param targetPath Target path to check
   * @returns boolean True if path is safe
   */
  isPathSafe(basePath: string, targetPath: string): boolean {
    const normalizedBase = path.resolve(basePath);
    const normalizedTarget = path.resolve(targetPath);

    return normalizedTarget.startsWith(normalizedBase);
  }

  /**
   * Get MIME type from file extension
   * @param filePath File path
   * @returns string MIME type
   */
  getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.elp': 'application/zip',
      '.elpx': 'application/zip',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
