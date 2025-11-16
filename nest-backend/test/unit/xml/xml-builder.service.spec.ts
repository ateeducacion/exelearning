import { Test, TestingModule } from '@nestjs/testing';
import { XmlBuilderService } from '../../../src/modules/xml/services/xml-builder.service';
import { XmlParserService } from '../../../src/modules/xml/services/xml-parser.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ParsedOdeStructure,
  OdeXmlMeta,
  NormalizedPage,
} from '../../../src/modules/xml/interfaces/ode-xml.interface';

describe('XmlBuilderService', () => {
  let service: XmlBuilderService;
  let parserService: XmlParserService;
  let testDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XmlBuilderService, XmlParserService],
    }).compile();

    service = module.get<XmlBuilderService>(XmlBuilderService);
    parserService = module.get<XmlParserService>(XmlParserService);

    // Create test directory
    testDir = path.join(__dirname, '..', '..', 'temp', 'xml-builder-test');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.remove(testDir);
  });

  describe('buildFromStructure', () => {
    it('should build simple XML with single page', () => {
      const structure: ParsedOdeStructure = {
        meta: {
          title: 'Test Project',
          author: 'Test Author',
          language: 'en',
          version: '3.0',
          exelearning_version: '3.0',
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-01-01T00:00:00.000Z',
        },
        pages: [
          {
            id: '0',
            title: 'Home Page',
            level: 0,
            parent_id: null,
            position: 0,
            components: [
              {
                id: 'component_0',
                type: 'TextComponent',
                position: 0,
                content: 'Hello World',
                properties: {},
                data: null,
              },
            ],
          },
        ],
        navigation: {
          page: {
            id: '0',
            title: 'Home Page',
            component: {
              id: 'component_0',
              type: 'TextComponent',
              position: 0,
              content: 'Hello World',
              properties: {},
              data: null,
            },
          },
        },
      };

      const xml = service.buildFromStructure(structure);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<exe_document>');
      expect(xml).toContain('<meta>');
      expect(xml).toContain('<title>Test Project</title>');
      expect(xml).toContain('<author>Test Author</author>');
      expect(xml).toContain('<navigation>');
      expect(xml).toContain('<page');
      expect(xml).toContain('id="0"');
      expect(xml).toContain('title="Home Page"');
    });

    it('should build XML with nested pages', () => {
      const structure: ParsedOdeStructure = {
        meta: {
          title: 'Nested Project',
          author: '',
          language: 'en',
          version: '3.0',
          exelearning_version: '3.0',
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-01-01T00:00:00.000Z',
        },
        pages: [
          {
            id: '0',
            title: 'Parent',
            level: 0,
            parent_id: null,
            position: 0,
            components: [],
          },
          {
            id: '1',
            title: 'Child',
            level: 1,
            parent_id: '0',
            position: 0,
            components: [],
          },
        ],
        navigation: {
          page: {
            id: '0',
            title: 'Parent',
          },
        },
      };

      const xml = service.buildFromStructure(structure);

      expect(xml).toContain('<exe_document>');
      expect(xml).toContain('id="0"');
      expect(xml).toContain('title="Parent"');
      // The builder should reconstruct the nested structure
      expect(xml).toContain('id="1"');
      expect(xml).toContain('title="Child"');
    });

    it('should throw error if no root pages found', () => {
      const structure: ParsedOdeStructure = {
        meta: {
          title: 'Invalid',
          author: '',
          language: 'en',
          version: '3.0',
          exelearning_version: '3.0',
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-01-01T00:00:00.000Z',
        },
        pages: [
          {
            id: '1',
            title: 'Orphan',
            level: 1,
            parent_id: '999', // Non-existent parent
            position: 0,
            components: [],
          },
        ],
        navigation: { page: { id: '0', title: 'Dummy' } },
      };

      expect(() => service.buildFromStructure(structure)).toThrow(
        'No root pages found in structure',
      );
    });
  });

  describe('writeToFile', () => {
    it('should write XML to file', async () => {
      const structure: ParsedOdeStructure = {
        meta: {
          title: 'File Test',
          author: '',
          language: 'en',
          version: '3.0',
          exelearning_version: '3.0',
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-01-01T00:00:00.000Z',
        },
        pages: [
          {
            id: '0',
            title: 'Test Page',
            level: 0,
            parent_id: null,
            position: 0,
            components: [],
          },
        ],
        navigation: {
          page: {
            id: '0',
            title: 'Test Page',
          },
        },
      };

      const outputPath = path.join(testDir, 'output.xml');
      const result = await service.writeToFile(structure, outputPath);

      expect(result).toBe(outputPath);
      expect(await fs.pathExists(outputPath)).toBe(true);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<title>File Test</title>');
    });

    it('should create output directory if it does not exist', async () => {
      const structure: ParsedOdeStructure = {
        meta: {
          title: 'Dir Test',
          author: '',
          language: 'en',
          version: '3.0',
          exelearning_version: '3.0',
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-01-01T00:00:00.000Z',
        },
        pages: [
          {
            id: '0',
            title: 'Test',
            level: 0,
            parent_id: null,
            position: 0,
            components: [],
          },
        ],
        navigation: { page: { id: '0', title: 'Test' } },
      };

      const nestedPath = path.join(testDir, 'nested', 'deep', 'output.xml');
      await service.writeToFile(structure, nestedPath);

      expect(await fs.pathExists(nestedPath)).toBe(true);
    });
  });

  describe('createDefaultMetadata', () => {
    it('should create default metadata with title and author', () => {
      const meta = service.createDefaultMetadata('My Project', 'John Doe');

      expect(meta.title).toBe('My Project');
      expect(meta.author).toBe('John Doe');
      expect(meta.language).toBe('en');
      expect(meta.version).toBe('3.0');
      expect(meta.exelearning_version).toBe('3.0');
      expect(meta.structure).toBe('hierarchical');
      expect(meta.created).toBeDefined();
      expect(meta.modified).toBeDefined();
    });

    it('should create default metadata without author', () => {
      const meta = service.createDefaultMetadata('My Project');

      expect(meta.title).toBe('My Project');
      expect(meta.author).toBe('');
    });
  });

  describe('createSimpleStructure', () => {
    it('should create simple single-page structure', () => {
      const structure = service.createSimpleStructure('Test Page', 'Test content');

      expect(structure.meta.title).toBe('Test Page');
      expect(structure.pages).toHaveLength(1);
      expect(structure.pages[0].id).toBe('0');
      expect(structure.pages[0].title).toBe('Test Page');
      expect(structure.pages[0].components).toHaveLength(1);
      expect(structure.pages[0].components[0].type).toBe('TextComponent');
      expect(structure.pages[0].components[0].content).toBe('Test content');
    });

    it('should create simple structure without content', () => {
      const structure = service.createSimpleStructure('Empty Page');

      expect(structure.pages).toHaveLength(1);
      expect(structure.pages[0].components[0].content).toBe('');
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata fields', () => {
      const originalStructure: ParsedOdeStructure = {
        meta: {
          title: 'Original Title',
          author: 'Original Author',
          language: 'en',
          version: '3.0',
          exelearning_version: '3.0',
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-01-01T00:00:00.000Z',
        },
        pages: [],
        navigation: { page: { id: '0', title: 'Test' } },
      };

      const updated = service.updateMetadata(originalStructure, {
        title: 'Updated Title',
        description: 'New description',
      });

      expect(updated.meta.title).toBe('Updated Title');
      expect(updated.meta.description).toBe('New description');
      expect(updated.meta.author).toBe('Original Author'); // Unchanged
      expect(updated.meta.modified).not.toBe('2024-01-01T00:00:00.000Z'); // Updated
    });

    it('should not modify original structure', () => {
      const originalStructure: ParsedOdeStructure = {
        meta: {
          title: 'Original',
          author: '',
          language: 'en',
          version: '3.0',
          exelearning_version: '3.0',
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-01-01T00:00:00.000Z',
        },
        pages: [],
        navigation: { page: { id: '0', title: 'Test' } },
      };

      const updated = service.updateMetadata(originalStructure, {
        title: 'Modified',
      });

      expect(originalStructure.meta.title).toBe('Original');
      expect(updated.meta.title).toBe('Modified');
    });
  });

  describe('round-trip parsing and building', () => {
    it('should preserve structure through parse and build cycle', () => {
      const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta>
    <title>Round Trip Test</title>
    <author>Test Author</author>
    <language>en</language>
  </meta>
  <navigation>
    <page id="0" title="Page 1">
      <component type="TextComponent">
        <content>Content 1</content>
      </component>
      <page id="1" title="Page 2">
        <component type="TextComponent">
          <content>Content 2</content>
        </component>
      </page>
    </page>
  </navigation>
</exe_document>`;

      // Parse original XML
      const parsed = parserService.parseFromString(originalXml);

      // Build XML from parsed structure
      const rebuilt = service.buildFromStructure(parsed);

      // Parse the rebuilt XML
      const reparsed = parserService.parseFromString(rebuilt);

      // Compare structures
      expect(reparsed.meta.title).toBe(parsed.meta.title);
      expect(reparsed.meta.author).toBe(parsed.meta.author);
      expect(reparsed.pages.length).toBe(parsed.pages.length);
      expect(reparsed.pages[0].id).toBe(parsed.pages[0].id);
      expect(reparsed.pages[0].title).toBe(parsed.pages[0].title);
      expect(reparsed.pages[1].id).toBe(parsed.pages[1].id);
      expect(reparsed.pages[1].title).toBe(parsed.pages[1].title);
    });

    it('should handle complex nested structures in round-trip', () => {
      const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta>
    <title>Complex Structure</title>
  </meta>
  <navigation>
    <page id="0" title="Root 1">
      <page id="1" title="Child 1.1">
        <page id="2" title="Grandchild 1.1.1" />
      </page>
      <page id="3" title="Child 1.2" />
    </page>
    <page id="4" title="Root 2">
      <page id="5" title="Child 2.1" />
    </page>
  </navigation>
</exe_document>`;

      const parsed = parserService.parseFromString(originalXml);
      const rebuilt = service.buildFromStructure(parsed);
      const reparsed = parserService.parseFromString(rebuilt);

      expect(reparsed.pages.length).toBe(6);

      // Verify hierarchy is preserved
      const root1 = reparsed.pages.find(p => p.id === '0');
      const child11 = reparsed.pages.find(p => p.id === '1');
      const grandchild111 = reparsed.pages.find(p => p.id === '2');
      const child12 = reparsed.pages.find(p => p.id === '3');
      const root2 = reparsed.pages.find(p => p.id === '4');
      const child21 = reparsed.pages.find(p => p.id === '5');

      // Use undefined for root pages since that's what the parser returns
      expect(root1?.parent_id == null).toBe(true); // null or undefined
      expect(child11?.parent_id).toBe('0');
      expect(grandchild111?.parent_id).toBe('1');
      expect(child12?.parent_id).toBe('0');
      expect(root2?.parent_id == null).toBe(true); // null or undefined
      expect(child21?.parent_id).toBe('4');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple components in round-trip', () => {
      const structure: ParsedOdeStructure = {
        meta: service.createDefaultMetadata('Multi Component'),
        pages: [
          {
            id: '0',
            title: 'Page',
            level: 0,
            parent_id: null,
            position: 0,
            components: [
              {
                id: 'c1',
                type: 'TextComponent',
                position: 0,
                content: 'Text 1',
                properties: {},
                data: null,
              },
              {
                id: 'c2',
                type: 'ImageComponent',
                position: 1,
                content: '',
                properties: { src: 'image.png' },
                data: null,
              },
            ],
          },
        ],
        navigation: { page: { id: '0', title: 'Page' } },
      };

      const xml = service.buildFromStructure(structure);
      const reparsed = parserService.parseFromString(xml);

      expect(reparsed.pages[0].components).toHaveLength(2);
      expect(reparsed.pages[0].components[0].type).toBe('TextComponent');
      expect(reparsed.pages[0].components[1].type).toBe('ImageComponent');
    });

    it('should handle empty pages list', () => {
      const structure: ParsedOdeStructure = {
        meta: service.createDefaultMetadata('Empty'),
        pages: [
          {
            id: '0',
            title: 'Root',
            level: 0,
            parent_id: null,
            position: 0,
            components: [],
          },
        ],
        navigation: { page: { id: '0', title: 'Root' } },
      };

      const xml = service.buildFromStructure(structure);

      expect(xml).toContain('<exe_document>');
      expect(xml).toContain('id="0"');
    });

    it('should handle special characters in content', () => {
      const structure = service.createSimpleStructure(
        'Special Chars',
        '<>&"\'Special content',
      );

      const xml = service.buildFromStructure(structure);
      const reparsed = parserService.parseFromString(xml);

      expect(reparsed.pages[0].components[0].content).toBe(
        '<>&"\'Special content',
      );
    });

    it('should handle multiple root pages', () => {
      const structure: ParsedOdeStructure = {
        meta: service.createDefaultMetadata('Multi Root'),
        pages: [
          {
            id: '0',
            title: 'Root 1',
            level: 0,
            parent_id: null,
            position: 0,
            components: [],
          },
          {
            id: '1',
            title: 'Root 2',
            level: 0,
            parent_id: null,
            position: 1,
            components: [],
          },
          {
            id: '2',
            title: 'Root 3',
            level: 0,
            parent_id: null,
            position: 2,
            components: [],
          },
        ],
        navigation: { page: { id: '0', title: 'Root 1' } },
      };

      const xml = service.buildFromStructure(structure);
      const reparsed = parserService.parseFromString(xml);

      expect(reparsed.pages).toHaveLength(3);
      expect(reparsed.pages.every(p => p.level === 0)).toBe(true);
    });
  });
});
