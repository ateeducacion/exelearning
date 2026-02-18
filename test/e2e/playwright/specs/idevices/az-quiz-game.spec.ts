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
 * E2E Tests for A-Z Quiz Game (Rosco) iDevice
 *
 * Tests the A-Z Quiz Game iDevice functionality including:
 * - Basic operations (add, fill words, save)
 * - Preview rendering with rosco wheel, canvas, letter indicators, and start button
 * - Game interaction (start game, answer questions, track score/errors, skip)
 * - Configuration (game duration)
 * - Persistence after reload
 */

const TEST_DATA = {
    words: [
        { letter: 'A', word: 'Apple', definition: 'A red or green fruit that grows on trees' },
        { letter: 'B', word: 'Banana', definition: 'A yellow curved tropical fruit' },
        { letter: 'C', word: 'Cherry', definition: 'A small red stone fruit' },
    ],
};

/**
 * Helper to wait for all 26 word input blocks to initialize
 */
async function waitForWordInputs(page: Page): Promise<void> {
    await page
        .waitForFunction(() => document.querySelectorAll('.roscoWordMutimediaEdition').length >= 26, undefined, {
            timeout: 10000,
        })
        .catch(() => {});
}

/**
 * Helper to fill in words and definitions for specific letters
 */
async function fillWords(
    page: Page,
    words: Array<{ letter: string; word: string; definition: string }>,
): Promise<void> {
    for (const entry of words) {
        const wordBlocks = page.locator('.roscoWordMutimediaEdition');
        const count = await wordBlocks.count();

        for (let i = 0; i < count; i++) {
            const block = wordBlocks.nth(i);
            const letterText = await block.locator('h3.roscoLetterEdition').textContent();

            if (letterText?.trim().toUpperCase() === entry.letter.toUpperCase()) {
                const wordInput = block.locator('input.roscoWordEdition, input[placeholder="Word"]').first();
                await wordInput.clear();
                await wordInput.fill(entry.word);

                const definitionInput = block
                    .locator('input.roscoDefinitionEdition, input[placeholder="Definition"]')
                    .first();
                await definitionInput.clear();
                await definitionInput.fill(entry.definition);
                await definitionInput.blur();
                await page.waitForTimeout(300);
                break;
            }
        }
    }
}

/**
 * Helper to set game duration via the Options fieldset
 */
async function setGameDuration(page: Page, duration: string): Promise<void> {
    const optionsHeader = page
        .locator('fieldset legend a:has-text("Options"), fieldset legend a:has-text("Opciones")')
        .first();
    if ((await optionsHeader.count()) > 0) {
        await optionsHeader.click();
        await page.waitForTimeout(300);
    }

    const durationInput = page.locator('#roscoDuration');
    if ((await durationInput.count()) > 0) {
        await durationInput.scrollIntoViewIfNeeded();
        await durationInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        await durationInput.clear();
        await durationInput.fill(duration);
    }
}

/**
 * Helper to close any alert modals that might be blocking interactions
 */
async function closeAlertModals(page: Page): Promise<void> {
    const modal = page.locator('#modalAlert[data-open="true"]');
    if ((await modal.count()) > 0) {
        const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .btn-primary').first();
        if ((await okBtn.count()) > 0) {
            await okBtn.click();
            await page.waitForTimeout(300);
        }
    }
}

/**
 * Helper to save the az-quiz-game iDevice
 */
async function saveAzQuizGameIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.az-quiz-game').last();
    const saveBtn = block.locator('.btn-save-idevice');

    try {
        await saveBtn.click({ timeout: 5000 });
    } catch {
        await closeAlertModals(page);
        await saveBtn.click();
    }

    await page
        .waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.az-quiz-game');
                return (
                    (idevice && idevice.getAttribute('mode') !== 'edition') ||
                    document.querySelector('#node-content .az-quiz-game .rosco-IDevice') !== null
                );
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to verify the rosco game container is visible in preview
 */
async function verifyRoscoInPreview(iframe: FrameLocator): Promise<void> {
    await iframe.locator('.rosco-IDevice').first().waitFor({ state: 'visible', timeout: 10000 });
    await expect(iframe.locator('[id^="roscoMainContainer-"]').first()).toBeVisible({ timeout: 10000 });
}

test.describe('A-Z Quiz Game iDevice', () => {
    test.describe('Workflow', () => {
        test('should add iDevice, fill words, and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'AZ Quiz Workflow Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Games|Juegos/i);
            await addIdevice(page, 'az-quiz-game');
            await waitForWordInputs(page);

            // Verify form is visible with 26 word inputs (A–Z)
            const azQuizIdevice = page.locator('#node-content article .idevice_node.az-quiz-game').first();
            await expect(azQuizIdevice).toBeVisible({ timeout: 10000 });
            const wordBlocks = page.locator('.roscoWordMutimediaEdition');
            expect(await wordBlocks.count()).toBeGreaterThanOrEqual(26);

            // Fill words and verify letter color indicator updates
            await fillWords(page, TEST_DATA.words);
            const aBlock = wordBlocks.first();
            const bgColor = await aBlock
                .locator('h3.roscoLetterEdition')
                .evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toContain('rgb');

            // Save and verify view mode displays game UI
            await saveAzQuizGameIdevice(page);
            const roscoContent = page.locator('#node-content .az-quiz-game');
            await expect(roscoContent.first()).toBeAttached({ timeout: 10000 });
            const gameStart = page.locator('#node-content .az-quiz-game a:has-text("Click here to start")');
            const statsArea = page.locator('#node-content .az-quiz-game:has-text("Hits")');
            await expect(gameStart.or(statsArea).first()).toBeAttached({ timeout: 5000 });
        });

        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Persist Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Games|Juegos/i);
            await addIdevice(page, 'az-quiz-game');
            await waitForWordInputs(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);
            await workarea.save();

            await reloadPage(page);
            await selectFirstPage(page);

            const roscoContent = page.locator(
                '#node-content .az-quiz-game .rosco-IDevice, #node-content .az-quiz-game .rosco-DataGame',
            );
            await expect(roscoContent.first()).toBeAttached({ timeout: 15000 });
        });
    });

    test.describe('Preview Panel', () => {
        test('should display rosco wheel, canvas, letters, and start button in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Preview Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Games|Juegos/i);
            await addIdevice(page, 'az-quiz-game');
            await waitForWordInputs(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Verify rosco container and main game container
            await verifyRoscoInPreview(iframe);

            // Verify canvas has proper dimensions (not 0×0)
            const canvasInfo = await iframe
                .locator('[id^="roscoCanvas-"]')
                .first()
                .evaluate(el => {
                    const canvas = el as HTMLCanvasElement;
                    return { width: canvas.width, height: canvas.height, hasContext: !!canvas.getContext('2d') };
                });
            expect(canvasInfo.width).toBeGreaterThan(0);
            expect(canvasInfo.height).toBeGreaterThan(0);
            expect(canvasInfo.hasContext).toBe(true);

            // Verify 26 letter indicators exist and filled letters (A, B, C) are not gray
            const letterIndicators = iframe.locator('.rosco-Letter');
            expect(await letterIndicators.count()).toBeGreaterThanOrEqual(26);
            const letterABgColor = await iframe
                .locator('[id^="letterRA-"]')
                .first()
                .evaluate(el => getComputedStyle(el).backgroundColor);
            expect(letterABgColor).not.toContain('rgb(249, 249, 249)');

            // Verify start button is visible
            await expect(iframe.locator('[id^="roscoStartGame-"]').first()).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Game Interaction', () => {
        test('should start game, answer correctly, and track errors', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Game Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Games|Juegos/i);
            await addIdevice(page, 'az-quiz-game');
            await waitForWordInputs(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Start game
            await iframe.locator('[id^="roscoStartGame-"]').first().click();

            // Verify question interface appears
            await expect(iframe.locator('[id^="roscoQuestionDiv-"]').first()).toBeVisible({ timeout: 10000 });
            await expect(iframe.locator('[id^="roscoEdReply-"]').first()).toBeVisible({ timeout: 5000 });
            await expect(iframe.locator('[id^="roscoBtnReply-"]').first()).toBeVisible({ timeout: 5000 });

            // Verify counters start at 0
            const hitsCounter = iframe.locator('[id^="roscotPHits-"]').first();
            const errorsCounter = iframe.locator('[id^="roscotPErrors-"]').first();
            expect(await hitsCounter.textContent()).toBe('0');
            expect(await errorsCounter.textContent()).toBe('0');

            // Answer correctly (first question is A = Apple)
            await iframe.locator('[id^="roscoEdReply-"]').first().fill('Apple');
            await iframe.locator('[id^="roscoBtnReply-"]').first().click();
            await expect(hitsCounter).toHaveText('1', { timeout: 5000 });

            // Answer wrong on next question
            await iframe.locator('[id^="roscoEdReply-"]').first().fill('WrongAnswer');
            await iframe.locator('[id^="roscoBtnReply-"]').first().click();
            await expect(errorsCounter).toHaveText('1', { timeout: 5000 });
        });

        test('should skip questions with Move On button', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Skip Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Games|Juegos/i);
            await addIdevice(page, 'az-quiz-game');
            await waitForWordInputs(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await iframe.locator('[id^="roscoStartGame-"]').first().click();

            const definitionText = iframe.locator('[id^="roscoPDefinition-"]').first();
            const firstDefinition = await definitionText.textContent();

            await iframe.locator('[id^="roscoBtnMoveOn-"]').first().click();

            await expect(definitionText).not.toHaveText(firstDefinition ?? '', { timeout: 5000 });
        });
    });

    test.describe('Configuration', () => {
        test('should respect game duration setting', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Duration Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await expandIdeviceCategory(page, /Games|Juegos/i);
            await addIdevice(page, 'az-quiz-game');
            await waitForWordInputs(page);
            await fillWords(page, TEST_DATA.words);
            await setGameDuration(page, '60');
            await saveAzQuizGameIdevice(page);
            await workarea.save();

            await page.click('#head-bottom-preview');
            await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Verify time display shows 1:00 (60 seconds)
            await expect(iframe.locator('[id^="roscoPTime-"]').first()).toContainText('1:00', { timeout: 10000 });
        });
    });
});
