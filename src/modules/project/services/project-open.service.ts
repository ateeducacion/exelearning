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

      // Check if user has an existing session (if username provided)
      if (options.username) {
        const existingSession = await this.currentOdeUsersService.getCurrentSessionForUser(
          options.username,
        );

        if (existingSession) {
          if (!options.forceCloseSession) {
            throw new ConflictException(
              `User ${options.username} already has an open session: ${existingSession.odeSessionId}. ` +
              'Use forceCloseSession option to close it automatically.',
            );
          }

          // Close existing session
          this.logger.log(
            `Closing existing session ${existingSession.odeSessionId} for user ${options.username}`,
          );
          await this.closeSession(existingSession.odeSessionId, false);
          await this.currentOdeUsersService.delete(existingSession.id);
        }
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

      // Persist structures to database (if username provided)
      if (options.username) {
        await this.persistStructuresToDatabase(odeSessionId, structure, options);
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

  /**
   * Persist parsed structures to database
   * This method saves navigation, pages, blocks, and components to the database
   *
   * @param odeSessionId Session ID
   * @param structure Parsed structure from XML
   * @param options Open options (username, odeId, odeVersionId)
   * @private
   */
  private async persistStructuresToDatabase(
    odeSessionId: string,
    structure: any,
    options: OpenElpOptions,
  ): Promise<void> {
    this.logger.debug(`Persisting structures to database for session: ${odeSessionId}`);

    try {
      // Extract IDs from options or generate defaults
      const odeId = options.odeId || uuidv4();
      const odeVersionId = options.odeVersionId || uuidv4();
      const username = options.username || 'guest';

      // 1. Create CurrentOdeUsers record
      const now = new Date();
      await this.currentOdeUsersService.create({
        odeId,
        odeVersionId,
        odeSessionId,
        user: username,
        lastAction: now,
        lastSync: now,
        syncSaveFlag: false,
        syncNavStructureFlag: false,
        syncPagStructureFlag: false,
        syncComponentsFlag: false,
        syncUpdateFlag: false,
        nodeIp: '127.0.0.1', // TODO: Get from request context
        currentPageId: null,
        currentBlockId: null,
        currentComponentId: null,
      });

      // 2. Save properties (if structure has ode.odeProperties)
      if (structure.ode?.odeProperties?.odeProperty) {
        const properties = Array.isArray(structure.ode.odeProperties.odeProperty)
          ? structure.ode.odeProperties.odeProperty
          : [structure.ode.odeProperties.odeProperty];

        const propertyRecord: Record<string, string> = {};
        for (const prop of properties) {
          propertyRecord[prop.key] = String(prop.value || '');
        }

        if (Object.keys(propertyRecord).length > 0) {
          await this.propertiesService.upsertMultipleProperties(odeSessionId, propertyRecord);
        }
      }

      // 3. Save navigation structures (pages)
      if (structure.ode?.odeNavStructures?.odeNavStructure) {
        const navStructures = Array.isArray(structure.ode.odeNavStructures.odeNavStructure)
          ? structure.ode.odeNavStructures.odeNavStructure
          : [structure.ode.odeNavStructures.odeNavStructure];

        const navDtos = navStructures.map((nav: any, index: number) => ({
          odeSessionId,
          odePageId: nav.odePageId,
          odeParentPageId: nav.odeParentPageId || null,
          pageName: nav.pageName,
          odeNavStructureOrder: nav.odeNavStructureOrder ?? index,
          properties: nav.odeNavStructureProperties?.odeNavStructureProperty
            ? (Array.isArray(nav.odeNavStructureProperties.odeNavStructureProperty)
                ? nav.odeNavStructureProperties.odeNavStructureProperty
                : [nav.odeNavStructureProperties.odeNavStructureProperty]
              ).map((prop: any) => ({
                key: prop.key,
                value: String(prop.value || ''),
                description: null,
              }))
            : [],
        }));

        const savedNavStructures = await this.navStructureService.createBulk(navDtos);
        this.logger.debug(`Persisted ${savedNavStructures.length} navigation structures`);

        // 4. Save page structures (blocks) for each navigation structure
        for (let i = 0; i < navStructures.length; i++) {
          const nav = navStructures[i];
          const savedNav = savedNavStructures[i];

          if (nav.odePagStructures?.odePagStructure) {
            const pagStructures = Array.isArray(nav.odePagStructures.odePagStructure)
              ? nav.odePagStructures.odePagStructure
              : [nav.odePagStructures.odePagStructure];

            const pagDtos = pagStructures.map((pag: any, index: number) => ({
              odeSessionId,
              odePageId: pag.odePageId,
              odeBlockId: pag.odeBlockId,
              blockName: pag.blockName || null,
              iconName: pag.iconName || null,
              odePagStructureOrder: pag.odePagStructureOrder ?? index,
              odeNavStructureSyncId: savedNav.id,
              properties: pag.odePagStructureProperties?.odePagStructureProperty
                ? (Array.isArray(pag.odePagStructureProperties.odePagStructureProperty)
                    ? pag.odePagStructureProperties.odePagStructureProperty
                    : [pag.odePagStructureProperties.odePagStructureProperty]
                  ).map((prop: any) => ({
                    key: prop.key,
                    value: String(prop.value || ''),
                    description: null,
                  }))
                : [],
            }));

            const savedPagStructures = await this.pagStructureService.createBulk(pagDtos);
            this.logger.debug(`Persisted ${savedPagStructures.length} page structures for page ${nav.odePageId}`);

            // 5. Save components (iDevices) for each block
            for (let j = 0; j < pagStructures.length; j++) {
              const pag = pagStructures[j];
              const savedPag = savedPagStructures[j];

              if (pag.odeComponents?.odeComponent) {
                const components = Array.isArray(pag.odeComponents.odeComponent)
                  ? pag.odeComponents.odeComponent
                  : [pag.odeComponents.odeComponent];

                const componentDtos = components.map((comp: any, index: number) => ({
                  odeSessionId,
                  odePageId: comp.odePageId,
                  odeBlockId: comp.odeBlockId,
                  odeIdeviceId: comp.odeIdeviceId || uuidv4(),
                  odeIdeviceTypeName: comp.odeIdeviceTypeName || 'unknown',
                  htmlView: comp.htmlView || null,
                  jsonProperties: comp.jsonProperties || null,
                  odeComponentsSyncOrder: comp.odeComponentsOrder ?? index,
                  odePagStructureSyncId: savedPag.id,
                  properties: comp.odeComponentsProperties?.odeComponentsProperty
                    ? (Array.isArray(comp.odeComponentsProperties.odeComponentsProperty)
                        ? comp.odeComponentsProperties.odeComponentsProperty
                        : [comp.odeComponentsProperties.odeComponentsProperty]
                      ).map((prop: any) => ({
                        key: prop.key,
                        value: String(prop.value || ''),
                        description: null,
                      }))
                    : [],
                }));

                const savedComponents = await this.componentsService.createBulk(componentDtos);
                this.logger.debug(`Persisted ${savedComponents.length} components for block ${pag.odeBlockId}`);
              }
            }
          }
        }
      }

      // 6. Mark all structures as clean (baseline for change detection)
      // Set timestamps to 1 second before current_ode_users.created_at
      const baselineDate = new Date(now.getTime() - 1000);
      await this.navStructureService.markAsClean(odeSessionId, baselineDate);
      await this.pagStructureService.markAsClean(odeSessionId, baselineDate);
      await this.componentsService.markAsClean(odeSessionId, baselineDate);

      this.logger.log(`Successfully persisted complete structure for session ${odeSessionId} to database`);
    } catch (error) {
      this.logger.error(
        `Failed to persist structures to database: ${error.message}`,
        error.stack,
      );
      // Clean up created records on error
      try {
        await this.currentOdeUsersService.removeAllBySessionId(odeSessionId);
        await this.propertiesService.deleteAllBySessionId(odeSessionId);
        await this.navStructureService.deleteBySessionId(odeSessionId);
        await this.pagStructureService.deleteBySessionId(odeSessionId);
        await this.componentsService.deleteBySessionId(odeSessionId);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to cleanup after persistence error: ${cleanupError.message}`,
        );
      }
      throw error;
    }
  }
}
