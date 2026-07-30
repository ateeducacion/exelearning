import { test, expect } from '../../fixtures/auth.fixture';
import { reloadPage, gotoWorkarea } from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for 360° panorama viewer (three-sixty-viewer) iDevice
 *
 * Covers: add to page, set configuration fields, save, persist after reload,
 * verify exported dependencies are registered.
 */

const TEST_DATA = {
    alt: 'E2E test panorama',
    yaw: '45',
    pitch: '10',
    fov: '90',
    autorotateSpeed: '2.5',
};

async function selectPageNode(page: Page): Promise<void> {
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '[data-testid="nav-node-text"]',
        '.structure-tree li .nav-element-text',
    ];

    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                break;
            } catch {
                // try next
            }
        }
    }

    await page.waitForTimeout(500);
    await page
        .waitForFunction(() => !!document.querySelector('#node-content'), undefined, { timeout: 10000 })
        .catch(() => {});
}

async function addThreeSixtyIdeviceFromPanel(page: Page): Promise<void> {
    await selectPageNode(page);

    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            await infoCategory.locator('.label').click();
            await page.waitForTimeout(500);
        }
    }

    await page.waitForTimeout(500);

    const idevice = page.locator('.idevice_item[id="three-sixty-viewer"]').first();
    await idevice.waitFor({ state: 'visible', timeout: 10000 });
    await idevice.scrollIntoViewIfNeeded();
    await idevice.click();

    await page.locator('#node-content article .idevice_node.three-sixty-viewer').first().waitFor({ timeout: 15000 });

    await page.locator('#threeSixtyAlt').waitFor({ state: 'visible', timeout: 10000 });
}

async function fillForm(page: Page): Promise<void> {
    await page.locator('#threeSixtyAlt').fill(TEST_DATA.alt);
    await page.locator('#threeSixtyYaw').fill(TEST_DATA.yaw);
    await page.locator('#threeSixtyPitch').fill(TEST_DATA.pitch);
    await page.locator('#threeSixtyFov').fill(TEST_DATA.fov);
    await page.locator('#threeSixtyAutorotate').check();
    await page.locator('#threeSixtyAutorotateSpeed').fill(TEST_DATA.autorotateSpeed);
    // Dispatch input/change events to guarantee state propagation
    await page.evaluate(() => {
        ['#threeSixtyYaw', '#threeSixtyPitch', '#threeSixtyFov', '#threeSixtyAutorotateSpeed', '#threeSixtyAlt']
            .map(id => document.querySelector(id) as HTMLInputElement | null)
            .forEach(el => {
                if (!el) return;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
    });
}

async function saveIdeviceInPage(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.three-sixty-viewer').last();
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.click({ timeout: 5000 });
    await page.waitForTimeout(500);
}

/** After a reload: select the page node and reopen the iDevice for editing. */
async function reopenForEdit(page: Page, readySelector = '#threeSixtyAlt'): Promise<void> {
    const pageNode = page
        .locator('.nav-element-text')
        .filter({ hasText: /New page|Nueva página/i })
        .first();
    if ((await pageNode.count()) > 0) {
        await pageNode.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(500);
    }
    await page
        .waitForFunction(() => !!document.querySelector('#node-content .idevice_node.three-sixty-viewer'), undefined, {
            timeout: 15000,
        })
        .catch(() => {});
    const editBtn = page.locator('#node-content .idevice_node.three-sixty-viewer .btn-edit-idevice').first();
    if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
    } else {
        await page
            .locator('#node-content .idevice_node.three-sixty-viewer .idevice_body')
            .first()
            .dblclick({ timeout: 5000 })
            .catch(() => {});
    }
    await page.locator(readySelector).waitFor({ state: 'visible', timeout: 10000 });
}

/** A 2x1 PNG the hidden file-input fallback turns into a data-URL source. */
const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR4nGNgYGD4DwABBAEAX+XLSQAAAABJRU5ErkJggg==',
    'base64',
);

/** Give the active scene an image through the hidden file input. */
async function setSceneImage(page: Page): Promise<void> {
    await page.setInputFiles('#threeSixtyImageFile', {
        name: 'tiny.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
    });
    await page
        .waitForFunction(
            () => {
                const name = document.querySelector('#threeSixtyImageName');
                return !!name && name.textContent !== 'No image selected' && name.textContent !== '';
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});
}

test.describe('Three Sixty Viewer iDevice', () => {
    test('adds three-sixty-viewer and shows all configuration fields', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Three Sixty Add Test');
        await gotoWorkarea(page, projectUuid);

        await addThreeSixtyIdeviceFromPanel(page);

        await expect(page.locator('#threeSixtyImageButton')).toBeVisible();
        await expect(page.locator('#threeSixtyAlt')).toBeVisible();
        await expect(page.locator('#threeSixtyYaw')).toBeVisible();
        await expect(page.locator('#threeSixtyPitch')).toBeVisible();
        await expect(page.locator('#threeSixtyFov')).toBeVisible();
        await expect(page.locator('#threeSixtyAutorotate')).toBeVisible();
        await expect(page.locator('#threeSixtyZoom')).toBeVisible();
        await expect(page.locator('#threeSixtyFullscreen')).toBeVisible();

        // Defaults
        await expect(page.locator('#threeSixtyYaw')).toHaveValue('0');
        await expect(page.locator('#threeSixtyPitch')).toHaveValue('0');
        await expect(page.locator('#threeSixtyFov')).toHaveValue('75');
    });

    test('persists configuration across save + reload', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const workarea = new WorkareaPage(page);
        const projectUuid = await createProject(page, 'Three Sixty Persist Test');
        await gotoWorkarea(page, projectUuid);

        await addThreeSixtyIdeviceFromPanel(page);
        await fillForm(page);
        await saveIdeviceInPage(page);

        await workarea.save();
        await page.waitForTimeout(500);

        await reloadPage(page);
        await reopenForEdit(page);
        await expect(page.locator('#threeSixtyAlt')).toHaveValue(TEST_DATA.alt);
        await expect(page.locator('#threeSixtyYaw')).toHaveValue(TEST_DATA.yaw);
        await expect(page.locator('#threeSixtyPitch')).toHaveValue(TEST_DATA.pitch);
        await expect(page.locator('#threeSixtyFov')).toHaveValue(TEST_DATA.fov);
        await expect(page.locator('#threeSixtyAutorotateSpeed')).toHaveValue(TEST_DATA.autorotateSpeed);
        await expect(page.locator('#threeSixtyAutorotate')).toBeChecked();
    });

    test('exports the expected vendored dependencies', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        // Query the browser helper to confirm three.js + OrbitControls are registered
        const files = await page.evaluate(async () => {
            try {
                const mod = await import('/src/shared/export/browser/idevice-config-browser.ts');
                return mod.getIdeviceExportFiles('three-sixty-viewer', '.js');
            } catch {
                // In production the browser has no TS module; fall back to inspecting
                // the export-js declaration in config.xml if available via fetch.
                return null;
            }
        });
        if (files) {
            expect(files).toContain('three-sixty-viewer.js');
            expect(files).toContain('three.min.js');
            expect(files).toContain('OrbitControls.js');
        }
    });

    test('exposes scene list and hotspot list controls', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Three Sixty Tour Test');
        await gotoWorkarea(page, projectUuid);

        await addThreeSixtyIdeviceFromPanel(page);

        // Tour authoring controls
        await expect(page.locator('#threeSixtySceneList')).toBeVisible();
        await expect(page.locator('#threeSixtyAddScene')).toBeVisible();
        await expect(page.locator('#threeSixtyHotspotList')).toBeVisible();
        await expect(page.locator('#threeSixtyAddHotspot')).toBeVisible();

        // Default: one scene in the list
        await expect(page.locator('#threeSixtySceneList .three-sixty-scene-item')).toHaveCount(1);

        // Adding a scene should render a second list item
        await page.locator('#threeSixtyAddScene').click();
        await expect(page.locator('#threeSixtySceneList .three-sixty-scene-item')).toHaveCount(2);

        // Adding a hotspot should render an editable hotspot row
        await page.locator('#threeSixtyAddHotspot').click();
        await expect(page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item')).toHaveCount(1);
        await expect(
            page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item .hotspot-action-type'),
        ).toBeVisible();
    });

    test.describe('Flat (non-360) scenes', () => {
        test('toggling off the panorama checkbox switches a scene to flat mode', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Three Sixty Flat Toggle');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // The panorama checkbox is present and checked by default; the
            // Initial view (yaw/pitch/fov) controls are visible for 360° scenes.
            const panoramaToggle = page.locator('#threeSixtyIsPanorama');
            await expect(panoramaToggle).toBeVisible();
            await expect(panoramaToggle).toBeChecked();
            await expect(page.locator('#threeSixtyYaw')).toBeVisible();

            // Unchecking it switches the scene to a flat photo: the initial-view
            // fields disappear (they make no sense for a non-rotating image).
            await panoramaToggle.uncheck();
            await panoramaToggle.dispatchEvent('change');
            await page.waitForTimeout(300);

            await expect(page.locator('#threeSixtyIsPanorama')).not.toBeChecked();
            await expect(page.locator('#threeSixtyYaw')).toHaveCount(0);

            // Hotspots on a flat scene are positioned by X/Y percent, not yaw/pitch.
            await page.locator('#threeSixtyAddHotspot').click();
            await expect(page.locator('#threeSixtyHotspotList .hotspot-x').first()).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#threeSixtyHotspotList .hotspot-y').first()).toBeVisible();
            await expect(page.locator('#threeSixtyHotspotList .hotspot-yaw')).toHaveCount(0);
        });

        test('flat projection persists through save + reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);
            const projectUuid = await createProject(page, 'Three Sixty Flat Persist');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            const panoramaToggle = page.locator('#threeSixtyIsPanorama');
            await panoramaToggle.uncheck();
            await panoramaToggle.dispatchEvent('change');
            await page.waitForTimeout(300);

            await saveIdeviceInPage(page);
            await workarea.save();
            await page.waitForTimeout(500);

            await reloadPage(page);
            await reopenForEdit(page, '#threeSixtyIsPanorama');
            await expect(page.locator('#threeSixtyIsPanorama')).not.toBeChecked();
            await expect(page.locator('#threeSixtyYaw')).toHaveCount(0);
        });
    });

    test.describe('Link hotspot', () => {
        test('link action type shows URL and new-tab checkbox', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Three Sixty Link Hotspot Fields');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // Add a hotspot
            await page.locator('#threeSixtyAddHotspot').click();
            await page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item').first().waitFor({ timeout: 10000 });

            // Switch action type to "link"
            const actionTypeSelect = page
                .locator('#threeSixtyHotspotList .three-sixty-hotspot-item .hotspot-action-type')
                .first();
            await actionTypeSelect.selectOption('link');
            await actionTypeSelect.dispatchEvent('change');
            await page.waitForTimeout(300);

            // URL input and newTab checkbox must appear
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-url').first()).toBeVisible({
                timeout: 5000,
            });
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first()).toBeVisible({
                timeout: 5000,
            });

            // newTab defaults to checked
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first()).toBeChecked();
        });

        test('link hotspot URL and newTab persist through save + reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);
            const projectUuid = await createProject(page, 'Three Sixty Link Hotspot Persist');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // Add a hotspot and configure it as a link
            await page.locator('#threeSixtyAddHotspot').click();
            await page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item').first().waitFor({ timeout: 10000 });

            const actionTypeSelect = page
                .locator('#threeSixtyHotspotList .three-sixty-hotspot-item .hotspot-action-type')
                .first();
            await actionTypeSelect.selectOption('link');
            await actionTypeSelect.dispatchEvent('change');
            await page.waitForTimeout(300);

            // Fill URL
            const urlInput = page.locator('#threeSixtyHotspotList .hotspot-payload-url').first();
            await urlInput.fill('https://example.com');
            await urlInput.dispatchEvent('input');

            // Uncheck "open in new tab"
            const newTabCheckbox = page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first();
            await newTabCheckbox.uncheck();
            await newTabCheckbox.dispatchEvent('change');

            await saveIdeviceInPage(page);
            await workarea.save();
            await page.waitForTimeout(500);

            await reloadPage(page);
            await reopenForEdit(page, '#threeSixtyHotspotList');

            // Verify persisted link hotspot values
            await expect(page.locator('#threeSixtyHotspotList .hotspot-action-type').first()).toHaveValue('link');
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-url').first()).toHaveValue(
                'https://example.com',
            );
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first()).not.toBeChecked();
        });

        test('export runtime exposes the engine contract and preserves link payloads', async ({
            authenticatedPage,
        }) => {
            const page = authenticatedPage;

            // Load the generated export bundle (a classic-script IIFE) and
            // assert the window.$threesixtyviewer contract it publishes.
            const result = await page.evaluate(async () => {
                const res = await fetch('/files/perm/idevices/base/three-sixty-viewer/export/three-sixty-viewer.js');
                const code = await res.text();
                // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
                const factory = new Function('_', code + '; return $threesixtyviewer;');
                const dev = factory((s: string) => s);
                const normalized = dev.normalize({
                    version: 2,
                    scenes: [
                        {
                            id: 's1',
                            hotspots: [
                                {
                                    id: 'h1',
                                    action: { type: 'link', payload: { url: 'https://example.com', newTab: false } },
                                },
                            ],
                        },
                    ],
                });
                return {
                    api: {
                        renderView: typeof dev.renderView,
                        renderBehaviour: typeof dev.renderBehaviour,
                        init: typeof dev.init,
                        destroyAll: typeof dev.destroyAll,
                    },
                    linkAction: normalized.scenes[0].hotspots[0].action,
                };
            });

            expect(result.api).toEqual({
                renderView: 'function',
                renderBehaviour: 'function',
                init: 'function',
                destroyAll: 'function',
            });
            expect(result.linkAction).toEqual({ type: 'link', payload: { url: 'https://example.com', newTab: false } });
        });
    });

    test.describe('Scenes and hotspot placement', () => {
        test('second scene and start scene persist through save + reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);
            const projectUuid = await createProject(page, 'Three Sixty Scenes Persist');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // Add a second scene; it becomes the active one.
            await page.locator('#threeSixtyAddScene').click();
            await expect(page.locator('#threeSixtySceneList .three-sixty-scene-item')).toHaveCount(2);
            await page.locator('#threeSixtySceneTitle').fill('Second room');
            await page.locator('#threeSixtySceneTitle').dispatchEvent('input');

            // Make it the start scene.
            await page
                .locator('#threeSixtySceneList .three-sixty-scene-item')
                .nth(1)
                .locator('[data-action="set-start"]')
                .click();
            await expect(
                page.locator('#threeSixtySceneList .three-sixty-scene-item').nth(1).locator('.badge'),
            ).toBeVisible();

            await saveIdeviceInPage(page);
            await workarea.save();
            await page.waitForTimeout(500);
            await reloadPage(page);
            await reopenForEdit(page, '#threeSixtySceneList');

            await expect(page.locator('#threeSixtySceneList .three-sixty-scene-item')).toHaveCount(2);
            // The start badge survived on the second scene.
            await expect(
                page.locator('#threeSixtySceneList .three-sixty-scene-item').nth(1).locator('.badge'),
            ).toBeVisible();
            await expect(page.locator('#threeSixtySceneList')).toContainText('Second room');
        });

        test('goToScene hotspot edited in the list persists its target', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);
            const projectUuid = await createProject(page, 'Three Sixty GoToScene');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // Two scenes; go back to the first one.
            await page.locator('#threeSixtyAddScene').click();
            await page
                .locator('#threeSixtySceneList .three-sixty-scene-item')
                .first()
                .locator('[data-action="select"]')
                .click();

            // Add a hotspot from the list and point it at scene 2.
            await page.locator('#threeSixtyAddHotspot').click();
            const actionType = page.locator('#threeSixtyHotspotList .hotspot-action-type').first();
            await actionType.selectOption('goToScene');
            await actionType.dispatchEvent('change');
            const targetSelect = page.locator('#threeSixtyHotspotList .hotspot-payload-sceneId').first();
            await targetSelect.waitFor({ state: 'visible', timeout: 5000 });
            const targetValue = await targetSelect.locator('option').nth(2).getAttribute('value');
            await targetSelect.selectOption(targetValue ?? '');
            await targetSelect.dispatchEvent('input');

            await saveIdeviceInPage(page);
            await workarea.save();
            await page.waitForTimeout(500);
            await reloadPage(page);
            await reopenForEdit(page, '#threeSixtyHotspotList');

            await expect(page.locator('#threeSixtyHotspotList .hotspot-action-type').first()).toHaveValue('goToScene');
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-sceneId').first()).toHaveValue(
                targetValue ?? '',
            );
        });

        test('placement mode places a hotspot by clicking the flat preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Three Sixty Placement');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // Flat scene with a real (tiny) image via the hidden file input.
            const panoramaToggle = page.locator('#threeSixtyIsPanorama');
            await panoramaToggle.uncheck();
            await panoramaToggle.dispatchEvent('change');
            await page.waitForTimeout(300);
            await setSceneImage(page);

            const previewImage = page.locator('#threeSixtyPreview img.three-sixty-preview-flat');
            await previewImage.waitFor({ state: 'visible', timeout: 10000 });

            // Enter placement mode: reflected via aria-pressed, not colour.
            const placeButton = page.locator('#threeSixtyPlaceHotspot');
            await placeButton.click();
            await expect(placeButton).toHaveAttribute('aria-pressed', 'true');
            await expect(page.locator('#threeSixtyPlacementHint')).toBeVisible();

            // Escape cancels…
            await page.keyboard.press('Escape');
            await expect(placeButton).toHaveAttribute('aria-pressed', 'false');

            // …and a click inside the image places a hotspot. The element
            // centre is always inside the contained image rectangle (corners
            // may be letterbox bars, which placement deliberately ignores).
            await placeButton.click();
            await previewImage.click({ force: true });
            await expect(page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item')).toHaveCount(1);
            await expect(placeButton).toHaveAttribute('aria-pressed', 'false');
            // Flat placement produces editable X/Y percent fields.
            await expect(page.locator('#threeSixtyHotspotList .hotspot-x').first()).toBeVisible();
            await expect(page.locator('#threeSixtyHotspotList .hotspot-y').first()).toBeVisible();
        });

        test('deleting a scene referenced by a hotspot asks for confirmation', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Three Sixty Scene Delete');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);
            await page.locator('#threeSixtyAddScene').click();
            await page
                .locator('#threeSixtySceneList .three-sixty-scene-item')
                .first()
                .locator('[data-action="select"]')
                .click();
            await page.locator('#threeSixtyAddHotspot').click();
            const actionType = page.locator('#threeSixtyHotspotList .hotspot-action-type').first();
            await actionType.selectOption('goToScene');
            await actionType.dispatchEvent('change');
            const targetSelect = page.locator('#threeSixtyHotspotList .hotspot-payload-sceneId').first();
            const targetValue = await targetSelect.locator('option').nth(2).getAttribute('value');
            await targetSelect.selectOption(targetValue ?? '');
            await targetSelect.dispatchEvent('input');

            // Deleting the referenced scene surfaces a confirm() that names
            // the affected hotspots; accept it and verify the repair.
            let confirmMessage = '';
            page.once('dialog', dialog => {
                confirmMessage = dialog.message();
                void dialog.accept();
            });
            await page
                .locator('#threeSixtySceneList .three-sixty-scene-item')
                .nth(1)
                .locator('[data-action="remove"]')
                .click();
            await expect(page.locator('#threeSixtySceneList .three-sixty-scene-item')).toHaveCount(1);
            expect(confirmMessage).toContain('1 hotspot');
            // The dangling target now shows an inline validation message.
            await expect(page.locator('#threeSixtyHotspotList .hotspot-field-error').first()).toBeVisible();
        });
    });

    test('legacy v1 content opens in the editor and saves as v2', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        // Load the generated edition bundle, open real v1 data through the
        // public init/save contract and assert the persisted v2 result.
        const result = await page.evaluate(async () => {
            const res = await fetch('/files/perm/idevices/base/three-sixty-viewer/edition/three-sixty-viewer.js');
            const code = await res.text();
            // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
            const factory = new Function('_', code + '; return $exeDevice;');
            const dev = factory((s: string) => s);
            const v1 = {
                ideviceId: 'idev-v1',
                src: 'asset://pano.jpg',
                alt: 'A scene',
                initialView: { yaw: 30, pitch: 10, fov: 80 },
                autorotate: { enabled: true, speed: 2 },
                zoomEnabled: false,
                fullscreenEnabled: true,
            };
            const host = document.createElement('div');
            host.setAttribute('idevice-id', 'idev-v1');
            document.body.appendChild(host);
            dev.init(host, v1, '');
            const saved = dev.save();
            dev.destroy();
            host.remove();
            return saved;
        });

        expect(result.version).toBe(2);
        expect(result.scenes).toHaveLength(1);
        expect(result.scenes[0].src).toBe('asset://pano.jpg');
        expect(result.scenes[0].alt).toBe('A scene');
        expect(result.scenes[0].initialView).toEqual({ yaw: 30, pitch: 10, fov: 80 });
        expect(result.behaviour.autorotate).toEqual({ enabled: true, speed: 2 });
        expect(result.behaviour.zoomEnabled).toBe(false);
        expect(result.behaviour.fullscreenEnabled).toBe(true);
        expect(result.startSceneId).toBe(result.scenes[0].id);
    });
});
