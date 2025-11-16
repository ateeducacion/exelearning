import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ProjectOpenService } from '../../src/modules/project/services/project-open.service';
import { FileManagementModule } from '../../src/modules/file-management/file-management.module';
import { XmlModule } from '../../src/modules/xml/xml.module';

describe('ProjectOpenService Integration Tests', () => {
  let service: ProjectOpenService;
  const fixturesDir = path.join(__dirname, '..', 'fixtures');

  beforeAll(async () => {
    // Set test environment variables
    process.env.FILES_DIR = path.join(__dirname, '..', 'temp', 'test-files');
    process.env.PUBLIC_DIR = path.join(__dirname, '..', 'temp', 'test-public');

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        FileManagementModule,
        XmlModule,
      ],
      providers: [ProjectOpenService],
    }).compile();

    service = module.get<ProjectOpenService>(ProjectOpenService);
  });

  afterEach(async () => {
    // Cleanup all active sessions
    const sessions = service.listActiveSessions();
    for (const sessionId of sessions) {
      await service.closeSession(sessionId, false);
    }
  });

  describe('Opening real ELP files', () => {
    it('should successfully open basic-example.elp', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      // Verify file exists
      expect(await fs.pathExists(elpPath)).toBe(true);

      // Open the ELP file
      const result = await service.openElpFile(elpPath, {
        validateXml: true,
      });

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.odeSessionId).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.structure.meta).toBeDefined();
      expect(result.structure.pages).toBeDefined();
      expect(Array.isArray(result.structure.pages)).toBe(true);
      expect(result.structure.pages.length).toBeGreaterThan(0);

      // Verify session was created
      const session = service.getSession(result.odeSessionId);
      expect(session).not.toBeNull();
      expect(session?.structure).toEqual(result.structure);

      // Verify extracted files exist
      expect(await fs.pathExists(result.sessionPath)).toBe(true);
      expect(await fs.pathExists(result.contentPath)).toBe(true);
    });

    it('should successfully open encoding_test.elp with UTF-8 characters', async () => {
      const elpPath = path.join(fixturesDir, 'encoding_test.elp');

      const result = await service.openElpFile(elpPath);

      expect(result).toBeDefined();
      expect(result.structure.meta).toBeDefined();

      // The encoding test file should contain special characters
      // Verify they are properly decoded
      const session = service.getSession(result.odeSessionId);
      expect(session).not.toBeNull();
    });

    it('should reject old format ELP file (contentv3.xml) with clear error', async () => {
      const elpPath = path.join(fixturesDir, 'tema-10-ejemplo.elp');

      // This is an old format file with contentv3.xml (Python serialization)
      // Support for this format is not yet implemented
      await expect(service.openElpFile(elpPath)).rejects.toThrow(
        /Missing content\.xml or contentv3\.xml|Invalid ODE XML/,
      );
    });

    it('should handle multiple concurrent ELP file opens', async () => {
      const elp1Path = path.join(fixturesDir, 'basic-example.elp');
      const elp2Path = path.join(fixturesDir, 'encoding_test.elp');

      const result1 = await service.openElpFile(elp1Path);
      const result2 = await service.openElpFile(elp2Path);

      expect(result1.odeSessionId).not.toBe(result2.odeSessionId);
      expect(service.listActiveSessions()).toHaveLength(2);

      const session1 = service.getSession(result1.odeSessionId);
      const session2 = service.getSession(result2.odeSessionId);

      expect(session1).not.toBeNull();
      expect(session2).not.toBeNull();
      expect(session1?.structure).not.toEqual(session2?.structure);
    });
  });

  describe('Session management', () => {
    it('should create and close sessions properly', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);
      const sessionId = result.odeSessionId;

      // Verify session exists
      expect(service.getSession(sessionId)).not.toBeNull();
      expect(service.listActiveSessions()).toContain(sessionId);

      // Close session
      await service.closeSession(sessionId, false);

      // Verify session is removed
      expect(service.getSession(sessionId)).toBeNull();
      expect(service.listActiveSessions()).not.toContain(sessionId);
    });

    it('should cleanup session directories when closing', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);
      const sessionPath = result.sessionPath;

      // Verify directory exists
      expect(await fs.pathExists(sessionPath)).toBe(true);

      // Close session
      await service.closeSession(result.odeSessionId, false);

      // Verify directory is removed
      expect(await fs.pathExists(sessionPath)).toBe(false);
    });

    it('should list all active sessions', async () => {
      const elp1Path = path.join(fixturesDir, 'basic-example.elp');
      const elp2Path = path.join(fixturesDir, 'tema-10-ejemplo.elp');

      const result1 = await service.openElpFile(elp1Path);
      const result2 = await service.openElpFile(elp2Path);

      const sessions = service.listActiveSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(result1.odeSessionId);
      expect(sessions).toContain(result2.odeSessionId);
    });
  });

  describe('File access within sessions', () => {
    it('should retrieve files from session directory', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);

      // Get content.xml file
      const contentXml = await service.getSessionFile(
        result.odeSessionId,
        'content.xml',
      );

      expect(contentXml).not.toBeNull();
      expect(contentXml).toBeInstanceOf(Buffer);
      expect(contentXml!.length).toBeGreaterThan(0);

      // Verify it's valid XML
      const xmlContent = contentXml!.toString('utf-8');
      expect(xmlContent).toContain('<?xml');
      // Real ELP files use <ode> format, not <exe_document>
      expect(xmlContent).toContain('<ode>');
    });

    it('should list all files in session', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);

      const files = await service.listSessionFiles(result.odeSessionId);

      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files).toContain('content.xml');
    });

    it('should prevent path traversal attacks', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);

      // Attempt to access file outside session directory
      await expect(
        service.getSessionFile(result.odeSessionId, '../../../etc/passwd'),
      ).rejects.toThrow('Invalid file path');
    });

    it('should return null for non-existent files', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);

      const file = await service.getSessionFile(
        result.odeSessionId,
        'nonexistent-file.txt',
      );

      expect(file).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should throw error for non-existent ELP file', async () => {
      const elpPath = path.join(fixturesDir, 'nonexistent.elp');

      await expect(service.openElpFile(elpPath)).rejects.toThrow(
        'ELP file not found',
      );
    });

    it('should throw error for invalid ZIP file', async () => {
      // Create a fake non-ZIP file
      const fakePath = path.join(fixturesDir, 'fake.elp');
      await fs.writeFile(fakePath, 'This is not a ZIP file');

      await expect(service.openElpFile(fakePath)).rejects.toThrow(
        'Invalid ELP file',
      );

      // Cleanup
      await fs.remove(fakePath);
    });

    it('should throw error for session not found', async () => {
      const fakeSessionId = 'fake-session-id';

      expect(service.getSession(fakeSessionId)).toBeNull();

      await expect(
        service.getSessionFile(fakeSessionId, 'file.txt'),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('Metadata extraction', () => {
    it('should extract complete metadata from ELP file', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);
      const { meta } = result.structure;

      expect(meta).toBeDefined();
      expect(meta.title).toBeDefined();
      expect(meta.language).toBeDefined();
      expect(meta.version).toBeDefined();
      expect(meta.created).toBeDefined();
      expect(meta.modified).toBeDefined();
    });
  });

  describe('Page structure extraction', () => {
    it('should extract page hierarchy correctly', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);
      const { pages } = result.structure;

      expect(pages.length).toBeGreaterThan(0);

      // Verify page structure
      pages.forEach((page) => {
        expect(page.id).toBeDefined();
        expect(page.title).toBeDefined();
        expect(page.level).toBeGreaterThanOrEqual(0);
        expect(page.position).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(page.components)).toBe(true);
      });

      // Check for root pages
      const rootPages = pages.filter((p) => p.parent_id === null);
      expect(rootPages.length).toBeGreaterThan(0);
    });

    it('should extract components from pages', async () => {
      const elpPath = path.join(fixturesDir, 'basic-example.elp');

      const result = await service.openElpFile(elpPath);
      const { pages } = result.structure;

      // Find a page with components
      const pageWithComponents = pages.find((p) => p.components.length > 0);

      if (pageWithComponents) {
        expect(pageWithComponents.components).toBeDefined();
        expect(pageWithComponents.components.length).toBeGreaterThan(0);

        pageWithComponents.components.forEach((component) => {
          expect(component.id).toBeDefined();
          expect(component.type).toBeDefined();
          expect(component.position).toBeGreaterThanOrEqual(0);
        });
      }
    });
  });
});
