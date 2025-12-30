/**
 * AdcHandlerRegistry
 *
 * Registry for ADC activity type handlers.
 * Maps ADC activity types to appropriate handlers for conversion to eXeLearning iDevices.
 */
const AdcHandlerRegistry = {
  handlers: null,

  /**
   * Initialize the handler registry with all available handlers
   */
  init() {
    if (this.handlers) return;

    // Order matters: more specific handlers first, DefaultHandler last
    this.handlers = [];

    // Add handlers in order of specificity
    // Quiz/Interactive handlers (most specific)
    if (window.AdcBinaryChoiceHandler) {
      this.handlers.push(new window.AdcBinaryChoiceHandler());
    }
    if (window.AdcSingleChoiceHandler) {
      this.handlers.push(new window.AdcSingleChoiceHandler());
    }
    if (window.AdcMultipleChoiceHandler) {
      this.handlers.push(new window.AdcMultipleChoiceHandler());
    }
    if (window.AdcDropdownHandler) {
      this.handlers.push(new window.AdcDropdownHandler());
    }
    if (window.AdcMatchingHandler) {
      this.handlers.push(new window.AdcMatchingHandler());
    }
    if (window.AdcLikertHandler) {
      this.handlers.push(new window.AdcLikertHandler());
    }
    if (window.AdcMatrixHandler) {
      this.handlers.push(new window.AdcMatrixHandler());
    }

    // Media handlers
    if (window.AdcVideoHandler) {
      this.handlers.push(new window.AdcVideoHandler());
    }
    if (window.AdcAudioHandler) {
      this.handlers.push(new window.AdcAudioHandler());
    }

    // Display-only handlers
    if (window.AdcDisplayOnlyHandler) {
      this.handlers.push(new window.AdcDisplayOnlyHandler());
    }

    // Content handlers (essay, no-interactive)
    if (window.AdcEssayHandler) {
      this.handlers.push(new window.AdcEssayHandler());
    }

    // Default handler must be last
    if (window.AdcDefaultHandler) {
      this.handlers.push(new window.AdcDefaultHandler());
    }

    Logger.log(`[AdcHandlerRegistry] Initialized with ${this.handlers.length} handlers`);
  },

  /**
   * Get a handler for the given activity type
   * @param {string} activityType - ADC activity type (short name or URI)
   * @returns {BaseAdcHandler} Handler instance
   */
  getHandler(activityType) {
    this.init();

    // Normalize activity type (extract short name from URI)
    const normalized = this.normalizeType(activityType);

    for (const handler of this.handlers) {
      if (handler.canHandle(normalized)) {
        return handler;
      }
    }

    // Return last handler (should be DefaultHandler) or null
    return this.handlers.length > 0 ? this.handlers[this.handlers.length - 1] : null;
  },

  /**
   * Normalize activity type from URI to short name
   * @param {string} activityType - Activity type URI or short name
   * @returns {string} Short activity type
   */
  normalizeType(activityType) {
    if (!activityType) return '';

    // Extract last segment from URI
    if (activityType.includes('/')) {
      const parts = activityType.split('/');
      return parts[parts.length - 1];
    }

    return activityType.toLowerCase();
  },

  /**
   * Get list of all supported activity types
   * @returns {Array<string>} List of activity types
   */
  getSupportedTypes() {
    this.init();

    const types = [];
    for (const handler of this.handlers) {
      if (handler.getSupportedTypes) {
        types.push(...handler.getSupportedTypes());
      }
    }
    return types;
  },

  /**
   * Reset the registry (mainly for testing)
   */
  reset() {
    this.handlers = null;
  }
};

// Export for both module and global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcHandlerRegistry;
} else {
  window.AdcHandlerRegistry = AdcHandlerRegistry;
}
