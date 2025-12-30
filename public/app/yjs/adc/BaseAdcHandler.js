/**
 * BaseAdcHandler
 *
 * Base class for ADC (Aula Digital Canaria) activity handlers.
 * Provides shared utilities for parsing ADC JSON structures and converting
 * them to eXeLearning iDevice format.
 *
 * Each handler subclass implements:
 * - canHandle(activityType): Check if this handler supports the activity type
 * - getTargetType(): Return the modern iDevice type name
 * - extractHtmlView(component, activity, allComponents): Extract HTML content
 * - extractProperties(component, activity, allComponents): Extract iDevice properties
 */
class BaseAdcHandler {
  /**
   * Check if this handler can process the given activity type
   * @param {string} activityType - ADC activity type URI or short name
   * @returns {boolean}
   */
  canHandle(activityType) {
    throw new Error('BaseAdcHandler.canHandle() must be implemented by subclass');
  }

  /**
   * Get the target modern iDevice type
   * @returns {string} Modern iDevice type (e.g., 'text', 'trueorfalse', 'form')
   */
  getTargetType() {
    throw new Error('BaseAdcHandler.getTargetType() must be implemented by subclass');
  }

  /**
   * Extract HTML content from the component
   * @param {Object} component - Component from components.json
   * @param {Object} activity - Activity from cmi5.json
   * @param {Object} allComponents - All components map for looking up children
   * @returns {string} HTML content for the iDevice
   */
  extractHtmlView(component, activity, allComponents) {
    return '';
  }

  /**
   * Extract iDevice-specific properties from the component
   * @param {Object} component - Component from components.json
   * @param {Object} activity - Activity from cmi5.json
   * @param {Object} allComponents - All components map for looking up children
   * @returns {Object} Properties object (e.g., { questionsData: [...] })
   */
  extractProperties(component, activity, allComponents) {
    return {};
  }

  // ========================================
  // Shared Utilities
  // ========================================

  /**
   * Get localized text from an ADC title/description object
   * ADC uses { "es": "text", "en": "text" } format
   * @param {Object|string} textObj - Text object or plain string
   * @param {string} defaultLang - Default language code (default: 'es')
   * @returns {string} Localized text
   */
  getLocalizedText(textObj, defaultLang = 'es') {
    if (!textObj) return '';
    if (typeof textObj === 'string') return textObj;

    // Try requested language first
    if (textObj[defaultLang]) return textObj[defaultLang];

    // Fall back to Spanish (common in ADC)
    if (textObj.es) return textObj.es;

    // Fall back to any available language
    const keys = Object.keys(textObj);
    if (keys.length > 0) return textObj[keys[0]];

    return '';
  }

  /**
   * Find a component by ID in the components map
   * @param {string} componentId - Component ID to find
   * @param {Object} allComponents - All components map
   * @returns {Object|null} Component or null
   */
  findComponent(componentId, allComponents) {
    if (!componentId || !allComponents) return null;
    return allComponents[componentId] || null;
  }

  /**
   * Find all child components of a parent component
   * @param {string} parentId - Parent component ID
   * @param {Object} allComponents - All components map
   * @returns {Array<Object>} Array of child components
   */
  findChildComponents(parentId, allComponents) {
    if (!parentId || !allComponents) return [];

    const parent = this.findComponent(parentId, allComponents);
    if (!parent || !parent.componentChildren) return [];

    return parent.componentChildren
      .map(childId => this.findComponent(childId, allComponents))
      .filter(Boolean);
  }

  /**
   * Recursively find all components of a specific type within a parent
   * @param {string} parentId - Starting parent component ID
   * @param {string} componentName - Component type to find (e.g., 'text', 'image')
   * @param {Object} allComponents - All components map
   * @returns {Array<Object>} Array of matching components
   */
  findComponentsByType(parentId, componentName, allComponents) {
    const results = [];
    const queue = [parentId];
    const visited = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const component = this.findComponent(currentId, allComponents);
      if (!component) continue;

      if (component.componentName === componentName) {
        results.push(component);
      }

      if (component.componentChildren) {
        queue.push(...component.componentChildren);
      }
    }

    return results;
  }

  /**
   * Extract text content from a component
   * ADC stores text in properties.textContent as HTML
   * @param {Object} component - Component object
   * @returns {string} HTML text content
   */
  extractTextContent(component) {
    if (!component) return '';

    // Try properties.textContent first (most common)
    if (component.properties?.textContent) {
      return this.decodeHtmlContent(component.properties.textContent);
    }

    // Try properties.text
    if (component.properties?.text) {
      return this.decodeHtmlContent(component.properties.text);
    }

    // Try properties.content
    if (component.properties?.content) {
      return this.decodeHtmlContent(component.properties.content);
    }

    return '';
  }

  /**
   * Extract image source from a component
   * @param {Object} component - Component object
   * @returns {Object|null} Image info { src, alt, width, height } or null
   */
  extractImageInfo(component) {
    if (!component) return null;

    // Check extendedProperties for image reference
    if (component.extendedProperties?.srcImage) {
      const srcImage = component.extendedProperties.srcImage;
      return {
        src: srcImage.relativePath || srcImage.path || '',
        alt: srcImage.alt || component.properties?.alt || '',
        width: srcImage.width || component.properties?.width,
        height: srcImage.height || component.properties?.height
      };
    }

    // Check properties directly
    if (component.properties?.src) {
      return {
        src: component.properties.src,
        alt: component.properties.alt || '',
        width: component.properties.width,
        height: component.properties.height
      };
    }

    return null;
  }

  /**
   * Extract video/audio source from a component
   * @param {Object} component - Component object
   * @returns {Object|null} Media info { src, type, poster } or null
   */
  extractMediaInfo(component) {
    if (!component) return null;

    const props = component.properties || {};

    // Check for URL (external video/audio)
    if (props.url) {
      return {
        src: props.url,
        type: this.detectMediaType(props.url),
        poster: props.poster || props.thumbnailUrl || ''
      };
    }

    // Check extendedProperties for local media
    if (component.extendedProperties?.srcMedia) {
      const srcMedia = component.extendedProperties.srcMedia;
      return {
        src: srcMedia.relativePath || srcMedia.path || '',
        type: srcMedia.mimeType || this.detectMediaType(srcMedia.relativePath),
        poster: ''
      };
    }

    return null;
  }

  /**
   * Detect media type from URL or path
   * @param {string} url - Media URL or path
   * @returns {string} Media type ('video', 'audio', 'unknown')
   */
  detectMediaType(url) {
    if (!url) return 'unknown';
    const lower = url.toLowerCase();

    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('vimeo.com')) return 'vimeo';
    if (lower.match(/\.(mp4|webm|ogg|mov)(\?|$)/)) return 'video';
    if (lower.match(/\.(mp3|wav|ogg|m4a)(\?|$)/)) return 'audio';

    return 'unknown';
  }

  /**
   * Decode HTML entities and clean up content
   * @param {string} str - String with potential HTML entities
   * @returns {string} Decoded string
   */
  decodeHtmlContent(str) {
    if (!str) return '';
    if (typeof str !== 'string') return String(str);

    // Create a temporary element to decode HTML entities
    // This is a common pattern but we need to handle it server-side too
    // For now, handle common entities manually
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Strip HTML tags from content
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  stripHtmlTags(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Normalize activity type from full URI to short name
   * ADC uses URIs like "https://w3id.org/xapi/smart/activity/essay"
   * @param {string} activityType - Full activity type URI or short name
   * @returns {string} Short activity type name
   */
  normalizeActivityType(activityType) {
    if (!activityType) return '';

    // If it's a URI, extract the last segment
    if (activityType.includes('/')) {
      const parts = activityType.split('/');
      return parts[parts.length - 1];
    }

    return activityType;
  }

  /**
   * Generate HTML for an embedded video
   * @param {Object} mediaInfo - Media info from extractMediaInfo
   * @returns {string} HTML embed code
   */
  generateVideoEmbed(mediaInfo) {
    if (!mediaInfo?.src) return '';

    const { src, type, poster } = mediaInfo;

    // YouTube embed
    if (type === 'youtube') {
      const videoId = this.extractYouTubeId(src);
      if (videoId) {
        return `<div class="exe-video-container"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
      }
    }

    // Vimeo embed
    if (type === 'vimeo') {
      const videoId = this.extractVimeoId(src);
      if (videoId) {
        return `<div class="exe-video-container"><iframe src="https://player.vimeo.com/video/${videoId}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
      }
    }

    // HTML5 video
    const posterAttr = poster ? ` poster="${poster}"` : '';
    return `<div class="exe-video-container"><video controls width="100%"${posterAttr}><source src="${src}" type="video/mp4">Your browser does not support the video tag.</video></div>`;
  }

  /**
   * Generate HTML for an embedded audio
   * @param {Object} mediaInfo - Media info from extractMediaInfo
   * @returns {string} HTML embed code
   */
  generateAudioEmbed(mediaInfo) {
    if (!mediaInfo?.src) return '';

    return `<div class="exe-audio-container"><audio controls><source src="${mediaInfo.src}" type="audio/mpeg">Your browser does not support the audio tag.</audio></div>`;
  }

  /**
   * Extract YouTube video ID from URL
   * @param {string} url - YouTube URL
   * @returns {string|null} Video ID or null
   */
  extractYouTubeId(url) {
    if (!url) return null;

    // Match various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
      /youtube\.com\/v\/([^&\?\/]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Extract Vimeo video ID from URL
   * @param {string} url - Vimeo URL
   * @returns {string|null} Video ID or null
   */
  extractVimeoId(url) {
    if (!url) return null;

    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Generate a unique ID with prefix
   * @param {string} prefix - ID prefix (e.g., 'page', 'block', 'idevice')
   * @returns {string} Unique ID
   */
  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  }
}

// Export for both module and global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseAdcHandler;
} else {
  window.BaseAdcHandler = BaseAdcHandler;
}
