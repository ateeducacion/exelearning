import { Test, TestingModule } from '@nestjs/testing';
import { XmlParserService } from '../../../src/modules/xml/services/xml-parser.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ParsedOdeStructure,
  OdeXmlMeta,
  NormalizedPage,
} from '../../../src/modules/xml/interfaces/ode-xml.interface';

describe('XmlParserService', () => {
  let service: XmlParserService;
  let testDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XmlParserService],
    }).compile();

    service = module.get<XmlParserService>(XmlParserService);

    // Create test directory
    testDir = path.join(__dirname, '..', '..', 'temp', 'xml-parser-test');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.remove(testDir);
  });

  describe('parseFromString', () => {
    it('should parse simple ODE XML with single page', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta>
    <title>Test Project</title>
    <author>Test Author</author>
    <language>en</language>
  </meta>
  <navigation>
    <page id="0" title="Home Page">
      <component type="TextComponent">
        <content>Hello World</content>
      </component>
    </page>
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result).toBeDefined();
      expect(result.meta.title).toBe('Test Project');
      expect(result.meta.author).toBe('Test Author');
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].id).toBe('0');
      expect(result.pages[0].title).toBe('Home Page');
      expect(result.pages[0].components).toHaveLength(1);
      expect(result.pages[0].components[0].type).toBe('TextComponent');
    });

    it('should parse ODE XML with nested pages', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta>
    <title>Nested Project</title>
  </meta>
  <navigation>
    <page id="0" title="Parent">
      <page id="1" title="Child 1">
        <page id="2" title="Grandchild" />
      </page>
      <page id="3" title="Child 2" />
    </page>
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages).toHaveLength(4);

      // Check parent
      const parent = result.pages.find(p => p.id === '0');
      expect(parent).toBeDefined();
      expect(parent?.level).toBe(0);
      expect(parent?.parent_id).toBeNull();

      // Check child 1
      const child1 = result.pages.find(p => p.id === '1');
      expect(child1).toBeDefined();
      expect(child1?.level).toBe(1);
      expect(child1?.parent_id).toBe('0');

      // Check grandchild
      const grandchild = result.pages.find(p => p.id === '2');
      expect(grandchild).toBeDefined();
      expect(grandchild?.level).toBe(2);
      expect(grandchild?.parent_id).toBe('1');

      // Check child 2
      const child2 = result.pages.find(p => p.id === '3');
      expect(child2).toBeDefined();
      expect(child2?.level).toBe(1);
      expect(child2?.parent_id).toBe('0');
    });

    it('should parse ODE XML with multiple components', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Components Test</title></meta>
  <navigation>
    <page id="0" title="Page">
      <component type="TextComponent" position="0">
        <content>First component</content>
      </component>
      <component type="ImageComponent" position="1">
        <data>image.png</data>
      </component>
      <component type="QuizComponent" position="2">
        <properties>{"questions": []}</properties>
      </component>
    </page>
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].components).toHaveLength(3);
      expect(result.pages[0].components[0].type).toBe('TextComponent');
      expect(result.pages[0].components[1].type).toBe('ImageComponent');
      expect(result.pages[0].components[2].type).toBe('QuizComponent');
    });

    it('should parse complete metadata', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta>
    <title>Full Metadata Test</title>
    <author>John Doe</author>
    <description>A comprehensive test</description>
    <language>es</language>
    <license>CC BY-SA</license>
    <keywords>test, metadata</keywords>
    <version>3.0</version>
    <exelearning_version>3.0.1</exelearning_version>
  </meta>
  <navigation>
    <page id="0" title="Page" />
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.meta.title).toBe('Full Metadata Test');
      expect(result.meta.author).toBe('John Doe');
      expect(result.meta.description).toBe('A comprehensive test');
      expect(result.meta.language).toBe('es');
      expect(result.meta.license).toBe('CC BY-SA');
      expect(result.meta.keywords).toBe('test, metadata');
      expect(result.meta.version).toBe('3.0');
      expect(result.meta.exelearning_version).toBe('3.0.1');
    });

    it('should handle empty navigation gracefully', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Empty Nav</title></meta>
  <navigation></navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages).toHaveLength(0);
    });

    it('should throw error for invalid XML', () => {
      const invalidXml = 'This is not XML';

      expect(() => service.parseFromString(invalidXml)).toThrow();
    });

    it('should throw error for XML without exe_document root', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<invalid_root>
  <meta><title>Test</title></meta>
</invalid_root>`;

      expect(() => service.parseFromString(xml)).toThrow(
        'Invalid ODE XML: Missing exe_document root element',
      );
    });

    it('should handle pages without components', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>No Components</title></meta>
  <navigation>
    <page id="0" title="Empty Page" />
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].components).toHaveLength(0);
    });
  });

  describe('parseFromFile', () => {
    it('should parse XML from file', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>File Test</title></meta>
  <navigation>
    <page id="0" title="Test Page" />
  </navigation>
</exe_document>`;

      const xmlPath = path.join(testDir, 'test.xml');
      await fs.writeFile(xmlPath, xml, 'utf-8');

      const result = await service.parseFromFile(xmlPath);

      expect(result).toBeDefined();
      expect(result.meta.title).toBe('File Test');
      expect(result.pages).toHaveLength(1);
    });

    it('should throw error if file does not exist', async () => {
      const xmlPath = path.join(testDir, 'nonexistent.xml');

      await expect(service.parseFromFile(xmlPath)).rejects.toThrow(
        'XML file not found',
      );
    });

    it('should handle UTF-8 encoded files correctly', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta>
    <title>Título en español</title>
    <description>Descripción con acentos: áéíóú</description>
  </meta>
  <navigation>
    <page id="0" title="Página principal" />
  </navigation>
</exe_document>`;

      const xmlPath = path.join(testDir, 'utf8-test.xml');
      await fs.writeFile(xmlPath, xml, 'utf-8');

      const result = await service.parseFromFile(xmlPath);

      expect(result.meta.title).toBe('Título en español');
      expect(result.meta.description).toBe('Descripción con acentos: áéíóú');
      expect(result.pages[0].title).toBe('Página principal');
    });
  });

  describe('detectFormat', () => {
    it('should detect ODE format', () => {
      const xml = `<?xml version="1.0"?>
<exe_document>
  <meta><title>Test</title></meta>
</exe_document>`;

      const format = service.detectFormat(xml);

      expect(format.format).toBe('ode');
      expect(format.version).toBe('3.0');
      expect(format.requiresConversion).toBe(false);
    });

    it('should detect old EXE format', () => {
      const xml = `<?xml version="1.0"?>
<content>
  <node>
    <title>Test</title>
  </node>
</content>`;

      const format = service.detectFormat(xml);

      expect(format.format).toBe('exe_old');
      expect(format.version).toBe('2.x');
      expect(format.requiresConversion).toBe(true);
    });

    it('should detect unknown format', () => {
      const xml = `<?xml version="1.0"?>
<unknown_format>
  <data>Test</data>
</unknown_format>`;

      const format = service.detectFormat(xml);

      expect(format.format).toBe('unknown');
      expect(format.version).toBe('unknown');
      expect(format.requiresConversion).toBe(true);
    });
  });

  describe('validateOdeXml', () => {
    it('should validate correct ODE XML', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Valid</title></meta>
  <navigation>
    <page id="0" title="Page" />
  </navigation>
</exe_document>`;

      const isValid = await service.validateOdeXml(xml);

      expect(isValid).toBe(true);
    });

    it('should reject XML without exe_document', async () => {
      const xml = `<?xml version="1.0"?>
<invalid_root>
  <meta><title>Invalid</title></meta>
</invalid_root>`;

      const isValid = await service.validateOdeXml(xml);

      expect(isValid).toBe(false);
    });

    it('should reject XML without navigation', async () => {
      const xml = `<?xml version="1.0"?>
<exe_document>
  <meta><title>No Navigation</title></meta>
</exe_document>`;

      const isValid = await service.validateOdeXml(xml);

      expect(isValid).toBe(false);
    });

    it('should reject XML without pages', async () => {
      const xml = `<?xml version="1.0"?>
<exe_document>
  <meta><title>No Pages</title></meta>
  <navigation></navigation>
</exe_document>`;

      const isValid = await service.validateOdeXml(xml);

      expect(isValid).toBe(false);
    });

    it('should reject malformed XML', async () => {
      const xml = 'This is not XML';

      const isValid = await service.validateOdeXml(xml);

      expect(isValid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple root pages', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Multiple Roots</title></meta>
  <navigation>
    <page id="0" title="Root 1" />
    <page id="1" title="Root 2" />
    <page id="2" title="Root 3" />
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages).toHaveLength(3);
      expect(result.pages.every(p => p.level === 0)).toBe(true);
      expect(result.pages.every(p => p.parent_id === null)).toBe(true);
    });

    it('should preserve component order by position', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Order Test</title></meta>
  <navigation>
    <page id="0" title="Page">
      <component type="Third" position="2" />
      <component type="First" position="0" />
      <component type="Second" position="1" />
    </page>
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages[0].components).toHaveLength(3);
      // Components are extracted in order they appear in XML
      expect(result.pages[0].components[0].type).toBe('Third');
      expect(result.pages[0].components[1].type).toBe('First');
      expect(result.pages[0].components[2].type).toBe('Second');
      // But positions are preserved
      expect(result.pages[0].components[0].position).toBe(2);
      expect(result.pages[0].components[1].position).toBe(0);
      expect(result.pages[0].components[2].position).toBe(1);
    });

    it('should handle deeply nested page hierarchies', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Deep Nesting</title></meta>
  <navigation>
    <page id="0" title="Level 0">
      <page id="1" title="Level 1">
        <page id="2" title="Level 2">
          <page id="3" title="Level 3">
            <page id="4" title="Level 4">
              <page id="5" title="Level 5" />
            </page>
          </page>
        </page>
      </page>
    </page>
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages).toHaveLength(6);

      for (let i = 0; i < 6; i++) {
        const page = result.pages.find(p => p.id === i.toString());
        expect(page).toBeDefined();
        expect(page?.level).toBe(i);
        if (i > 0) {
          expect(page?.parent_id).toBe((i - 1).toString());
        }
      }
    });

    it('should handle missing optional metadata fields', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta>
    <title>Minimal Metadata</title>
  </meta>
  <navigation>
    <page id="0" title="Page" />
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.meta.title).toBe('Minimal Metadata');
      expect(result.meta.author).toBe('');
      expect(result.meta.description).toBe('');
      expect(result.meta.language).toBe('en'); // Default
      expect(result.meta.license).toBe('');
    });

    it('should auto-generate IDs for pages without them', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Auto ID</title></meta>
  <navigation>
    <page title="Page Without ID" />
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].id).toMatch(/^page_\d+$/);
    });

    it('should auto-generate component IDs when missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<exe_document>
  <meta><title>Auto Component ID</title></meta>
  <navigation>
    <page id="0" title="Page">
      <component type="TextComponent">
        <content>No ID</content>
      </component>
    </page>
  </navigation>
</exe_document>`;

      const result = service.parseFromString(xml);

      expect(result.pages[0].components).toHaveLength(1);
      expect(result.pages[0].components[0].id).toMatch(/^component_\d+$/);
    });
  });
});
