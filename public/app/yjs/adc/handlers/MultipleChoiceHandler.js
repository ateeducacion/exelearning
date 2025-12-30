/**
 * AdcMultipleChoiceHandler
 *
 * Handler for ADC multiple-choice activity types.
 * Converts to eXeLearning 'quick-questions-multiple-choice' iDevice.
 */
class AdcMultipleChoiceHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['multiple-choice'];

  canHandle(activityType) {
    return AdcMultipleChoiceHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'quick-questions-multiple-choice';
  }

  getSupportedTypes() {
    return AdcMultipleChoiceHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const textComponents = this.findComponentsByType(
      component?.id,
      'text',
      allComponents
    );

    const parts = [];
    for (const textComp of textComponents) {
      if (textComp.properties?.textContent) {
        parts.push(textComp.properties.textContent);
      }
    }

    return parts.join('\n');
  }

  extractProperties(component, activity, allComponents) {
    const questionsData = [];

    // Find quiz components
    const quizComponents = this.findComponentsByType(
      component?.id,
      'quiz',
      allComponents
    );

    for (const quiz of quizComponents) {
      const multiActivities = this.findComponentsByType(
        quiz.id,
        'qMultipleActivity',
        allComponents
      );

      for (const multiAct of multiActivities) {
        const question = this.extractQuestion(multiAct, allComponents);
        if (question) {
          questionsData.push(question);
        }
      }
    }

    // Try choices from activity
    if (questionsData.length === 0 && activity?.choices) {
      const question = this.createQuestionFromChoices(activity);
      if (question) {
        questionsData.push(question);
      }
    }

    return { questionsData };
  }

  extractQuestion(multiActivity, allComponents) {
    const children = this.findChildComponents(multiActivity.id, allComponents);

    let questionText = '';
    const answers = [];
    let feedbackCorrect = '';
    let feedbackIncorrect = '';

    for (const child of children) {
      if (child.componentName === 'qWording') {
        questionText = child.properties?.quizElement || this.extractTextContent(child);
      }
      if (child.componentName === 'qMultipleOption') {
        const optionChildren = this.findChildComponents(child.id, allComponents);
        for (const optChild of optionChildren) {
          if (optChild.componentName === 'qMultipleOptionItem') {
            const props = optChild.properties || {};
            answers.push({
              text: props.quizElement || this.extractTextContent(optChild),
              correct: props.correctAnswer === true || props.correctAnswer === 'true'
            });
          }
        }
        const optProps = child.properties || {};
        feedbackCorrect = optProps.feedbackCorrect || '';
        feedbackIncorrect = optProps.feedbackIncorrect || '';
      }
    }

    if (!questionText || answers.length === 0) return null;

    return {
      baseText: this.stripHtmlTags(questionText),
      htmlText: questionText,
      answers: answers,
      multipleAnswers: true,
      feedback: {
        correct: feedbackCorrect,
        incorrect: feedbackIncorrect
      }
    };
  }

  createQuestionFromChoices(activity) {
    const title = this.getLocalizedText(activity.title);
    const choices = activity.choices || [];

    if (!title || choices.length === 0) return null;

    const answers = [];
    for (const choiceGroup of choices) {
      if (choiceGroup.items) {
        for (const item of choiceGroup.items) {
          if (item.items) {
            for (const option of item.items) {
              answers.push({
                text: option.description || option.id,
                correct: option.correct === true
              });
            }
          }
        }
      }
    }

    if (answers.length === 0) return null;

    return {
      baseText: title,
      htmlText: `<p>${title}</p>`,
      answers: answers,
      multipleAnswers: true,
      feedback: { correct: '', incorrect: '' }
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcMultipleChoiceHandler;
} else {
  window.AdcMultipleChoiceHandler = AdcMultipleChoiceHandler;
}
