/**
 * AdcDropdownHandler
 *
 * Handler for ADC drop-down-choice activity types.
 * Converts to eXeLearning 'form' iDevice.
 */
class AdcDropdownHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['drop-down-choice'];

  canHandle(activityType) {
    return AdcDropdownHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'form';
  }

  getSupportedTypes() {
    return AdcDropdownHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const parts = [];

    // Add activity title/question
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

    // Try to extract from activity choices
    if (activity?.choices) {
      for (const choiceGroup of activity.choices) {
        if (choiceGroup.items) {
          for (const item of choiceGroup.items) {
            const question = this.createDropdownQuestion(item, activity);
            if (question) {
              questionsData.push(question);
            }
          }
        }
      }
    }

    // Also try to find quiz components
    const quizComponents = this.findComponentsByType(
      component?.id,
      'quiz',
      allComponents
    );

    for (const quiz of quizComponents) {
      const comboActivities = this.findComponentsByType(
        quiz.id,
        'qComboActivity',
        allComponents
      );

      for (const comboAct of comboActivities) {
        const question = this.extractQuestion(comboAct, allComponents);
        if (question) {
          questionsData.push(question);
        }
      }
    }

    return {
      questionsData,
      formType: 'dropdown'
    };
  }

  extractQuestion(comboActivity, allComponents) {
    const children = this.findChildComponents(comboActivity.id, allComponents);

    let questionText = '';
    const options = [];

    for (const child of children) {
      if (child.componentName === 'qWording') {
        questionText = child.properties?.quizElement || this.extractTextContent(child);
      }
      if (child.componentName === 'qComboOption') {
        const optionChildren = this.findChildComponents(child.id, allComponents);
        for (const optChild of optionChildren) {
          if (optChild.componentName === 'qComboOptionItem') {
            const props = optChild.properties || {};
            options.push({
              text: props.quizElement || props.description || this.extractTextContent(optChild),
              correct: props.correctAnswer === true || props.correctAnswer === 'true'
            });
          }
        }
      }
    }

    if (!questionText || options.length === 0) return null;

    return {
      type: 'dropdown',
      question: questionText,
      options: options,
      feedback: { correct: '', incorrect: '' }
    };
  }

  createDropdownQuestion(item, activity) {
    if (!item.items || item.items.length === 0) return null;

    // Try to get question from wording
    let questionText = this.getLocalizedText(activity.title) || 'Select the correct option';

    const options = item.items.map(option => ({
      text: option.description || option.id,
      correct: option.correct === true
    }));

    return {
      type: 'dropdown',
      question: questionText,
      options: options,
      feedback: { correct: '', incorrect: '' }
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcDropdownHandler;
} else {
  window.AdcDropdownHandler = AdcDropdownHandler;
}
