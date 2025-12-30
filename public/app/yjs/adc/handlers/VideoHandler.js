/**
 * AdcVideoHandler
 *
 * Handler for ADC video activity types.
 * Converts to eXeLearning 'text' iDevice with embedded video.
 */
class AdcVideoHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['video'];

  canHandle(activityType) {
    return AdcVideoHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'text';
  }

  getSupportedTypes() {
    return AdcVideoHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const parts = [];

    // Find video component in the tree
    const videoComponents = this.findComponentsByType(
      component?.id,
      'allTypeVideo',
      allComponents
    );

    // Also check for 'video' type
    const videoComponents2 = this.findComponentsByType(
      component?.id,
      'video',
      allComponents
    );

    const allVideos = [...videoComponents, ...videoComponents2];

    if (allVideos.length > 0) {
      for (const videoComp of allVideos) {
        const videoHtml = this.buildVideoEmbed(videoComp);
        if (videoHtml) {
          parts.push(videoHtml);
        }
      }
    }

    // Extract any text content as well
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

    // If no video found, try to extract URL from properties
    if (parts.length === 0 && component?.properties?.url) {
      const videoHtml = this.buildVideoFromUrl(component.properties.url);
      if (videoHtml) {
        parts.push(videoHtml);
      }
    }

    return parts.join('\n');
  }

  extractProperties(component, activity, allComponents) {
    return {};
  }

  /**
   * Build video embed from component
   */
  buildVideoEmbed(component) {
    const props = component?.properties || {};

    if (!props.url) return '';

    return this.buildVideoFromUrl(props.url, props.poster || props.thumbnailUrl);
  }

  /**
   * Build video embed from URL
   */
  buildVideoFromUrl(url, poster = '') {
    if (!url) return '';

    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = this.extractYouTubeId(url);
      if (videoId) {
        return `<div class="exe-video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>`;
      }
    }

    // Vimeo
    if (url.includes('vimeo.com')) {
      const videoId = this.extractVimeoId(url);
      if (videoId) {
        return `<div class="exe-video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
</div>`;
      }
    }

    // HTML5 video
    const posterAttr = poster ? ` poster="${poster}"` : '';
    return `<div class="exe-video-container">
<video controls width="100%"${posterAttr}>
<source src="${url}" type="video/mp4">
Your browser does not support the video tag.
</video>
</div>`;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcVideoHandler;
} else {
  window.AdcVideoHandler = AdcVideoHandler;
}
