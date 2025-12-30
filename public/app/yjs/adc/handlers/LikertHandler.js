/**
 * AdcLikertHandler
 *
 * Handler for ADC likert scale activity types.
 * Converts to eXeLearning 'form' iDevice.
 */
class AdcLikertHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['likert'];

  canHandle(activityType) {
    return AdcLikertHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'form';
  }

  getSupportedTypes() {
    return AdcLikertHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const parts = [];

    // Add activity question
    const title = this.getLocalizedText(activity?.title);
    if (title) {
      parts.push(`<p>${title}</p>`);
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
    const questionsData = [];

    // Find likert quiz components
    const quizComponents = this.findComponentsByType(
      component?.id,
      'quiz',
      allComponents
    );

    for (const quiz of quizComponents) {
      const likertActivities = this.findComponentsByType(
        quiz.id,
        'qLikertActivity',
        allComponents
      );

      for (const likertAct of likertActivities) {
        const question = this.extractQuestion(likertAct, allComponents);
        if (question) {
          questionsData.push(question);
        }
      }
    }

    // Create default Likert scale if no structured data found
    if (questionsData.length === 0) {
      const title = this.getLocalizedText(activity?.title);
      if (title) {
        questionsData.push(this.createDefaultLikertQuestion(title));
      }
    }

    return {
      questionsData,
      formType: 'likert'
    };
  }

  extractQuestion(likertActivity, allComponents) {
    const children = this.findChildComponents(likertActivity.id, allComponents);

    let questionText = '';
    const options = [];

    for (const child of children) {
      if (child.componentName === 'qWording') {
        questionText = child.properties?.quizElement || this.extractTextContent(child);
      }
      if (child.componentName === 'qLikertOption') {
        const optionChildren = this.findChildComponents(child.id, allComponents);
        for (const optChild of optionChildren) {
          if (optChild.componentName === 'qLikertOptionItem') {
            const props = optChild.properties || {};
            options.push({
              text: props.quizElement || props.label || this.extractTextContent(optChild),
              value: props.value || options.length + 1
            });
          }
        }
      }
    }

    if (!questionText) return null;

    // Use default Likert scale if no options found
    if (options.length === 0) {
      return this.createDefaultLikertQuestion(questionText);
    }

    return {
      type: 'likert',
      question: questionText,
      options: options
    };
  }

  createDefaultLikertQuestion(questionText) {
    return {
      type: 'likert',
      question: questionText,
      options: [
        { text: 'Strongly Disagree', value: 1 },
        { text: 'Disagree', value: 2 },
        { text: 'Neutral', value: 3 },
        { text: 'Agree', value: 4 },
        { text: 'Strongly Agree', value: 5 }
      ]
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcLikertHandler;
} else {
  window.AdcLikertHandler = AdcLikertHandler;
}
