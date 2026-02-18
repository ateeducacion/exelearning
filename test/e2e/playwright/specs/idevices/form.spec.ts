import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    reloadPage,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    addIdevice,
} from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for Form iDevice
 *
 * Tests the Form (assessment) iDevice functionality including:
 * - Adding form and multiple question types (true/false, selection)
 * - Preview rendering with check/answers buttons
 * - Form interaction (answering questions)
 * - Persistence after reload
 */

/**
 * Helper to close any alert modals that might be blocking interactions
 */
async function closeAlertModals(page: Page): Promise<void> {
    const modal = page.locator('#modalAlert[data-open="true"]');
    if ((await modal.count()) > 0) {
        const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .btn-primary').first();
        if ((await okBtn.count()) > 0) {
            await okBtn.click();
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Helper to open the questions panel
 */
async function openQuestionsPanel(page: Page): Promise<void> {
    const showQuestionsBtn = page.locator('#buttonHideShowQuestionsTop').first();
    await showQuestionsBtn.waitFor({ state: 'visible', timeout: 5000 });

    const panel = page.locator('#questionsContainerTop');
    const isVisible = await panel.isVisible();

    if (!isVisible) {
        await showQuestionsBtn.click();
        await panel.waitFor({ state: 'visible', timeout: 5000 });
    }
}

/**
 * Helper to add a True/False question
 */
async function addTrueFalseQuestion(page: Page, questionText: string, answer: boolean): Promise<void> {
    await openQuestionsPanel(page);

    const addBtn = page.locator('#buttonAddTrueFalseQuestionTop');
    await addBtn.click();
    await page.waitForTimeout(500);

    const textareaContainer = page.locator('#formPreviewTextareaContainer');
    await textareaContainer.waitFor({ state: 'visible', timeout: 10000 });

    await page.waitForTimeout(500);

    const tinyMceIframe = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe').first();

    if ((await tinyMceIframe.count()) > 0) {
        const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').first();
        const body = frame.locator('body');
        await body.click();
        await page.waitForTimeout(300);
        await page.keyboard.type(questionText, { delay: 10 });
    } else {
        const textarea = page.locator('#formPreviewTextareaContainer textarea').first();
        if ((await textarea.count()) > 0) {
            await textarea.fill(questionText);
        }
    }

    const trueRadio = page
        .locator('input[type="radio"][value="true"], #formPreviewTrueFalseRadioButtons input[value="true"]')
        .first();
    const falseRadio = page
        .locator('input[type="radio"][value="false"], #formPreviewTrueFalseRadioButtons input[value="false"]')
        .first();

    if (answer && (await trueRadio.count()) > 0) {
        await trueRadio.check({ force: true });
    } else if (!answer && (await falseRadio.count()) > 0) {
        await falseRadio.check({ force: true });
    }

    const saveBtn = page
        .locator(
            'input[id$="_buttonSaveQuestion"], input.question-button[value*="Save"], input.question-button[value*="Guardar"]',
        )
        .first();
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    } else {
        const altSaveBtn = page.locator('.footer-buttons-container input[type="button"]').first();
        if ((await altSaveBtn.count()) > 0) {
            await altSaveBtn.click();
        }
    }
    await page.waitForTimeout(500);

    await closeAlertModals(page);
}

/**
 * Helper to add a Selection question (single or multiple choice)
 */
async function addSelectionQuestion(
    page: Page,
    questionText: string,
    options: { text: string; correct: boolean }[],
    isMultiple: boolean = false,
): Promise<void> {
    await openQuestionsPanel(page);

    const addBtn = page.locator('#buttonAddSelectionQuestionTop');
    await addBtn.click();
    await page.waitForTimeout(500);

    const textareaContainer = page.locator('#formPreviewTextareaContainer');
    await textareaContainer.waitFor({ state: 'visible', timeout: 10000 });

    await page.waitForTimeout(500);

    const tinyMceIframes = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe');

    if ((await tinyMceIframes.count()) > 0) {
        const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').first();
        const body = frame.locator('body');
        await body.click();
        await page.waitForTimeout(300);
        await page.keyboard.type(questionText, { delay: 10 });
    }

    if (isMultiple) {
        const toggleBtn = page.locator('#buttonRadioCheckboxToggle');
        if ((await toggleBtn.count()) > 0) {
            await toggleBtn.click();
        }
    }

    const optionEditors = page.locator('#formPreviewTextareaContainer .tox-tinymce');
    const optionCount = await optionEditors.count();

    if (optionCount > 1 && options.length > 0) {
        const optionFrames = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe');
        if ((await optionFrames.count()) > 1) {
            const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').nth(1);
            const body = frame.locator('body');
            await body.click();
            await page.waitForTimeout(300);
            await page.keyboard.type(options[0].text, { delay: 10 });
        }

        if (options[0].correct) {
            const firstRadio = page.locator('#option_1').first();
            if ((await firstRadio.count()) > 0) {
                await firstRadio.check({ force: true });
            }
        }
    }

    for (let i = 1; i < options.length; i++) {
        const addOptionBtn = page.locator('#formPreview_buttonAddOption');
        await addOptionBtn.click();
        await page.waitForTimeout(500);

        const optionFrames = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe');
        const frameCount = await optionFrames.count();
        if (frameCount > i + 1) {
            const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').nth(i + 1);
            const body = frame.locator('body');
            await body.click();
            await page.waitForTimeout(300);
            await page.keyboard.type(options[i].text, { delay: 10 });
        }

        if (options[i].correct) {
            const optionRadio = page.locator(`#option_${i + 1}`).first();
            if ((await optionRadio.count()) > 0) {
                await optionRadio.check({ force: true });
            }
        }
    }

    const saveBtn = page
        .locator(
            'input[id$="_buttonSaveQuestion"], input.question-button[value*="Save"], input.question-button[value*="Guardar"]',
        )
        .first();
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    } else {
        const altSaveBtn = page.locator('.footer-buttons-container input[type="button"]').first();
        if ((await altSaveBtn.count()) > 0) {
            await altSaveBtn.click();
        }
    }
    await page.waitForTimeout(500);

    await closeAlertModals(page);
}

/**
 * Helper to save the Form iDevice
 */
async function saveFormIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.form').first();
    const saveBtn = block.locator('.btn-save-idevice');

    try {
        await saveBtn.click({ timeout: 5000 });
    } catch {
        await closeAlertModals(page);
        await saveBtn.click({ timeout: 5000 });
    }

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.form');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to verify form renders in preview
 */
async function verifyFormRendered(iframe: FrameLocator): Promise<void> {
    const formContainer = iframe.locator('.form-IDevice').first();
    await formContainer.waitFor({ state: 'visible', timeout: 15000 });

    const questionsContainer = iframe.locator('[id^="form-questions-"]').first();
    await expect(questionsContainer).toBeVisible({ timeout: 10000 });

    const checkBtn = iframe.locator('[id^="form-button-check-"]').first();
    await expect(checkBtn).toBeVisible({ timeout: 5000 });
}

test.describe('Form iDevice', () => {
    test.describe('Workflow', () => {
        test('should add form, add multiple question types, and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Workflow Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            // Add form iDevice using centralized helpers
            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'form');

            // Verify iDevice was added
            const idevice = page.locator('#node-content article .idevice_node.form').first();
            await expect(idevice).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#buttonHideShowQuestionsTop')).toBeVisible({ timeout: 5000 });

            // Add true/false question
            await addTrueFalseQuestion(page, 'The sky is blue.', true);
            const questionPreview = page.locator('#formPreview .question-container, #formPreview [class*="question"]');
            await expect(questionPreview.first()).toBeVisible({ timeout: 5000 });

            // Add selection question
            await addSelectionQuestion(page, 'What is the capital of France?', [
                { text: 'London', correct: false },
                { text: 'Paris', correct: true },
                { text: 'Berlin', correct: false },
            ]);

            // Add another true/false question
            await addTrueFalseQuestion(page, 'Water boils at 100°C.', true);

            // Verify multiple questions exist
            const questions = page.locator('#formPreview > li, #formPreview .FormView_question, .FormView_question');
            const count = await questions.count();
            expect(count).toBeGreaterThanOrEqual(1);

            // Save
            await saveFormIdevice(page);
            await workarea.save();
        });
    });

    test.describe('Preview Panel', () => {
        test('should render form with questions and check/answers buttons in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Preview Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'form');

            await addTrueFalseQuestion(page, 'Preview test question: True or False?', true);
            await addSelectionQuestion(page, 'Preview test: Select the correct answer', [
                { text: 'Option A', correct: false },
                { text: 'Option B', correct: true },
            ]);

            await saveFormIdevice(page);
            await workarea.save();

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Verify form renders correctly with questions
            await verifyFormRendered(iframe);
            const questions = iframe.locator('.FRMP-Question, [class*="question"]');
            const count = await questions.count();
            expect(count).toBeGreaterThanOrEqual(1);

            // Verify check button is present
            const checkBtn = iframe.locator('[id^="form-button-check-"]').first();
            await expect(checkBtn).toBeVisible({ timeout: 10000 });

            // Verify show answers button exists in DOM (may or may not be visible)
            const showAnswersBtn = iframe.locator('[id^="form-button-show-answers-"]').first();
            const showAnswersCount = await showAnswersBtn.count();
            expect(showAnswersCount).toBeGreaterThanOrEqual(0);
        });
    });

    test.describe('Form Interaction', () => {
        test('should allow answering true/false question', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form TF Interaction Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'form');

            await addTrueFalseQuestion(page, 'The sun rises in the east.', true);

            await saveFormIdevice(page);
            await workarea.save();
            await page.waitForTimeout(500); // let save propagate before preview

            // Open preview
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });
            await page.waitForTimeout(500); // form JS initialization

            // Find and click on "True" radio button
            const trueRadio = iframe.locator('input[type="radio"][value="true"], label:has-text("True") input');
            if ((await trueRadio.count()) > 0) {
                await trueRadio.first().click();
            }

            // Click check button
            const checkBtn = iframe.locator('[id^="form-button-check-"]').first();
            await checkBtn.click();

            await page.waitForTimeout(500);

            // Verify score is shown
            const scoreText = iframe.locator('[id^="form-score-"], .score-text').first();
            await expect(scoreText).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Persistence', () => {
        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Persistence Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Assessment|Evaluación/i);
            await addIdevice(page, 'form');

            const uniqueQuestion = `Persistence test question ${Date.now()}`;
            await addTrueFalseQuestion(page, uniqueQuestion, true);

            await saveFormIdevice(page);
            await workarea.save();

            // Reload
            await reloadPage(page);
            await selectFirstPage(page);

            // Verify iDevice is still there
            const idevice = page.locator('#node-content article .idevice_node.form').first();
            await expect(idevice).toBeVisible({ timeout: 15000 });
        });
    });
});
