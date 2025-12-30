/**
 * AdcMatrixHandler
 *
 * Handler for ADC matrix-multiple-choice activity types.
 * Converts to eXeLearning 'form' iDevice.
 */
class AdcMatrixHandler extends BaseAdcHandler {
  static SUPPORTED_TYPES = ['matrix-multiple-choice'];

  canHandle(activityType) {
    return AdcMatrixHandler.SUPPORTED_TYPES.includes(activityType.toLowerCase());
  }

  getTargetType() {
    return 'form';
  }

  getSupportedTypes() {
    return AdcMatrixHandler.SUPPORTED_TYPES;
  }

  extractHtmlView(component, activity, allComponents) {
    const parts = [];

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
    const questionsData = [];

    // Find matrix quiz components
    const quizComponents = this.findComponentsByType(
      component?.id,
      'quiz',
      allComponents
    );

    for (const quiz of quizComponents) {
      const matrixActivities = this.findComponentsByType(
        quiz.id,
        'qMatrixActivity',
        allComponents
      );

      for (const matrixAct of matrixActivities) {
        const question = this.extractQuestion(matrixAct, allComponents);
        if (question) {
          questionsData.push(question);
        }
      }
    }

    return {
      questionsData,
      formType: 'matrix'
    };
  }

  extractQuestion(matrixActivity, allComponents) {
    const children = this.findChildComponents(matrixActivity.id, allComponents);

    let questionText = '';
    const rows = [];
    const columns = [];

    for (const child of children) {
      if (child.componentName === 'qWording') {
        questionText = child.properties?.quizElement || this.extractTextContent(child);
      }
      if (child.componentName === 'qMatrixRows') {
        const rowChildren = this.findChildComponents(child.id, allComponents);
        for (const rowChild of rowChildren) {
          if (rowChild.componentName === 'qMatrixRowItem') {
            rows.push({
              text: rowChild.properties?.quizElement || this.extractTextContent(rowChild)
            });
          }
        }
      }
      if (child.componentName === 'qMatrixColumns') {
        const colChildren = this.findChildComponents(child.id, allComponents);
        for (const colChild of colChildren) {
          if (colChild.componentName === 'qMatrixColumnItem') {
            columns.push({
              text: colChild.properties?.quizElement || this.extractTextContent(colChild)
            });
          }
        }
      }
    }

    if (!questionText || rows.length === 0 || columns.length === 0) return null;

    return {
      type: 'matrix',
      question: questionText,
      rows: rows,
      columns: columns
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdcMatrixHandler;
} else {
  window.AdcMatrixHandler = AdcMatrixHandler;
}
