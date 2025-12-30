/**
 * AdcBinaryChoiceHandler
 *
 * Handler for ADC binary-choice (true/false) activity types.
 * Converts to eXeLearning 'trueorfalse' iDevice.
 */
class AdcBinaryChoiceHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['binary-choice'];

  canHandle(activityType) {
    return AdcBinaryChoiceHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'trueorfalse';
  }

  getSupportedTypes() {
    return AdcBinaryChoiceHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    // For trueorfalse iDevice, htmlView is the instructions/intro
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
      // Find qBinaryActivity components within quiz
      const binaryActivities = this.findComponentsByType(
        quiz.id,
        'qBinaryActivity',
        allComponents
      );

      for (const binaryAct of binaryActivities) {
        const question = this.extractQuestion(binaryAct, allComponents);
        if (question) {
          questionsData.push(question);
        }
      }
    }

    // If no structured questions found, try to create from activity
    if (questionsData.length === 0 && activity?.choices) {
      const question = this.createQuestionFromChoices(activity);
      if (question) {
        questionsData.push(question);
      }
    }

    return { questionsData };
  }

  extractQuestion(binaryActivity, allComponents) {
    const children = this.findChildComponents(binaryActivity.id, allComponents);

    let questionText = '';
    let correctAnswer = true;
    let feedbackCorrect = '';
    let feedbackIncorrect = '';

    for (const child of children) {
      if (child.componentName === 'qWording') {
        questionText = child.properties?.quizElement || this.extractTextContent(child);
      }
      if (child.componentName === 'qBinaryOption') {
        const props = child.properties || {};
        correctAnswer = props.correctAnswer === true || props.correctAnswer === 'true';
        feedbackCorrect = props.feedbackCorrect || '';
        feedbackIncorrect = props.feedbackIncorrect || '';
      }
    }

    if (!questionText) return null;

    return {
      baseText: this.stripHtmlTags(questionText),
      htmlText: questionText,
      answers: [
        { text: 'True', correct: correctAnswer },
        { text: 'False', correct: !correctAnswer }
      ],
      feedback: {
        correct: feedbackCorrect,
        incorrect: feedbackIncorrect
      }
    };
  }

  createQuestionFromChoices(activity) {
    const title = this.getLocalizedText(activity.title);
    if (!title) return null;

    return {
      baseText: title,
      htmlText: `<p>${title}</p>`,
      answers: [
        { text: 'True', correct: true },
        { text: 'False', correct: false }
      ],
      feedback: { correct: '', incorrect: '' }
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcBinaryChoiceHandler;
} else {
  window.AdcBinaryChoiceHandler = AdcBinaryChoiceHandler;
}
