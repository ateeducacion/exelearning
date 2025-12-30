/**
 * AdcEssayHandler
 *
 * Handler for ADC essay and no-interactive activity types.
 * Converts to eXeLearning 'text' iDevice.
 *
 * Handles:
 * - essay: Open-ended text response activities
 * - no-interactive: Static content display
 */
class AdcEssayHandler extends BaseAdcHandler {
  /**
   * Activity types this handler can process
   */
  static SUPPORTED_TYPES = ['essay', 'no-interactive'];

  /**
   * Check if this handler can process the given activity type
   * @param {string} activityType - Activity type (short name)
   * @returns {boolean}
   */
  canHandle(activityType) {
    const normalized = activityType.toLowerCase();
    return AdcEssayHandler.SUPPORTED_TYPES.includes(normalized);
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
    return AdcEssayHandler.SUPPORTED_TYPES;
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

    // Add activity title as heading if present and meaningful
    const title = this.getLocalizedText(activity?.title);
    if (title && !this.isTechnicalTitle(title)) {
      // The title often contains the full content for essay activities
      // Only add as heading if it's short enough
      if (title.length < 100) {
        htmlParts.push(`<h3>${this.escapeHtml(title)}</h3>`);
      } else {
        // Long titles are likely the content itself
        htmlParts.push(`<p>${this.escapeHtml(title)}</p>`);
      }
    }

    // Extract content from component tree
    if (component) {
      const componentHtml = this.extractComponentContent(component, allComponents);
      if (componentHtml) {
        htmlParts.push(componentHtml);
      }
    }

    // If no content was found, use the activity title as content
    if (htmlParts.length === 0 && title) {
      htmlParts.push(`<p>${this.escapeHtml(title)}</p>`);
    }

    return htmlParts.join('\n');
  }

  /**
   * Extract iDevice properties
   * @param {Object} component - Component from components.json
   * @param {Object} activity - Activity from cmi5.json
   * @param {Object} allComponents - All components map
   * @returns {Object} Properties object
   */
  extractProperties(component, activity, allComponents) {
    // Text iDevice doesn't need special properties
    return {};
  }

  /**
   * Extract content from a component and its children
   * @param {Object} component - Component object
   * @param {Object} allComponents - All components map
   * @returns {string} HTML content
   */
  extractComponentContent(component, allComponents) {
    if (!component) return '';

    const parts = [];

    // Handle different component types
    switch (component.componentName) {
      case 'text':
        if (component.properties?.textContent) {
          parts.push(component.properties.textContent);
        }
        break;

      case 'image':
        const imgHtml = this.buildImageHtml(component);
        if (imgHtml) parts.push(imgHtml);
        break;

      case 'pageContent':
      case 'blocks':
      case 'column':
      case 'row':
      case 'panel':
      case 'accordionItem':
      case 'tabsItem':
        // Container types - process children
        break;

      case 'teacherContent':
        // Teacher-only content - extract but mark as teacher content
        const teacherContent = this.extractChildrenContent(component, allComponents);
        if (teacherContent) {
          parts.push(`<div class="exe-teacher-content">${teacherContent}</div>`);
        }
        return parts.join('\n'); // Don't process children again

      default:
        // Try to extract text content from properties
        if (component.properties?.textContent) {
          parts.push(component.properties.textContent);
        }
        break;
    }

    // Process children
    const childrenContent = this.extractChildrenContent(component, allComponents);
    if (childrenContent) {
      parts.push(childrenContent);
    }

    return parts.join('\n');
  }

  /**
   * Extract content from component children
   * @param {Object} component - Parent component
   * @param {Object} allComponents - All components map
   * @returns {string} HTML content
   */
  extractChildrenContent(component, allComponents) {
    if (!component?.componentChildren || !Array.isArray(component.componentChildren)) {
      return '';
    }

    const parts = [];

    for (const childId of component.componentChildren) {
      const child = allComponents[childId];
      if (child) {
        const childContent = this.extractComponentContent(child, allComponents);
        if (childContent) {
          parts.push(childContent);
        }
      }
    }

    return parts.join('\n');
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
    const alt = props.alt || '';

    // Get source from extendedProperties
    if (extended.srcImage?.url) {
      src = extended.srcImage.url;
    } else if (extended.srcImage?.relativePath) {
      src = `resources/${extended.srcImage.relativePath}`;
    } else if (props.src) {
      src = props.src;
    }

    if (!src) return '';

    return `<p><img src="${src}" alt="${this.escapeHtml(alt)}" /></p>`;
  }

  /**
   * Check if a title is a technical/internal name
   * @param {string} title - Title to check
   * @returns {boolean}
   */
  isTechnicalTitle(title) {
    if (!title) return true;

    const technicalPatterns = [
      /^text$/i,
      /^image$/i,
      /^activity\d*$/i,
      /^component/i,
      /^block/i,
      /^[a-f0-9]{32}$/i,  // UUID-like
      /^allType/i,         // ADC internal naming
      /^q[A-Z]/           // Quiz component naming
    ];

    return technicalPatterns.some(pattern => pattern.test(title));
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
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
  module.exports = AdcEssayHandler;
} else {
  window.AdcEssayHandler = AdcEssayHandler;
}
