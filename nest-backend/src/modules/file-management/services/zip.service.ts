import { Injectable, Logger } from '@nestjs/common';
import AdmZip = require('adm-zip');
import * as fs from 'fs-extra';
import * as path from 'path';
import archiver = require('archiver');

export interface ExtractOptions {
  overwrite?: boolean;
  preserveStructure?: boolean;
}

export interface ZipOptions {
  compressionLevel?: number; // 0-9
  excludePatterns?: string[];
}

@Injectable()
export class ZipService {
  private readonly logger = new Logger(ZipService.name);

  /**
   * Extract a ZIP file to a destination directory
   * @param zipPath Path to the ZIP file
   * @param destPath Destination directory
   * @param options Extract options
   * @returns Promise<boolean> Success status
   */
  async extract(
    zipPath: string,
    destPath: string,
    options: ExtractOptions = {},
  ): Promise<boolean> {
    try {
      this.logger.debug(`Extracting ZIP: ${zipPath} to ${destPath}`);

      // Validate ZIP file exists
      if (!(await fs.pathExists(zipPath))) {
        throw new Error(`ZIP file not found: ${zipPath}`);
      }

      // Create destination directory
      await fs.ensureDir(destPath);

      // Load ZIP file
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      this.logger.debug(`Found ${zipEntries.length} entries in ZIP`);

      // Extract all files
      for (const entry of zipEntries) {
        if (entry.isDirectory) {
          const dirPath = path.join(destPath, entry.entryName);
          await fs.ensureDir(dirPath);
        } else {
          const filePath = path.join(destPath, entry.entryName);
          const fileDir = path.dirname(filePath);

          // Ensure parent directory exists
          await fs.ensureDir(fileDir);

          // Check if file exists and overwrite option
          if (await fs.pathExists(filePath)) {
            if (!options.overwrite) {
              this.logger.warn(`File exists, skipping: ${filePath}`);
              continue;
            }
          }

          // Extract file
          await fs.writeFile(filePath, entry.getData());
          this.logger.debug(`Extracted: ${entry.entryName}`);
        }
      }

      this.logger.log(`Successfully extracted ZIP to ${destPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to extract ZIP: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a ZIP file from a directory
   * @param sourceDir Source directory to compress
   * @param zipPath Output ZIP file path
   * @param options Compression options
   * @returns Promise<string> Path to created ZIP file
   */
  async create(
    sourceDir: string,
    zipPath: string,
    options: ZipOptions = {},
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        this.logger.debug(`Creating ZIP: ${sourceDir} -> ${zipPath}`);

        // Validate source directory exists
        if (!(await fs.pathExists(sourceDir))) {
          throw new Error(`Source directory not found: ${sourceDir}`);
        }

        // Ensure output directory exists
        const zipDir = path.dirname(zipPath);
        await fs.ensureDir(zipDir);

        // Create write stream
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
          zlib: { level: options.compressionLevel ?? 9 }, // Maximum compression by default
        });

        // Handle stream events
        output.on('close', () => {
          this.logger.log(
            `ZIP created successfully: ${zipPath} (${archive.pointer()} bytes)`,
          );
          resolve(zipPath);
        });

        archive.on('error', (err) => {
          this.logger.error(`Archive error: ${err.message}`, err.stack);
          reject(err);
        });

        archive.on('warning', (err) => {
          if (err.code === 'ENOENT') {
            this.logger.warn(`Archive warning: ${err.message}`);
          } else {
            reject(err);
          }
        });

        // Pipe archive to output
        archive.pipe(output);

        // Add directory contents
        archive.directory(sourceDir, false, (entry) => {
          // Apply exclude patterns if provided
          if (options.excludePatterns) {
            for (const pattern of options.excludePatterns) {
              if (entry.name.includes(pattern)) {
                return false; // Exclude this file
              }
            }
          }
          return entry;
        });

        // Finalize the archive
        await archive.finalize();
      } catch (error) {
        this.logger.error(`Failed to create ZIP: ${error.message}`, error.stack);
        reject(error);
      }
    });
  }

  /**
   * List contents of a ZIP file
   * @param zipPath Path to ZIP file
   * @returns Promise<string[]> List of file paths in ZIP
   */
  async listContents(zipPath: string): Promise<string[]> {
    try {
      this.logger.debug(`Listing ZIP contents: ${zipPath}`);

      if (!(await fs.pathExists(zipPath))) {
        throw new Error(`ZIP file not found: ${zipPath}`);
      }

      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      const contents = entries
        .filter((entry) => !entry.isDirectory)
        .map((entry) => entry.entryName);

      this.logger.debug(`Found ${contents.length} files in ZIP`);
      return contents;
    } catch (error) {
      this.logger.error(
        `Failed to list ZIP contents: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if a file exists in ZIP
   * @param zipPath Path to ZIP file
   * @param filePath File path to check within ZIP
   * @returns Promise<boolean> True if file exists
   */
  async hasFile(zipPath: string, filePath: string): Promise<boolean> {
    try {
      const contents = await this.listContents(zipPath);
      return contents.includes(filePath);
    } catch (error) {
      this.logger.error(`Failed to check file in ZIP: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a specific file from ZIP without extracting everything
   * @param zipPath Path to ZIP file
   * @param filePath File path within ZIP
   * @returns Promise<Buffer | null> File buffer or null if not found
   */
  async getFile(zipPath: string, filePath: string): Promise<Buffer | null> {
    try {
      if (!(await fs.pathExists(zipPath))) {
        throw new Error(`ZIP file not found: ${zipPath}`);
      }

      const zip = new AdmZip(zipPath);
      const entry = zip.getEntry(filePath);

      if (!entry) {
        this.logger.warn(`File not found in ZIP: ${filePath}`);
        return null;
      }

      return entry.getData();
    } catch (error) {
      this.logger.error(`Failed to get file from ZIP: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate if file is a valid ZIP archive
   * @param zipPath Path to file
   * @returns Promise<boolean> True if valid ZIP
   */
  async isValidZip(zipPath: string): Promise<boolean> {
    try {
      if (!(await fs.pathExists(zipPath))) {
        return false;
      }

      const zip = new AdmZip(zipPath);
      // Try to get entries - if it fails, it's not a valid ZIP
      zip.getEntries();
      return true;
    } catch (error) {
      this.logger.debug(`Invalid ZIP file: ${zipPath}`);
      return false;
    }
  }
}
