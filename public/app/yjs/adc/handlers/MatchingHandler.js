/**
 * AdcMatchingHandler
 *
 * Handler for ADC matching-pairs activity types.
 * Converts to eXeLearning 'relaciona' iDevice.
 */
class AdcMatchingHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['matching-pairs'];

  canHandle(activityType) {
    return AdcMatchingHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'relaciona';
  }

  getSupportedTypes() {
    return AdcMatchingHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const parts = [];

    // Add instructions
    const title = this.getLocalizedText(activity?.title);
    if (title) {
      parts.push(`<p>${title}</p>`);
    }

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
    const pairs = [];

    // Find matching activity components
    const quizComponents = this.findComponentsByType(
      component?.id,
      'quiz',
      allComponents
    );

    for (const quiz of quizComponents) {
      const matchActivities = this.findComponentsByType(
        quiz.id,
        'qMatchingActivity',
        allComponents
      );

      for (const matchAct of matchActivities) {
        const extractedPairs = this.extractPairs(matchAct, allComponents);
        pairs.push(...extractedPairs);
      }
    }

    // Try from activity choices
    if (pairs.length === 0 && activity?.choices) {
      const extractedPairs = this.extractPairsFromChoices(activity.choices);
      pairs.push(...extractedPairs);
    }

    return {
      pairs: pairs,
      shuffled: true
    };
  }

  extractPairs(matchActivity, allComponents) {
    const pairs = [];
    const children = this.findChildComponents(matchActivity.id, allComponents);

    for (const child of children) {
      if (child.componentName === 'qMatchingOption') {
        const optionChildren = this.findChildComponents(child.id, allComponents);

        let leftText = '';
        let rightText = '';

        for (const optChild of optionChildren) {
          if (optChild.componentName === 'qMatchingLeft') {
            leftText = optChild.properties?.quizElement || this.extractTextContent(optChild);
          }
          if (optChild.componentName === 'qMatchingRight') {
            rightText = optChild.properties?.quizElement || this.extractTextContent(optChild);
          }
        }

        if (leftText && rightText) {
          pairs.push({
            left: this.stripHtmlTags(leftText),
            right: this.stripHtmlTags(rightText)
          });
        }
      }
    }

    return pairs;
  }

  extractPairsFromChoices(choices) {
    const pairs = [];

    for (const choiceGroup of choices) {
      if (choiceGroup.items) {
        for (let i = 0; i < choiceGroup.items.length; i += 2) {
          const left = choiceGroup.items[i];
          const right = choiceGroup.items[i + 1];

          if (left && right) {
            pairs.push({
              left: left.description || left.id,
              right: right.description || right.id
            });
          }
        }
      }
    }

    return pairs;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcMatchingHandler;
} else {
  window.AdcMatchingHandler = AdcMatchingHandler;
}
