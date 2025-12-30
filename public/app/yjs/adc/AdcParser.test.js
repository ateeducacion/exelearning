import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock Logger
globalThis.Logger = {
  log: () => {},
  warn: () => {},
  error: () => {}
};

// Mock handler registry
globalThis.AdcHandlerRegistry = {
  getHandler: () => ({
    getTargetType: () => 'text',
    extractHtmlView: () => '<p>Content</p>',
    extractProperties: () => ({})
  })
};

let AdcParser;

beforeAll(() => {
  // Load and execute the script to get the class
  const scriptPath = join(import.meta.dirname, 'AdcParser.js');
  const scriptContent = readFileSync(scriptPath, 'utf-8');
  // Execute in current context - need to handle window reference
  const wrappedScript = `
    const window = globalThis;
    ${scriptContent}
    return AdcParser;
  `;
  const fn = new Function(wrappedScript);
  AdcParser = fn();
});

describe('AdcParser', () => {
  // Helper to create a mock ZIP with JSON files
  const createMockZip = (cmi5Data, componentsData, projectData = null) => {
    const zip = {};
    if (cmi5Data) {
      zip['cmi5.json'] = new TextEncoder().encode(JSON.stringify(cmi5Data));
    }
    if (componentsData) {
      zip['components.json'] = new TextEncoder().encode(JSON.stringify(componentsData));
    }
    if (projectData) {
      zip['project.json'] = new TextEncoder().encode(JSON.stringify(projectData));
    }
    return zip;
  };

  describe('constructor', () => {
    it('initializes with zip', () => {
      const zip = {};
      const parser = new AdcParser(zip);
      expect(parser.zip).toBe(zip);
      expect(parser.cmi5).toBeNull();
      expect(parser.components).toBeNull();
    });
  });

  describe('parseJson', () => {
    it('returns null for missing file', () => {
      const parser = new AdcParser({});
      expect(parser.parseJson('missing.json')).toBeNull();
    });

    it('parses valid JSON', () => {
      const data = { test: 'value' };
      const zip = {
        'test.json': new TextEncoder().encode(JSON.stringify(data))
      };
      const parser = new AdcParser(zip);
      expect(parser.parseJson('test.json')).toEqual(data);
    });

    it('returns null for invalid JSON', () => {
      const zip = {
        'test.json': new TextEncoder().encode('not valid json')
      };
      const parser = new AdcParser(zip);
      expect(parser.parseJson('test.json')).toBeNull();
    });
  });

  describe('parse', () => {
    it('throws error for missing cmi5.json', () => {
      const zip = createMockZip(null, {});
      const parser = new AdcParser(zip);
      expect(() => parser.parse()).toThrow('Missing or invalid cmi5.json');
    });

    it('throws error for missing components.json', () => {
      const zip = createMockZip({ unitMetadata: {} }, null);
      const parser = new AdcParser(zip);
      expect(() => parser.parse()).toThrow('Missing or invalid components.json');
    });

    it('returns parsed structure', () => {
      const cmi5 = {
        unitMetadata: {
          id: 'unit1',
          title: { es: 'Test Unit' },
          auOrBlock: []
        }
      };
      const components = {};
      const zip = createMockZip(cmi5, components);
      const parser = new AdcParser(zip);

      const result = parser.parse();

      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('pages');
      expect(result.meta.title).toBe('Test Unit');
    });
  });

  describe('extractMetadata', () => {
    it('extracts title from cmi5', () => {
      const cmi5 = {
        unitMetadata: {
          title: { es: 'Mi Unidad' },
          description: { es: 'Descripción' }
        }
      };
      const zip = createMockZip(cmi5, {});
      const parser = new AdcParser(zip);
      parser.cmi5 = cmi5;

      const meta = parser.extractMetadata();

      expect(meta.title).toBe('Mi Unidad');
    });
  });

  describe('buildPages', () => {
    it('returns empty array for no lessons', () => {
      const cmi5 = {
        unitMetadata: {
          title: { es: 'Test' },
          auOrBlock: []
        }
      };
      const zip = createMockZip(cmi5, {});
      const parser = new AdcParser(zip);
      parser.cmi5 = cmi5;
      parser.components = {};

      const pages = parser.buildPages();

      expect(pages).toEqual([]);
    });

    it('creates pages from lessons', () => {
      const cmi5 = {
        unitMetadata: {
          title: { es: 'Test' },
          auOrBlock: [
            {
              id: 'lesson1',
              title: { es: 'Lección 1' },
              componentId: 'comp1',
              auOrBlock: []
            }
          ]
        }
      };
      const components = {
        comp1: { id: 'comp1', componentName: 'pageContent' }
      };
      const zip = createMockZip(cmi5, components);
      const parser = new AdcParser(zip);
      parser.cmi5 = cmi5;
      parser.components = components;

      const pages = parser.buildPages();

      expect(pages).toHaveLength(1);
      expect(pages[0].pageName).toBe('Lección 1');
    });

    it('skips disabled lessons', () => {
      const cmi5 = {
        unitMetadata: {
          title: { es: 'Test' },
          auOrBlock: [
            {
              id: 'lesson1',
              title: { es: 'Enabled' },
              disabled: false,
              auOrBlock: []
            },
            {
              id: 'lesson2',
              title: { es: 'Disabled' },
              disabled: true,
              auOrBlock: []
            }
          ]
        }
      };
      const zip = createMockZip(cmi5, {});
      const parser = new AdcParser(zip);
      parser.cmi5 = cmi5;
      parser.components = {};

      const pages = parser.buildPages();

      expect(pages).toHaveLength(1);
      expect(pages[0].pageName).toBe('Enabled');
    });
  });

  describe('getLocalizedText', () => {
    let parser;

    beforeEach(() => {
      parser = new AdcParser({});
    });

    it('returns empty string for null', () => {
      expect(parser.getLocalizedText(null)).toBe('');
    });

    it('returns decoded string', () => {
      expect(parser.getLocalizedText('Hello')).toBe('Hello');
    });

    it('extracts Spanish from object', () => {
      expect(parser.getLocalizedText({ es: 'Hola' })).toBe('Hola');
    });
  });

  describe('decodeUnicode', () => {
    let parser;

    beforeEach(() => {
      parser = new AdcParser({});
    });

    it('returns empty string for null', () => {
      expect(parser.decodeUnicode(null)).toBe('');
    });

    it('decodes unicode escapes', () => {
      expect(parser.decodeUnicode('Canci\\u00f3n')).toBe('Canción');
      expect(parser.decodeUnicode('\\u00bfQu\\u00e9 tal?')).toBe('¿Qué tal?');
    });

    it('preserves non-escaped text', () => {
      expect(parser.decodeUnicode('Normal text')).toBe('Normal text');
    });
  });

  describe('normalizeActivityType', () => {
    let parser;

    beforeEach(() => {
      parser = new AdcParser({});
    });

    it('returns empty string for null', () => {
      expect(parser.normalizeActivityType(null)).toBe('');
    });

    it('extracts type from URI', () => {
      expect(parser.normalizeActivityType('https://w3id.org/xapi/smart/activity/essay')).toBe('essay');
    });

    it('returns short name as-is', () => {
      expect(parser.normalizeActivityType('video')).toBe('video');
    });
  });

  describe('generateId', () => {
    let parser;

    beforeEach(() => {
      parser = new AdcParser({});
    });

    it('generates ID with prefix', () => {
      const id = parser.generateId('page');
      expect(id.startsWith('page-')).toBe(true);
    });

    it('generates unique IDs', () => {
      const id1 = parser.generateId('block');
      const id2 = parser.generateId('block');
      expect(id1).not.toBe(id2);
    });
  });

  describe('truncateTitle', () => {
    let parser;

    beforeEach(() => {
      parser = new AdcParser({});
    });

    it('returns short titles unchanged', () => {
      expect(parser.truncateTitle('Short')).toBe('Short');
    });

    it('truncates long titles', () => {
      const longTitle = 'A'.repeat(150);
      const result = parser.truncateTitle(longTitle, 100);
      expect(result.length).toBe(100);
      expect(result.endsWith('...')).toBe(true);
    });

    it('handles null', () => {
      expect(parser.truncateTitle(null)).toBeNull();
    });
  });

  describe('listAssetPaths', () => {
    it('returns asset paths from resources folder', () => {
      const zip = {
        'cmi5.json': new Uint8Array(),
        'components.json': new Uint8Array(),
        'resources/image.jpg': new Uint8Array(),
        'resources/audio.mp3': new Uint8Array(),
        'resources/': new Uint8Array() // Directory entry
      };
      const parser = new AdcParser(zip);

      const assets = parser.listAssetPaths();

      expect(assets).toContain('resources/image.jpg');
      expect(assets).toContain('resources/audio.mp3');
      expect(assets).not.toContain('cmi5.json');
      expect(assets).not.toContain('resources/');
    });
  });
});
