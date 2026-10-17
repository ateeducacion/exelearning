import { afterEach, describe, expect, it } from 'vitest';
import { makeInteraction, sequentialIds } from '../test/helpers';
import { normalizeScorm } from '../shared/schema';
import type { ScormSettings, ViewerDisplayConfig } from '../shared/types';
import {
    buildControlsMarkup,
    buildInteractionFallback,
    buildInteractionMarkup,
    buildModelMarkup,
    buildViewerMarkup,
    buildWrapperAttributes,
    computeEmptyStateDisplay,
} from './renderer';

const NO_SCORM: ScormSettings = normalizeScorm(undefined);

function config(overrides: Partial<ViewerDisplayConfig> = {}): ViewerDisplayConfig {
    return {
        src: 'asset://a.glb',
        type: 'glb',
        alt: '',
        modelColor: '#888888',
        backgroundColor: '#f5f5f5',
        cameraControls: true,
        autoRotate: false,
        autoRotateSpeed: 30,
        showNavControls: false,
        animation: { enabled: false, name: '', speed: 1 },
        ...overrides,
    };
}

afterEach(() => {
    globalThis.eXeLearning = undefined;
});

describe('buildModelMarkup', () => {
    it('emits a <model-viewer> WITHOUT a src, which the runtime sets at boot', () => {
        const markup = buildModelMarkup(config());
        expect(markup).toContain('<model-viewer ');
        expect(markup).not.toContain('src=');
        expect(markup).toContain('shadow-intensity="1"');
        expect(markup).toContain('camera-controls');
    });

    it('adds the alt text as both alt and aria-label', () => {
        const markup = buildModelMarkup(config({ alt: 'A cube' }));
        expect(markup).toContain('alt="A cube"');
        expect(markup).toContain('aria-label="A cube"');
    });

    it('adds the auto-rotation attributes only when enabled', () => {
        expect(buildModelMarkup(config({ autoRotate: true, autoRotateSpeed: 45 }))).toContain(
            'rotation-per-second="45deg"',
        );
        expect(buildModelMarkup(config())).not.toContain('auto-rotate');
    });

    it('escapes the alt text so it cannot break out of the attribute', () => {
        expect(buildModelMarkup(config({ alt: '"><script>x()</script>' }))).not.toContain('<script>');
    });
});

describe('buildWrapperAttributes', () => {
    it('emits the flat boot attributes', () => {
        const attributes = buildWrapperAttributes(config({ alt: 'Cube' }));
        expect(attributes).toContain('data-model-src="asset://a.glb"');
        expect(attributes).toContain('data-model-type="glb"');
        expect(attributes).toContain('data-camera-controls="true"');
        expect(attributes).toContain('data-auto-rotate="false"');
        expect(attributes).toContain('data-alt="Cube"');
    });

    it('adds the asset reference the exporter must not rewrite', () => {
        expect(buildWrapperAttributes(config(), 'uuid.glb')).toContain('data-model-asset-ref="uuid.glb"');
        expect(buildWrapperAttributes(config())).not.toContain('data-model-asset-ref');
    });

    it('omits the source and the type when there is no model yet', () => {
        const attributes = buildWrapperAttributes(config({ src: '', type: '' }));
        expect(attributes).not.toContain('data-model-src');
        expect(attributes).not.toContain('data-model-type');
    });

    it('names the animation only when there is one', () => {
        expect(buildWrapperAttributes(config({ animation: { enabled: true, name: 'Spin', speed: 2 } }))).toContain(
            'data-animation-name="Spin"',
        );
        expect(buildWrapperAttributes(config())).not.toContain('data-animation-name');
    });
});

describe('buildControlsMarkup', () => {
    it('is empty unless the author enabled the nav controls', () => {
        expect(buildControlsMarkup(config())).toBe('');
    });

    it('emits the fullscreen button and a labelled 4-direction pad', () => {
        const markup = buildControlsMarkup(config({ showNavControls: true }));
        expect(markup).toContain('data-fullscreen');
        for (const direction of ['left', 'right', 'up', 'down']) {
            expect(markup).toContain(`data-nav="${direction}"`);
        }
        expect(markup).toContain('role="group"');
        expect(markup).toContain('aria-label="Fullscreen"');
    });
});

describe('buildInteractionMarkup', () => {
    it('emits nothing when interactions are disabled', () => {
        expect(buildInteractionMarkup(makeInteraction({ enabled: false }, sequentialIds()), NO_SCORM)).toBe('');
    });

    it('embeds an escaped JSON data block plus the accessible fallback list', () => {
        const interaction = makeInteraction(
            { enabled: true, markers: [{ id: 'm1', label: 'Summit' }] },
            sequentialIds(),
        );
        const markup = buildInteractionMarkup(interaction, NO_SCORM);
        expect(markup).toContain('class="tdv-interaction-data"');
        expect(markup).toContain('class="tdv-fallback"');
        expect(markup).toContain('Summit');
    });

    it('escapes `<` so a payload cannot terminate the script element', () => {
        const interaction = makeInteraction(
            {
                enabled: true,
                markers: [{ id: 'm1', action: { type: 'information', payload: { html: '</script><img src=x>' } } }],
            },
            sequentialIds(),
        );
        const markup = buildInteractionMarkup(interaction, NO_SCORM);
        const json = markup.substring(markup.indexOf('>') + 1, markup.indexOf('</script>'));
        expect(json).not.toContain('</script>');
        expect(JSON.parse(json)).toBeTruthy();
    });

    it('keeps asset:// media in the block for the export rewriter, and never blob:', () => {
        const interaction = makeInteraction(
            {
                enabled: true,
                markers: [
                    { id: 'm1', action: { type: 'image', payload: { src: 'asset://pic.png' } } },
                    { id: 'm2', action: { type: 'image', payload: { src: 'blob:http://x/1' } } },
                ],
            },
            sequentialIds(),
        );
        const markup = buildInteractionMarkup(interaction, NO_SCORM);
        expect(markup).toContain('asset://pic.png');
        expect(markup).not.toContain('blob:');
    });

    it('bakes the runtime i18n map and the SCORM configuration into the block', () => {
        const interaction = makeInteraction({ enabled: true, markers: [{ id: 'm1' }] }, sequentialIds());
        const markup = buildInteractionMarkup(interaction, normalizeScorm({ mode: 2, weighted: 70 }));
        const json = JSON.parse(markup.substring(markup.indexOf('>') + 1, markup.indexOf('</script>'))) as {
            i18n: Record<string, string>;
            scorm: ScormSettings;
        };
        expect(json.i18n.Check).toBe('Check');
        expect(json.scorm).toEqual({ mode: 2, weighted: 70, saveButtonText: '' });
    });

    it('renders the guided controls only in guided mode', () => {
        const guided = makeInteraction({ enabled: true, guidedMode: true, markers: [{ id: 'm1' }] }, sequentialIds());
        expect(buildInteractionMarkup(guided, NO_SCORM)).toContain('tdv-guided-nav');
        const plain = makeInteraction({ enabled: true, markers: [{ id: 'm1' }] }, sequentialIds());
        expect(buildInteractionMarkup(plain, NO_SCORM)).not.toContain('tdv-guided-nav');
    });
});

describe('buildInteractionFallback', () => {
    it('lists every marker with escaped content', () => {
        const interaction = makeInteraction(
            {
                enabled: true,
                markers: [
                    {
                        id: 'm1',
                        label: 'Summit',
                        description: 'The top',
                        action: { type: 'information', payload: { html: '<p>Highest <b>point</b></p>' } },
                    },
                    { id: 'm2', action: { type: 'image', payload: { alt: 'Alt', caption: 'Cap' } } },
                    { id: 'm3', action: { type: 'link', payload: { url: 'https://example.org' } } },
                    {
                        id: 'm4',
                        action: {
                            type: 'question',
                            payload: { prompt: 'Q?', options: [{ text: 'A' }, { text: 'B' }] },
                        },
                    },
                ],
            },
            sequentialIds(),
        );
        const html = buildInteractionFallback(interaction);
        expect(html).toContain('1. Summit');
        expect(html).toContain('The top');
        expect(html).toContain('Highest point');
        expect(html).toContain('Alt');
        expect(html).toContain('Cap');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain('Q?');
        expect(html).toContain('<li>A</li>');
        expect(html).toContain('hidden');
    });

    it('never emits an executable link', () => {
        const interaction = makeInteraction(
            { enabled: true, markers: [{ id: 'm1', action: { type: 'link', payload: { url: 'javascript:x()' } } }] },
            sequentialIds(),
        );
        expect(buildInteractionFallback(interaction)).not.toContain('javascript:');
    });

    it('escapes marker text rather than embedding it as markup', () => {
        const interaction = makeInteraction(
            { enabled: true, markers: [{ id: 'm1', label: '<img src=x onerror=alert(1)>' }] },
            sequentialIds(),
        );
        const html = buildInteractionFallback(interaction);
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });
});

describe('buildViewerMarkup', () => {
    it('assembles the wrapper with the live region, the empty state and the model', () => {
        const markup = buildViewerMarkup({
            viewerId: 'idev-1',
            config: config(),
            interaction: makeInteraction({}, sequentialIds()),
            scorm: NO_SCORM,
        });
        expect(markup).toContain('class="three-d-viewer-wrapper"');
        expect(markup).toContain('id="idev-1"');
        expect(markup).toContain('data-live aria-live="polite"');
        expect(markup).toContain('data-empty');
        expect(markup).toContain('<model-viewer');
    });
});

describe('computeEmptyStateDisplay', () => {
    it('hides the overlay for every kind of configured source', () => {
        for (const src of ['asset://a.glb', 'content/resources/a.glb', 'blob:http://x/1', 'https://x/a.glb']) {
            expect(computeEmptyStateDisplay(src, '')).toBe('none');
        }
    });

    it('hides the overlay once model-viewer resolved a source', () => {
        expect(computeEmptyStateDisplay('', 'blob:http://x/1')).toBe('none');
    });

    it('shows the overlay when nothing is configured', () => {
        expect(computeEmptyStateDisplay('', '')).toBe('grid');
        expect(computeEmptyStateDisplay('   ', '  ')).toBe('grid');
    });
});
