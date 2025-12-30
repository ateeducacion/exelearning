/**
 * AdcDisplayOnlyHandler
 *
 * Handler for ADC activity types that can't be fully reproduced in eXeLearning.
 * Converts to 'text' iDevice with informational content.
 *
 * Handles:
 * - audio-recording: Recording activities (display only, no recording capability)
 * - draw: Drawing activities (display only, no drawing capability)
 */
class AdcDisplayOnlyHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['audio-recording', 'draw'];

  canHandle(activityType) {
    return AdcDisplayOnlyHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'text';
  }

  getSupportedTypes() {
    return AdcDisplayOnlyHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const parts = [];
    const activityType = this.normalizeActivityType(activity?.activityType);

    // Add activity title
    const title = this.getLocalizedText(activity?.title);
    if (title) {
      parts.push(`<p>${title}</p>`);
    }

    // Add notice about unsupported interactive feature
    const notice = this.getUnsupportedNotice(activityType);
    if (notice) {
      parts.push(notice);
    }

    // Extract any text content
    const textComponents = this.findComponentsByType(
      component?.id,
      'text',
      allComponents
    );

    for (const textComp of textComponents) {
      if (textComp.properties?.textContent) {
        parts.push(textComp.properties.textContent);
      }
    }

    // Extract images
    const imageComponents = this.findComponentsByType(
      component?.id,
      'image',
      allComponents
    );

    for (const imgComp of imageComponents) {
      const imgHtml = this.buildImageHtml(imgComp);
      if (imgHtml) {
        parts.push(imgHtml);
      }
    }

    return parts.join('\n');
  }

  extractProperties(component, activity, allComponents) {
    return {};
  }

  /**
   * Get an informational notice about unsupported interactive features
   * @param {string} activityType - Activity type
   * @returns {string} HTML notice
   */
  getUnsupportedNotice(activityType) {
    const notices = {
      'audio-recording': `<div class="exe-info-box" style="background:#fff3cd;border:1px solid #ffc107;padding:10px;border-radius:4px;margin:10px 0;">
<p><strong>Nota:</strong> Esta actividad originalmente requería grabación de audio. En eXeLearning, esta funcionalidad interactiva no está disponible. El contenido se muestra de forma informativa.</p>
</div>`,
      'draw': `<div class="exe-info-box" style="background:#fff3cd;border:1px solid #ffc107;padding:10px;border-radius:4px;margin:10px 0;">
<p><strong>Nota:</strong> Esta actividad originalmente requería dibujo interactivo. En eXeLearning, esta funcionalidad no está disponible. El contenido se muestra de forma informativa.</p>
</div>`
    };

    return notices[activityType] || '';
  }

  buildImageHtml(component) {
    const extended = component?.extendedProperties || {};
    const props = component?.properties || {};

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
    return `<p><img src="${src}" alt="${alt}" /></p>`;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcDisplayOnlyHandler;
} else {
  window.AdcDisplayOnlyHandler = AdcDisplayOnlyHandler;
}
