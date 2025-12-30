/**
 * AdcParser
 *
 * Parser for ADC (Aula Digital Canaria) content packages.
 * Parses cmi5.json and components.json to extract structure and content.
 *
 * ADC Structure:
 * - cmi5.json: Learning hierarchy (Unit -> Lessons -> Activities)
 * - components.json: Component definitions with content (text, images, quizzes)
 * - project.json: Metadata wrapper (optional)
 *
 * Output structure compatible with eXeLearning:
 * - Pages (from lessons)
 * - Blocks with iDevices (from activities)
 */
class AdcParser {
  /**
   * @param {Object} zip - Extracted ZIP object from fflate (filename -> Uint8Array)
   */
  constructor(zip) {
    this.zip = zip;
    this.cmi5 = null;
    this.components = null;
    this.project = null;

    // Handler registry for activity types
    this.handlerRegistry = window.AdcHandlerRegistry || null;
  }

  /**
   * Parse all ADC JSON files and build eXeLearning structure
   * @returns {Object} { meta, pages }
   */
  parse() {
    // Parse JSON files
    this.cmi5 = this.parseJson('cmi5.json');
    this.components = this.parseJson('components.json');
    this.project = this.parseJson('project.json');

    if (!this.cmi5) {
      throw new Error('Missing or invalid cmi5.json');
    }
    if (!this.components) {
      throw new Error('Missing or invalid components.json');
    }

    Logger.log('[AdcParser] Parsed cmi5.json and components.json');
    Logger.log(`[AdcParser] Found ${Object.keys(this.components).length} components`);

    return {
      meta: this.extractMetadata(),
      pages: this.buildPages()
    };
  }

  /**
   * Parse a JSON file from the ZIP
   * @param {string} filename - Filename to parse
   * @returns {Object|null} Parsed JSON or null
   */
  parseJson(filename) {
    const data = this.zip[filename];
    if (!data) return null;

    try {
      const text = new TextDecoder().decode(data);
      return JSON.parse(text);
    } catch (e) {
      Logger.warn(`[AdcParser] Failed to parse ${filename}:`, e);
      return null;
    }
  }

  /**
   * Extract project metadata
   * @returns {Object} Metadata object
   */
  extractMetadata() {
    const unitMeta = this.cmi5.unitMetadata || {};
    const projectMeta = this.project?.es?.project || {};

    return {
      title: this.getLocalizedText(unitMeta.title) || projectMeta.name || 'ADC Import',
      description: this.getLocalizedText(unitMeta.description) || '',
      author: '',
      language: this.detectLanguage(),
      // ADC-specific metadata (not used but preserved)
      adcUnitId: unitMeta.id || '',
      adcComponentId: unitMeta.componentId || ''
    };
  }

  /**
   * Detect language from content
   * @returns {string} Language code
   */
  detectLanguage() {
    // Check project.json first
    if (this.project?.es) return 'es';

    // Check cmi5.json title
    const title = this.cmi5?.unitMetadata?.title;
    if (title) {
      const langs = Object.keys(title);
      if (langs.length > 0) return langs[0];
    }

    return 'es'; // Default to Spanish for ADC (Canarias)
  }

  /**
   * Build page hierarchy from cmi5.json structure
   * @returns {Array<Object>} Array of page objects
   */
  buildPages() {
    const pages = [];
    const unitMeta = this.cmi5.unitMetadata;

    if (!unitMeta || !unitMeta.auOrBlock) {
      Logger.warn('[AdcParser] No auOrBlock found in unitMetadata');
      return pages;
    }

    // Process each lesson (top-level items in auOrBlock)
    const lessons = unitMeta.auOrBlock || [];

    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex++) {
      const lesson = lessons[lessonIndex];

      // Skip disabled lessons
      if (lesson.disabled === true) continue;

      const page = this.buildPage(lesson, lessonIndex, null);
      if (page) {
        pages.push(page);
      }
    }

    Logger.log(`[AdcParser] Built ${pages.length} pages`);
    return pages;
  }

  /**
   * Build a page from a lesson
   * @param {Object} lesson - Lesson from cmi5.json
   * @param {number} index - Lesson index
   * @param {string|null} parentId - Parent page ID (for nested lessons)
   * @returns {Object} Page object
   */
  buildPage(lesson, index, parentId) {
    const pageId = this.generateId('page');
    const title = this.getLocalizedText(lesson.title) || `Page ${index + 1}`;

    // Get page component for background image, etc.
    const pageComponent = this.findComponent(lesson.componentId);

    const page = {
      id: pageId,
      pageName: title,
      title: title,
      parentId: parentId,
      order: index,
      blocks: [],
      properties: {
        visibility: 'true',
        highlight: 'false',
        hidePageTitle: 'false',
        editableInPage: 'false',
        titlePage: '',
        titleNode: ''
      }
    };

    // Extract background image if available
    if (pageComponent?.extendedProperties?.backgroundImage?.relativePath) {
      page.backgroundImage = pageComponent.extendedProperties.backgroundImage.relativePath;
    }

    // Process activities as blocks
    const activities = lesson.auOrBlock || [];

    for (let actIndex = 0; actIndex < activities.length; actIndex++) {
      const activity = activities[actIndex];

      // Check if this is a nested lesson (has auOrBlock children) or an activity
      const isNestedLesson = activity.activityType?.includes('/lesson') ||
                            (activity.auOrBlock && activity.auOrBlock.length > 0 &&
                             !activity.activityType?.includes('/activity'));

      if (isNestedLesson) {
        // This is a sub-lesson - create a child page (skip for now, flatten structure)
        // For ADC, we typically flatten the structure to avoid too deep nesting
        // Process its activities as blocks on this page
        const subActivities = activity.auOrBlock || [];
        for (let subIndex = 0; subIndex < subActivities.length; subIndex++) {
          const subActivity = subActivities[subIndex];
          const block = this.buildBlock(subActivity, page.blocks.length);
          if (block) {
            page.blocks.push(block);
          }
        }
      } else {
        // This is an activity - create a block
        const block = this.buildBlock(activity, actIndex);
        if (block) {
          page.blocks.push(block);
        }
      }
    }

    return page;
  }

  /**
   * Build a block from an activity
   * @param {Object} activity - Activity from cmi5.json
   * @param {number} index - Activity index
   * @returns {Object|null} Block object or null
   */
  buildBlock(activity, index) {
    const activityType = this.normalizeActivityType(activity.activityType);
    const component = this.findComponent(activity.componentId);

    // Get handler for this activity type
    const handler = this.handlerRegistry?.getHandler(activityType);
    if (!handler) {
      Logger.warn(`[AdcParser] No handler for activity type: ${activityType}`);
      return this.buildDefaultBlock(activity, component, index);
    }

    const targetType = handler.getTargetType();
    const title = this.getLocalizedText(activity.title) || '';

    // Extract content using handler
    let htmlView = '';
    let jsonProperties = {};

    try {
      htmlView = handler.extractHtmlView(component, activity, this.components);
      jsonProperties = handler.extractProperties(component, activity, this.components);
    } catch (e) {
      Logger.warn(`[AdcParser] Handler error for ${activityType}:`, e);
      // Fall back to default extraction
      htmlView = this.extractDefaultHtml(component);
    }

    const blockId = this.generateId('block');
    const ideviceId = this.generateId('idevice');

    return {
      id: blockId,
      blockId: blockId,
      blockName: this.truncateTitle(title, 100),
      iconName: targetType,
      order: index,
      createdAt: new Date().toISOString(),
      components: [{
        id: ideviceId,
        ideviceId: ideviceId,
        ideviceType: targetType,
        type: 'base',
        order: 0,
        createdAt: new Date().toISOString(),
        htmlView: htmlView,
        jsonProperties: jsonProperties,
        properties: {
          visibility: 'true',
          teacherOnly: 'false',
          identifier: '',
          cssClass: ''
        }
      }],
      properties: {
        visibility: 'true',
        teacherOnly: 'false',
        allowToggle: 'true',
        minimized: 'false',
        identifier: '',
        cssClass: ''
      }
    };
  }

  /**
   * Build a default block when no handler is available
   * @param {Object} activity - Activity object
   * @param {Object} component - Component object
   * @param {number} index - Block index
   * @returns {Object} Block object
   */
  buildDefaultBlock(activity, component, index) {
    const title = this.getLocalizedText(activity.title) || '';
    const htmlView = this.extractDefaultHtml(component);

    const blockId = this.generateId('block');
    const ideviceId = this.generateId('idevice');

    return {
      id: blockId,
      blockId: blockId,
      blockName: this.truncateTitle(title, 100),
      iconName: 'text',
      order: index,
      createdAt: new Date().toISOString(),
      components: [{
        id: ideviceId,
        ideviceId: ideviceId,
        ideviceType: 'text',
        type: 'base',
        order: 0,
        createdAt: new Date().toISOString(),
        htmlView: htmlView,
        jsonProperties: {},
        properties: {
          visibility: 'true',
          teacherOnly: 'false',
          identifier: '',
          cssClass: ''
        }
      }],
      properties: {
        visibility: 'true',
        teacherOnly: 'false',
        allowToggle: 'true',
        minimized: 'false',
        identifier: '',
        cssClass: ''
      }
    };
  }

  /**
   * Extract default HTML content from a component tree
   * @param {Object} component - Root component
   * @returns {string} HTML content
   */
  extractDefaultHtml(component) {
    if (!component) return '';

    const htmlParts = [];

    // Recursively collect text content from component and children
    this.collectTextContent(component, htmlParts);

    return htmlParts.join('\n');
  }

  /**
   * Recursively collect text content from component tree
   * @param {Object} component - Component object
   * @param {Array<string>} htmlParts - Array to collect HTML parts
   */
  collectTextContent(component, htmlParts) {
    if (!component) return;

    // Extract text content if present
    if (component.properties?.textContent) {
      htmlParts.push(component.properties.textContent);
    }

    // Process images
    if (component.componentName === 'image') {
      const imgHtml = this.buildImageHtml(component);
      if (imgHtml) {
        htmlParts.push(imgHtml);
      }
    }

    // Process children
    if (component.componentChildren && Array.isArray(component.componentChildren)) {
      for (const childId of component.componentChildren) {
        const child = this.findComponent(childId);
        if (child) {
          this.collectTextContent(child, htmlParts);
        }
      }
    }
  }

  /**
   * Build HTML for an image component
   * @param {Object} component - Image component
   * @returns {string} HTML img tag
   */
  buildImageHtml(component) {
    const props = component.properties || {};
    const extended = component.extendedProperties || {};

    let src = '';
    let alt = props.alt || '';

    // Get image source from extendedProperties
    if (extended.srcImage?.relativePath) {
      src = `resources/${extended.srcImage.relativePath}`;
    } else if (extended.srcImage?.url) {
      src = extended.srcImage.url;
    } else if (props.src) {
      src = props.src;
    }

    if (!src) return '';

    const width = extended.srcImage?.width || props.width || '';
    const height = extended.srcImage?.height || props.height || '';

    let style = '';
    if (width) style += `width: ${width}px; `;
    if (height) style += `height: ${height}px; `;

    return `<p><img src="${src}" alt="${alt}"${style ? ` style="${style}"` : ''} /></p>`;
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Find a component by ID
   * @param {string} componentId - Component ID
   * @returns {Object|null} Component or null
   */
  findComponent(componentId) {
    if (!componentId || !this.components) return null;
    return this.components[componentId] || null;
  }

  /**
   * Get localized text from ADC title object
   * @param {Object|string} textObj - Text object or string
   * @returns {string} Localized text
   */
  getLocalizedText(textObj) {
    if (!textObj) return '';
    if (typeof textObj === 'string') return this.decodeUnicode(textObj);

    // Try Spanish first (common for ADC)
    if (textObj.es) return this.decodeUnicode(textObj.es);

    // Try any available language
    const keys = Object.keys(textObj);
    if (keys.length > 0) return this.decodeUnicode(textObj[keys[0]]);

    return '';
  }

  /**
   * Decode Unicode escape sequences in a string
   * ADC uses \\u00xx format for special characters
   * @param {string} str - String with Unicode escapes
   * @returns {string} Decoded string
   */
  decodeUnicode(str) {
    if (!str || typeof str !== 'string') return str || '';

    return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  /**
   * Normalize activity type from URI to short name
   * @param {string} activityType - Full URI or short name
   * @returns {string} Short activity type
   */
  normalizeActivityType(activityType) {
    if (!activityType) return '';

    // Extract last segment from URI
    if (activityType.includes('/')) {
      const parts = activityType.split('/');
      return parts[parts.length - 1];
    }

    return activityType;
  }

  /**
   * Generate a unique ID with prefix
   * @param {string} prefix - ID prefix
   * @returns {string} Unique ID
   */
  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Truncate a title to a maximum length
   * @param {string} title - Original title
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated title
   */
  truncateTitle(title, maxLength = 100) {
    if (!title || title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
  }

  /**
   * List all asset paths found in the ZIP
   * @returns {Array<string>} Array of asset paths
   */
  listAssetPaths() {
    const assets = [];

    for (const path of Object.keys(this.zip)) {
      // Skip JSON files and directories
      if (path.endsWith('.json') || path.endsWith('/')) continue;

      // Include files in resources folder
      if (path.startsWith('resources/') || path.includes('/resources/')) {
        assets.push(path);
      }
    }

    return assets;
  }
}

// Export for both module and global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcParser;
} else {
  window.AdcParser = AdcParser;
}
