/**
 * AdcImporter
 *
 * Imports ADC (Aula Digital Canaria) content packages and populates a Yjs document.
 * Follows the same patterns as ElpxImporter for consistency.
 *
 * ADC packages are ZIP files containing:
 * - cmi5.json: Learning hierarchy (Unit -> Lessons -> Activities)
 * - components.json: Component definitions with content
 * - resources/: Media assets (images, audio, video)
 *
 * Usage:
 *   const importer = new AdcImporter(yjsDocumentManager, assetManager);
 *   await importer.import(zip, { clearExisting: true });
 */
class AdcImporter {
  // Property defaults (same as ElpxImporter)
  static BLOCK_PROPERTY_DEFAULTS = {
    visibility: 'true',
    teacherOnly: 'false',
    allowToggle: 'true',
    minimized: 'false',
    identifier: '',
    cssClass: ''
  };

  static COMPONENT_PROPERTY_DEFAULTS = {
    visibility: 'true',
    teacherOnly: 'false',
    identifier: '',
    cssClass: ''
  };

  static PAGE_PROPERTY_DEFAULTS = {
    visibility: 'true',
    highlight: 'false',
    hidePageTitle: 'false',
    editableInPage: 'false',
    titlePage: '',
    titleNode: ''
  };

  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetManager} assetManager - Asset manager for storing assets
   */
  constructor(documentManager, assetManager = null) {
    this.manager = documentManager;
    this.assetManager = assetManager;
    this.Y = window.Y;

    // Map of original asset paths to asset IDs
    this.assetMap = new Map();

    // Progress callback
    this.onProgress = null;
  }

  /**
   * Report progress to callback
   * @param {string} phase - Current phase
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} message - Message to display
   */
  _reportProgress(phase, percent, message) {
    if (typeof this.onProgress === 'function') {
      this.onProgress({ phase, percent, message });
    }
  }

  /**
   * Import an ADC package
   * @param {Object} zip - Extracted ZIP object from fflate (filename -> Uint8Array)
   * @param {Object} options - Import options
   * @param {boolean} options.clearExisting - Clear existing content before import
   * @param {string|null} options.parentId - Parent page ID (for importing into existing project)
   * @returns {Promise<Object>} Import statistics
   */
  async import(zip, options = {}) {
    const { clearExisting = true, parentId = null } = options;

    Logger.log('[AdcImporter] Starting ADC import...');

    const stats = {
      pages: 0,
      blocks: 0,
      components: 0,
      assets: 0,
      errors: []
    };

    try {
      // Phase 1: Validate ADC structure (0-5%)
      this._reportProgress('validate', 0, typeof _ === 'function' ? _('Validating ADC format...') : 'Validating ADC format...');

      const validation = this.validateAdcStructure(zip);
      if (!validation.valid) {
        throw new Error(`Invalid ADC format: ${validation.error}`);
      }

      this._reportProgress('validate', 5, typeof _ === 'function' ? _('ADC format validated') : 'ADC format validated');

      // Phase 2: Extract assets (5-30%)
      this._reportProgress('assets', 10, typeof _ === 'function' ? _('Extracting assets...') : 'Extracting assets...');

      try {
        stats.assets = await this.importAssets(zip);
        Logger.log(`[AdcImporter] Imported ${stats.assets} assets`);
      } catch (assetErr) {
        Logger.warn('[AdcImporter] Asset extraction error:', assetErr);
        stats.errors.push({ phase: 'assets', error: assetErr.message });
        // Continue - assets are non-fatal
      }

      this._reportProgress('assets', 30, typeof _ === 'function' ? _('Assets extracted') : 'Assets extracted');

      // Phase 3: Parse structure (30-50%)
      this._reportProgress('parse', 35, typeof _ === 'function' ? _('Parsing ADC structure...') : 'Parsing ADC structure...');

      const parser = new AdcParser(zip);
      const parsed = parser.parse();

      Logger.log(`[AdcImporter] Parsed ${parsed.pages.length} pages`);

      this._reportProgress('parse', 50, typeof _ === 'function' ? _('Structure parsed') : 'Structure parsed');

      // Phase 4: Convert asset paths (50-60%)
      this._reportProgress('convert', 55, typeof _ === 'function' ? _('Converting content...') : 'Converting content...');

      for (const page of parsed.pages) {
        for (const block of page.blocks) {
          for (const comp of block.components) {
            try {
              comp.htmlView = this.convertResourcePaths(comp.htmlView);
            } catch (convErr) {
              Logger.warn(`[AdcImporter] Path conversion error:`, convErr);
              stats.errors.push({ phase: 'convert', error: convErr.message });
            }
          }
        }
      }

      this._reportProgress('convert', 60, typeof _ === 'function' ? _('Content converted') : 'Content converted');

      // Phase 5: Import to Yjs (60-90%)
      this._reportProgress('import', 65, typeof _ === 'function' ? _('Importing to document...') : 'Importing to document...');

      const importStats = await this.importToYjs(parsed, { clearExisting, parentId });
      stats.pages = importStats.pages;
      stats.blocks = importStats.blocks;
      stats.components = importStats.components;

      this._reportProgress('import', 90, typeof _ === 'function' ? _('Import complete') : 'Import complete');

      // Phase 6: Precache assets (90-100%)
      if (this.assetManager && this.assetMap.size > 0) {
        this._reportProgress('precache', 95, typeof _ === 'function' ? _('Precaching assets...') : 'Precaching assets...');
        await this.precacheAssets();
      }

      this._reportProgress('complete', 100, typeof _ === 'function' ? _('ADC import complete') : 'ADC import complete');

      Logger.log(`[AdcImporter] Import complete: ${stats.pages} pages, ${stats.blocks} blocks, ${stats.components} components, ${stats.assets} assets`);

      return stats;

    } catch (err) {
      Logger.error('[AdcImporter] Import failed:', err);
      throw err;
    }
  }

  /**
   * Validate ADC structure
   * @param {Object} zip - Extracted ZIP
   * @returns {Object} { valid: boolean, error?: string }
   */
  validateAdcStructure(zip) {
    // Check required files
    if (!zip['cmi5.json']) {
      return { valid: false, error: 'Missing cmi5.json' };
    }
    if (!zip['components.json']) {
      return { valid: false, error: 'Missing components.json' };
    }

    // Validate JSON structure
    try {
      const cmi5Text = new TextDecoder().decode(zip['cmi5.json']);
      const cmi5 = JSON.parse(cmi5Text);

      if (!cmi5.unitMetadata) {
        return { valid: false, error: 'Invalid cmi5.json: missing unitMetadata' };
      }
    } catch (e) {
      return { valid: false, error: `Invalid cmi5.json: ${e.message}` };
    }

    try {
      const compText = new TextDecoder().decode(zip['components.json']);
      JSON.parse(compText);
    } catch (e) {
      return { valid: false, error: `Invalid components.json: ${e.message}` };
    }

    return { valid: true };
  }

  /**
   * Import assets from ZIP to AssetManager
   * @param {Object} zip - Extracted ZIP
   * @returns {Promise<number>} Number of assets imported
   */
  async importAssets(zip) {
    if (!this.assetManager) {
      Logger.log('[AdcImporter] No AssetManager, skipping asset import');
      return 0;
    }

    let count = 0;

    // Find all files in resources/ folder
    const assetPaths = Object.keys(zip).filter(path =>
      path.startsWith('resources/') && !path.endsWith('/')
    );

    for (const path of assetPaths) {
      try {
        const data = zip[path];
        if (!data || data.length === 0) continue;

        const filename = path.split('/').pop();
        const mime = this.getMimeType(filename);
        const blob = new Blob([data], { type: mime });

        // Calculate content-addressable hash
        const hash = await this.assetManager.calculateHash(blob);
        const assetId = this.assetManager.hashToUUID(hash);

        // Store in IndexedDB
        const asset = {
          id: assetId,
          projectId: this.assetManager.projectId,
          blob: blob,
          mime: mime,
          hash: hash,
          size: blob.size,
          uploaded: false,
          createdAt: new Date().toISOString(),
          filename: filename
        };

        await this.assetManager.putAsset(asset);

        // Map paths to asset ID
        this.assetMap.set(path, assetId);
        this.assetMap.set(`resources/${filename}`, assetId);
        this.assetMap.set(filename, assetId);

        count++;
      } catch (err) {
        Logger.warn(`[AdcImporter] Failed to import asset ${path}:`, err);
      }
    }

    return count;
  }

  /**
   * Convert resource paths in HTML to asset:// URLs
   * @param {string} html - HTML content
   * @returns {string} HTML with converted paths
   */
  convertResourcePaths(html) {
    if (!html || this.assetMap.size === 0) return html;

    let result = html;

    // Replace various path formats
    for (const [originalPath, assetId] of this.assetMap.entries()) {
      const filename = originalPath.split('/').pop();

      // Different path patterns ADC uses
      const patterns = [
        `resources/${filename}`,
        `./resources/${filename}`,
        `../resources/${filename}`,
        `"resources/${filename}"`,
        `'resources/${filename}'`
      ];

      for (const pattern of patterns) {
        const replacement = pattern.startsWith('"') || pattern.startsWith("'")
          ? `${pattern[0]}asset://${assetId}/${filename}${pattern[0]}`
          : `asset://${assetId}/${filename}`;

        result = result.split(pattern).join(replacement);
      }
    }

    return result;
  }

  /**
   * Import parsed structure to Yjs document
   * @param {Object} parsed - Parsed ADC structure { meta, pages }
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import statistics
   */
  async importToYjs(parsed, options = {}) {
    const { clearExisting = true, parentId = null } = options;

    const ydoc = this.manager.getDoc();
    const navigation = this.manager.getNavigation();
    const metadata = this.manager.getMetadata();

    const stats = { pages: 0, blocks: 0, components: 0 };

    // Wrap in transaction
    ydoc.transact(() => {
      // Clear existing if requested
      if (clearExisting) {
        while (navigation.length > 0) {
          navigation.delete(0);
        }
      }

      // Update metadata
      if (parsed.meta) {
        if (parsed.meta.title) metadata.set('title', parsed.meta.title);
        if (parsed.meta.description) metadata.set('description', parsed.meta.description);
        if (parsed.meta.language) metadata.set('language', parsed.meta.language);
        if (parsed.meta.author) metadata.set('author', parsed.meta.author);
      }

      // Import pages
      for (const pageData of parsed.pages) {
        const pageMap = this.createPageYMap(pageData, parentId);
        navigation.push([pageMap]);
        stats.pages++;
        stats.blocks += pageData.blocks.length;

        for (const block of pageData.blocks) {
          stats.components += block.components.length;
        }
      }
    });

    return stats;
  }

  /**
   * Create a Y.Map for a page
   * @param {Object} pageData - Page data object
   * @param {string|null} parentId - Parent page ID
   * @returns {Y.Map} Yjs Map
   */
  createPageYMap(pageData, parentId = null) {
    const Y = this.Y;
    const pageMap = new Y.Map();

    pageMap.set('id', pageData.id);
    pageMap.set('pageId', pageData.id);
    pageMap.set('pageName', pageData.pageName || '');
    pageMap.set('title', pageData.title || '');
    pageMap.set('parentId', parentId || pageData.parentId || null);
    pageMap.set('order', pageData.order || 0);
    pageMap.set('createdAt', pageData.createdAt || new Date().toISOString());

    // Properties
    const propsMap = new Y.Map();
    const props = { ...AdcImporter.PAGE_PROPERTY_DEFAULTS, ...pageData.properties };
    for (const [key, value] of Object.entries(props)) {
      propsMap.set(key, value);
    }
    pageMap.set('properties', propsMap);

    // Blocks
    const blocksArray = new Y.Array();
    for (const blockData of pageData.blocks) {
      const blockMap = this.createBlockYMap(blockData);
      blocksArray.push([blockMap]);
    }
    pageMap.set('blocks', blocksArray);

    return pageMap;
  }

  /**
   * Create a Y.Map for a block
   * @param {Object} blockData - Block data object
   * @returns {Y.Map} Yjs Map
   */
  createBlockYMap(blockData) {
    const Y = this.Y;
    const blockMap = new Y.Map();

    blockMap.set('id', blockData.id);
    blockMap.set('blockId', blockData.blockId || blockData.id);
    blockMap.set('blockName', blockData.blockName || '');
    blockMap.set('iconName', blockData.iconName || 'text');
    blockMap.set('order', blockData.order || 0);
    blockMap.set('createdAt', blockData.createdAt || new Date().toISOString());

    // Properties
    const propsMap = new Y.Map();
    const props = { ...AdcImporter.BLOCK_PROPERTY_DEFAULTS, ...blockData.properties };
    for (const [key, value] of Object.entries(props)) {
      propsMap.set(key, value);
    }
    blockMap.set('properties', propsMap);

    // Components (iDevices)
    const componentsArray = new Y.Array();
    for (const compData of blockData.components) {
      const compMap = this.createComponentYMap(compData);
      componentsArray.push([compMap]);
    }
    blockMap.set('components', componentsArray);

    return blockMap;
  }

  /**
   * Create a Y.Map for a component (iDevice)
   * @param {Object} compData - Component data object
   * @returns {Y.Map} Yjs Map
   */
  createComponentYMap(compData) {
    const Y = this.Y;
    const compMap = new Y.Map();

    compMap.set('id', compData.id);
    compMap.set('ideviceId', compData.ideviceId || compData.id);
    compMap.set('ideviceType', compData.ideviceType || 'text');
    compMap.set('type', compData.type || 'base');
    compMap.set('order', compData.order || 0);
    compMap.set('createdAt', compData.createdAt || new Date().toISOString());
    compMap.set('htmlView', compData.htmlView || '');
    compMap.set('jsonProperties', compData.jsonProperties || {});

    // Properties
    const propsMap = new Y.Map();
    const props = { ...AdcImporter.COMPONENT_PROPERTY_DEFAULTS, ...compData.properties };
    for (const [key, value] of Object.entries(props)) {
      propsMap.set(key, value);
    }
    compMap.set('properties', propsMap);

    return compMap;
  }

  /**
   * Precache assets for immediate rendering
   */
  async precacheAssets() {
    if (!this.assetManager) return;

    const assetIds = Array.from(this.assetMap.values());
    const uniqueIds = [...new Set(assetIds)];

    Logger.log(`[AdcImporter] Precaching ${uniqueIds.length} unique assets`);

    for (const assetId of uniqueIds.slice(0, 20)) { // Limit to first 20
      try {
        await this.assetManager.getAssetUrl(assetId);
      } catch (err) {
        // Ignore precache errors
      }
    }
  }

  /**
   * Get MIME type from filename
   * @param {string} filename - Filename
   * @returns {string} MIME type
   */
  getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'pdf': 'application/pdf',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// Export for both module and global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcImporter;
} else {
  window.AdcImporter = AdcImporter;
}
