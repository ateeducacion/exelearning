/**
 * AdcAudioHandler
 *
 * Handler for ADC audio activity types.
 * Converts to eXeLearning 'text' iDevice with embedded audio.
 */
class AdcAudioHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['audio'];

  canHandle(activityType) {
    return AdcAudioHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'text';
  }

  getSupportedTypes() {
    return AdcAudioHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const parts = [];

    // Find audio components
    const audioComponents = this.findComponentsByType(
      component?.id,
      'audio',
      allComponents
    );

    if (audioComponents.length > 0) {
      for (const audioComp of audioComponents) {
        const audioHtml = this.buildAudioEmbed(audioComp);
        if (audioHtml) {
          parts.push(audioHtml);
        }
      }
    }

    // Extract text content
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

    return parts.join('\n');
  }

  extractProperties(component, activity, allComponents) {
    return {};
  }

  buildAudioEmbed(component) {
    const props = component?.properties || {};
    const extended = component?.extendedProperties || {};

    let src = '';

    if (extended.srcAudio?.url) {
      src = extended.srcAudio.url;
    } else if (extended.srcAudio?.relativePath) {
      src = `resources/${extended.srcAudio.relativePath}`;
    } else if (props.src || props.url) {
      src = props.src || props.url;
    }

    if (!src) return '';

    return `<div class="exe-audio-container">
<audio controls style="width:100%;">
<source src="${src}" type="audio/mpeg">
Your browser does not support the audio element.
</audio>
</div>`;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcAudioHandler;
} else {
  window.AdcAudioHandler = AdcAudioHandler;
}
