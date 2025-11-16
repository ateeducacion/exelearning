import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ZipService } from '../../file-management/services/zip.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { XmlParserService } from '../../xml/services/xml-parser.service';
import { CurrentOdeUsersService } from '../../current-ode-users/current-ode-users.service';
import { OdeNavStructureSyncService } from '../../ode-sync-structures/services/ode-nav-structure-sync.service';
import { OdePagStructureSyncService } from '../../ode-sync-structures/services/ode-pag-structure-sync.service';
import { OdeComponentsSyncService } from '../../ode-sync-structures/services/ode-components-sync.service';
import { OdePropertiesSyncService } from '../../ode-properties-sync/ode-properties-sync.service';
import {
  OpenElpResult,
  ProjectSession,
  OpenElpOptions,
} from '../dto/project.dto';

@Injectable()
export class ProjectOpenService {
  private readonly logger = new Logger(ProjectOpenService.name);
  private readonly sessions: Map<string, ProjectSession> = new Map();

  constructor(
    private readonly zipService: ZipService,
    private readonly fileHelper: FileHelperService,
    private readonly xmlParser: XmlParserService,
    private readonly configService: ConfigService,
    private readonly currentOdeUsersService: CurrentOdeUsersService,
    private readonly navStructureService: OdeNavStructureSyncService,
    private readonly pagStructureService: OdePagStructureSyncService,
    private readonly componentsService: OdeComponentsSyncService,
    private readonly propertiesService: OdePropertiesSyncService,
  ) {}

  /**
   * Open an ELP file and create a new session
   * @param elpFilePath Path to the uploaded ELP file
   * @param options Open options
   * @returns Open result with session ID and structure
   */
  async openElpFile(
    elpFilePath: string,
    options: OpenElpOptions = {},
  ): Promise<OpenElpResult> {
    try {
      this.logger.debug(`Opening ELP file: ${elpFilePath}`);

      // Validate ELP file exists
      if (!(await fs.pathExists(elpFilePath))) {
        throw new Error(`ELP file not found: ${elpFilePath}`);
      }

      // Validate it's a valid ZIP file
      const isValidZip = await this.zipService.isValidZip(elpFilePath);
      if (!isValidZip) {
        throw new Error('Invalid ELP file: Not a valid ZIP archive');
      }

      // Generate session ID
      const odeSessionId = uuidv4();

      // Create session directories
      await this.fileHelper.createSessionDirectories(odeSessionId);

      const sessionTempDir = this.fileHelper.getOdeSessionTempDir(odeSessionId);
      const sessionDistDir = this.fileHelper.getOdeSessionDistDir(odeSessionId);

      // Extract ELP to temp directory
      this.logger.debug(`Extracting ELP to: ${sessionTempDir}`);
      await this.zipService.extract(elpFilePath, sessionTempDir, {
        overwrite: options.overwrite ?? true,
      });

      // Look for content XML file (support both old and new formats)
      let contentXmlPath = path.join(sessionTempDir, 'content.xml');
      let isOldFormat = false;

      // If content.xml doesn't exist, try contentv3.xml (old format)
      if (!(await fs.pathExists(contentXmlPath))) {
        contentXmlPath = path.join(sessionTempDir, 'contentv3.xml');
        isOldFormat = true;

        if (!(await fs.pathExists(contentXmlPath))) {
          throw new Error('Invalid ELP file: Missing content.xml or contentv3.xml');
        }

        this.logger.debug('Detected old format ELP file (contentv3.xml)');
      }

      // Parse content XML
      this.logger.debug(`Parsing ${isOldFormat ? 'contentv3.xml' : 'content.xml'}`);
      const structure = await this.xmlParser.parseFromFile(contentXmlPath);

      // Optionally validate XML structure
      if (options.validateXml) {
        const contentXmlContent = await fs.readFile(contentXmlPath, 'utf-8');
        const isValid = await this.xmlParser.validateOdeXml(contentXmlContent);
        if (!isValid) {
          throw new Error('Invalid content.xml structure');
        }
      }

      // Create session
      const session: ProjectSession = {
        odeSessionId,
        created: new Date(),
        modified: new Date(),
        structure,
        sessionPath: sessionTempDir,
        contentPath: contentXmlPath,
      };

      this.sessions.set(odeSessionId, session);

      this.logger.log(`Successfully opened ELP file with session: ${odeSessionId}`);

      return {
        odeSessionId,
        structure,
        sessionPath: sessionTempDir,
        contentPath: contentXmlPath,
      };
    } catch (error) {
      this.logger.error(`Failed to open ELP file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param odeSessionId Session ID
   * @returns Session or null
   */
  getSession(odeSessionId: string): ProjectSession | null {
    return this.sessions.get(odeSessionId) || null;
  }

  /**
   * Update session structure
   * @param odeSessionId Session ID
   * @param structure Updated structure
   */
  async updateSessionStructure(
    odeSessionId: string,
    structure: any,
  ): Promise<void> {
    const session = this.sessions.get(odeSessionId);
    if (!session) {
      throw new Error(`Session not found: ${odeSessionId}`);
    }

    session.structure = structure;
    session.modified = new Date();

    this.sessions.set(odeSessionId, session);
  }

  /**
   * Close session and cleanup
   * @param odeSessionId Session ID
   * @param keepDist Keep dist directory
   */
  async closeSession(
    odeSessionId: string,
    keepDist: boolean = false,
  ): Promise<void> {
    try {
      const session = this.sessions.get(odeSessionId);
      if (!session) {
        this.logger.warn(`Session not found for cleanup: ${odeSessionId}`);
        return;
      }

      // Cleanup session directories
      await this.fileHelper.cleanupSessionDirectories(odeSessionId, keepDist);

      // Remove from sessions map
      this.sessions.delete(odeSessionId);

      this.logger.log(`Session closed: ${odeSessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to close session ${odeSessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * List all active sessions
   * @returns Array of session IDs
   */
  listActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Cleanup old sessions (older than specified hours)
   * @param maxAgeHours Maximum age in hours
   * @returns Number of sessions cleaned up
   */
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    const now = new Date();
    const sessionIds = Array.from(this.sessions.keys());
    let cleanedCount = 0;

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (!session) continue;

      const ageHours =
        (now.getTime() - session.modified.getTime()) / (1000 * 60 * 60);

      if (ageHours > maxAgeHours) {
        await this.closeSession(sessionId, false);
        cleanedCount++;
      }
    }

    this.logger.log(`Cleaned up ${cleanedCount} old sessions`);
    return cleanedCount;
  }

  /**
   * Get file from session
   * @param odeSessionId Session ID
   * @param relativePath Relative path within session
   * @returns File buffer or null
   */
  async getSessionFile(
    odeSessionId: string,
    relativePath: string,
  ): Promise<Buffer | null> {
    try {
      const session = this.sessions.get(odeSessionId);
      if (!session) {
        throw new Error(`Session not found: ${odeSessionId}`);
      }

      const filePath = path.join(session.sessionPath, relativePath);

      // Security check: ensure path is within session directory
      if (!this.fileHelper.isPathSafe(session.sessionPath, filePath)) {
        throw new Error('Invalid file path: Path traversal detected');
      }

      if (!(await fs.pathExists(filePath))) {
        return null;
      }

      return await fs.readFile(filePath);
    } catch (error) {
      this.logger.error(
        `Failed to get session file: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * List files in session directory
   * @param odeSessionId Session ID
   * @param directory Subdirectory (optional)
   * @returns Array of file paths
   */
  async listSessionFiles(
    odeSessionId: string,
    directory: string = '',
  ): Promise<string[]> {
    try {
      const session = this.sessions.get(odeSessionId);
      if (!session) {
        throw new Error(`Session not found: ${odeSessionId}`);
      }

      const targetPath = path.join(session.sessionPath, directory);

      // Security check
      if (!this.fileHelper.isPathSafe(session.sessionPath, targetPath)) {
        throw new Error('Invalid directory path');
      }

      if (!(await fs.pathExists(targetPath))) {
        return [];
      }

      const files: string[] = [];
      await this.recursiveListFiles(targetPath, session.sessionPath, files);
      return files;
    } catch (error) {
      this.logger.error(
        `Failed to list session files: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Recursively list files
   * @param currentPath Current directory path
   * @param basePath Base session path
   * @param files Accumulator array
   */
  private async recursiveListFiles(
    currentPath: string,
    basePath: string,
    files: string[],
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        await this.recursiveListFiles(fullPath, basePath, files);
      } else {
        files.push(relativePath);
      }
    }
  }
}
