/**
 * AdcDefaultHandler
 *
 * Default fallback handler for unknown ADC activity types.
 * Converts to eXeLearning 'text' iDevice with best-effort content extraction.
 *
 * This handler should always be last in the registry and catches
 * any activity types not handled by more specific handlers.
 */
class AdcDefaultHandler extends BaseAdcHandler {
  /**
   * This handler accepts any activity type as fallback
   * @param {string} activityType - Activity type
   * @returns {boolean} Always true
   */
  canHandle(activityType) {
    return true;
  }

  /**
   * Get the target eXeLearning iDevice type
   * @returns {string}
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Get list of supported activity types
   * @returns {Array<string>}
   */
  getSupportedTypes() {
    return ['*']; // Wildcard - handles all types
  }

  /**
   * Extract HTML content from component
   * @param {Object} component - Component from components.json
   * @param {Object} activity - Activity from cmi5.json
   * @param {Object} allComponents - All components map
   * @returns {string} HTML content
   */
  extractHtmlView(component, activity, allComponents) {
    const htmlParts = [];

    // Add activity title
    const title = this.getLocalizedText(activity?.title);
    if (title) {
      // For unknown types, include full title as content
      htmlParts.push(`<p>${this.escapeHtml(title)}</p>`);
    }

    // Add activity type info as comment (helps debugging)
    const activityType = activity?.activityType;
    if (activityType) {
      const shortType = this.normalizeActivityType(activityType);
      Logger.log(`[AdcDefaultHandler] Processing unknown activity type: ${shortType}`);
    }

    // Extract all text content from component tree
    if (component) {
      const componentHtml = this.extractAllTextContent(component, allComponents, new Set());
      if (componentHtml) {
        htmlParts.push(componentHtml);
      }
    }

    // If still no content, add a placeholder
    if (htmlParts.length === 0) {
      htmlParts.push('<p><em>(Content imported from ADC)</em></p>');
    }

    return htmlParts.join('\n');
  }

  /**
   * Extract properties (empty for default handler)
   * @param {Object} component - Component from components.json
   * @param {Object} activity - Activity from cmi5.json
   * @param {Object} allComponents - All components map
   * @returns {Object}
   */
  extractProperties(component, activity, allComponents) {
    return {};
  }

  /**
   * Recursively extract all text content from a component tree
   * @param {Object} component - Component object
   * @param {Object} allComponents - All components map
   * @param {Set} visited - Set of visited component IDs to prevent cycles
   * @returns {string} HTML content
   */
  extractAllTextContent(component, allComponents, visited) {
    if (!component || !component.id) return '';

    // Prevent infinite loops
    if (visited.has(component.id)) return '';
    visited.add(component.id);

    const parts = [];

    // Extract text from properties
    const props = component.properties || {};

    if (props.textContent) {
      parts.push(props.textContent);
    }
    if (props.text) {
      parts.push(`<p>${props.text}</p>`);
    }
    if (props.content) {
      parts.push(props.content);
    }
    if (props.titleHtml) {
      parts.push(props.titleHtml);
    }
    if (props.title && !props.textContent) {
      // Only add title if no textContent (to avoid duplication)
      if (typeof props.title === 'string' && props.title.length < 200) {
        parts.push(`<h4>${this.escapeHtml(props.title)}</h4>`);
      }
    }

    // Handle quiz elements
    if (props.quizElement) {
      parts.push(`<p>${props.quizElement}</p>`);
    }

    // Handle image components
    if (component.componentName === 'image') {
      const imgHtml = this.buildImageHtml(component);
      if (imgHtml) parts.push(imgHtml);
    }

    // Handle video/audio components
    if (component.componentName === 'allTypeVideo' || component.componentName === 'video') {
      const videoHtml = this.buildVideoHtml(component);
      if (videoHtml) parts.push(videoHtml);
    }

    if (component.componentName === 'audio') {
      const audioHtml = this.buildAudioHtml(component);
      if (audioHtml) parts.push(audioHtml);
    }

    // Process children
    if (component.componentChildren && Array.isArray(component.componentChildren)) {
      for (const childId of component.componentChildren) {
        const child = allComponents[childId];
        if (child) {
          const childContent = this.extractAllTextContent(child, allComponents, visited);
          if (childContent) {
            parts.push(childContent);
          }
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * Build HTML for an image
   * @param {Object} component - Image component
   * @returns {string} HTML
   */
  buildImageHtml(component) {
    const extended = component.extendedProperties || {};
    const props = component.properties || {};

    let src = '';
    if (extended.srcImage?.url) {
      src = extended.srcImage.url;
    } else if (extended.srcImage?.relativePath) {
      src = `resources/${extended.srcImage.relativePath}`;
    } else if (props.src) {
      src = props.src;
    }

    if (!src) return '';

    const alt = props.alt || '';
    return `<p><img src="${src}" alt="${this.escapeHtml(alt)}" /></p>`;
  }

  /**
   * Build HTML for a video
   * @param {Object} component - Video component
   * @returns {string} HTML
   */
  buildVideoHtml(component) {
    const props = component.properties || {};

    if (props.url) {
      // Check for YouTube/Vimeo
      if (props.url.includes('youtube.com') || props.url.includes('youtu.be')) {
        const videoId = this.extractYouTubeId(props.url);
        if (videoId) {
          return `<div class="exe-video-container"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
        }
      }
      if (props.url.includes('vimeo.com')) {
        const videoId = this.extractVimeoId(props.url);
        if (videoId) {
          return `<div class="exe-video-container"><iframe src="https://player.vimeo.com/video/${videoId}" width="560" height="315" frameborder="0" allowfullscreen></iframe></div>`;
        }
      }
      // Generic video
      return `<p><a href="${this.escapeHtml(props.url)}" target="_blank">Video: ${this.escapeHtml(props.url)}</a></p>`;
    }

    return '';
  }

  /**
   * Build HTML for audio
   * @param {Object} component - Audio component
   * @returns {string} HTML
   */
  buildAudioHtml(component) {
    const props = component.properties || {};
    const extended = component.extendedProperties || {};

    let src = '';
    if (extended.srcAudio?.url) {
      src = extended.srcAudio.url;
    } else if (extended.srcAudio?.relativePath) {
      src = `resources/${extended.srcAudio.relativePath}`;
    } else if (props.src) {
      src = props.src;
    }

    if (!src) return '';

    return `<p><audio controls src="${src}">Your browser does not support audio.</audio></p>`;
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Export for both module and global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcDefaultHandler;
} else {
  window.AdcDefaultHandler = AdcDefaultHandler;
}
