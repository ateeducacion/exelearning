import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock Logger
globalThis.Logger = {
  log: () => {},
  warn: () => {},
  error: () => {}
};

let BaseAdcHandler;

beforeAll(() => {
  // Load and execute the script to get the class
  const scriptPath = join(import.meta.dirname, 'BaseAdcHandler.js');
  const scriptContent = readFileSync(scriptPath, 'utf-8');
  // Execute in current context
  const fn = new Function(scriptContent + '\nreturn BaseAdcHandler;');
  BaseAdcHandler = fn();
});

describe('BaseAdcHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new BaseAdcHandler();
  });

  describe('abstract methods', () => {
    it('canHandle throws error when not implemented', () => {
      expect(() => handler.canHandle('test')).toThrow('must be implemented');
    });

    it('getTargetType throws error when not implemented', () => {
      expect(() => handler.getTargetType()).toThrow('must be implemented');
    });

    it('extractHtmlView returns empty string by default', () => {
      expect(handler.extractHtmlView(null, null, null)).toBe('');
    });

    it('extractProperties returns empty object by default', () => {
      expect(handler.extractProperties(null, null, null)).toEqual({});
    });
  });

  describe('getLocalizedText', () => {
    it('returns empty string for null input', () => {
      expect(handler.getLocalizedText(null)).toBe('');
    });

    it('returns string as-is', () => {
      expect(handler.getLocalizedText('hello')).toBe('hello');
    });

    it('extracts Spanish text from object', () => {
      expect(handler.getLocalizedText({ es: 'Hola', en: 'Hello' })).toBe('Hola');
    });

    it('extracts default language when Spanish not available', () => {
      expect(handler.getLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'en')).toBe('Hello');
    });

    it('falls back to any available language', () => {
      expect(handler.getLocalizedText({ fr: 'Bonjour' })).toBe('Bonjour');
    });
  });

  describe('findComponent', () => {
    it('returns null for null componentId', () => {
      expect(handler.findComponent(null, {})).toBeNull();
    });

    it('returns null for null allComponents', () => {
      expect(handler.findComponent('id', null)).toBeNull();
    });

    it('returns component when found', () => {
      const allComponents = { 'comp1': { id: 'comp1', name: 'test' } };
      expect(handler.findComponent('comp1', allComponents)).toEqual({ id: 'comp1', name: 'test' });
    });

    it('returns null when component not found', () => {
      const allComponents = { 'comp1': { id: 'comp1' } };
      expect(handler.findComponent('comp2', allComponents)).toBeNull();
    });
  });

  describe('findChildComponents', () => {
    it('returns empty array for null parentId', () => {
      expect(handler.findChildComponents(null, {})).toEqual([]);
    });

    it('returns empty array when parent has no children', () => {
      const allComponents = { 'parent': { id: 'parent' } };
      expect(handler.findChildComponents('parent', allComponents)).toEqual([]);
    });

    it('returns child components', () => {
      const allComponents = {
        'parent': { id: 'parent', componentChildren: ['child1', 'child2'] },
        'child1': { id: 'child1', name: 'Child 1' },
        'child2': { id: 'child2', name: 'Child 2' }
      };
      const children = handler.findChildComponents('parent', allComponents);
      expect(children).toHaveLength(2);
      expect(children[0].name).toBe('Child 1');
      expect(children[1].name).toBe('Child 2');
    });
  });

  describe('extractTextContent', () => {
    it('returns empty string for null component', () => {
      expect(handler.extractTextContent(null)).toBe('');
    });

    it('extracts textContent from properties', () => {
      const component = { properties: { textContent: '<p>Hello</p>' } };
      expect(handler.extractTextContent(component)).toBe('<p>Hello</p>');
    });

    it('extracts text from properties', () => {
      const component = { properties: { text: 'Hello' } };
      expect(handler.extractTextContent(component)).toBe('Hello');
    });
  });

  describe('decodeHtmlContent', () => {
    it('returns empty string for null', () => {
      expect(handler.decodeHtmlContent(null)).toBe('');
    });

    it('decodes HTML entities', () => {
      expect(handler.decodeHtmlContent('&lt;p&gt;Test&lt;/p&gt;')).toBe('<p>Test</p>');
      expect(handler.decodeHtmlContent('&amp;')).toBe('&');
      expect(handler.decodeHtmlContent('&quot;')).toBe('"');
    });

    it('decodes numeric entities', () => {
      expect(handler.decodeHtmlContent('&#65;')).toBe('A');
      expect(handler.decodeHtmlContent('&#x41;')).toBe('A');
    });
  });

  describe('stripHtmlTags', () => {
    it('returns empty string for null', () => {
      expect(handler.stripHtmlTags(null)).toBe('');
    });

    it('removes HTML tags', () => {
      expect(handler.stripHtmlTags('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
    });
  });

  describe('normalizeActivityType', () => {
    it('returns empty string for null', () => {
      expect(handler.normalizeActivityType(null)).toBe('');
    });

    it('extracts type from URI', () => {
      expect(handler.normalizeActivityType('https://w3id.org/xapi/smart/activity/essay')).toBe('essay');
    });

    it('returns short name as-is', () => {
      expect(handler.normalizeActivityType('essay')).toBe('essay');
    });
  });

  describe('extractYouTubeId', () => {
    it('returns null for null input', () => {
      expect(handler.extractYouTubeId(null)).toBeNull();
    });

    it('extracts ID from watch URL', () => {
      expect(handler.extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from short URL', () => {
      expect(handler.extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from embed URL', () => {
      expect(handler.extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('extractVimeoId', () => {
    it('returns null for null input', () => {
      expect(handler.extractVimeoId(null)).toBeNull();
    });

    it('extracts ID from Vimeo URL', () => {
      expect(handler.extractVimeoId('https://vimeo.com/123456789')).toBe('123456789');
    });
  });

  describe('generateId', () => {
    it('generates ID with prefix', () => {
      const id = handler.generateId('page');
      expect(id.startsWith('page-')).toBe(true);
    });

    it('generates unique IDs', () => {
      const id1 = handler.generateId('block');
      const id2 = handler.generateId('block');
      expect(id1).not.toBe(id2);
    });
  });

  describe('detectMediaType', () => {
    it('returns unknown for null', () => {
      expect(handler.detectMediaType(null)).toBe('unknown');
    });

    it('detects YouTube', () => {
      expect(handler.detectMediaType('https://youtube.com/watch?v=xxx')).toBe('youtube');
      expect(handler.detectMediaType('https://youtu.be/xxx')).toBe('youtube');
    });

    it('detects Vimeo', () => {
      expect(handler.detectMediaType('https://vimeo.com/123')).toBe('vimeo');
    });

    it('detects video files', () => {
      expect(handler.detectMediaType('video.mp4')).toBe('video');
      expect(handler.detectMediaType('video.webm')).toBe('video');
    });

    it('detects audio files', () => {
      expect(handler.detectMediaType('audio.mp3')).toBe('audio');
      expect(handler.detectMediaType('audio.wav')).toBe('audio');
    });
  });
});
