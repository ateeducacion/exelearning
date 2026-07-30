import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from '../shared/ids';
import { hydrateDocument } from '../shared/schema';
import { formHtml, unsupportedVersionHtml } from './form';
import { createEditorState } from './state';

const identity = (text: string): string => text;

function makeState(input: unknown = null) {
    const result = hydrateDocument(input, createSequentialIdGenerator());
    if (result.status !== 'ok') throw new Error('fixture');
    return createEditorState(result.document, createSequentialIdGenerator());
}

describe('formHtml', () => {
    it('renders every stable control id for a panorama scene', () => {
        const html = formHtml(makeState(), identity);
        for (const id of [
            'threeSixtyStatus',
            'threeSixtySceneList',
            'threeSixtyAddScene',
            'threeSixtyActiveSceneLegend',
            'threeSixtySceneTitle',
            'threeSixtyImageButton',
            'threeSixtyImageName',
            'threeSixtyImageClear',
            'threeSixtyImageFile',
            'threeSixtyIsPanorama',
            'threeSixtyAlt',
            'threeSixtySceneDescription',
            'threeSixtyYaw',
            'threeSixtyPitch',
            'threeSixtyFov',
            'threeSixtyHotspotList',
            'threeSixtyPlaceHotspot',
            'threeSixtyAddHotspot',
            'threeSixtyPlacementHint',
            'threeSixtyAutorotate',
            'threeSixtyAutorotateSpeed',
            'threeSixtyZoom',
            'threeSixtyFullscreen',
            'threeSixtyShowLabels',
            'threeSixtyNavControls',
            'threeSixtyPreview',
            'threeSixtyPreviewMessage',
        ]) {
            expect(html).toContain(`id="${id}"`);
        }
        // Defaults surface in the markup.
        expect(html).toContain('id="threeSixtyIsPanorama" checked');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('aria-pressed="false"');
    });

    it('omits the initial-view fieldset for flat scenes', () => {
        const state = makeState({ version: 2, scenes: [{ id: 's', projection: 'flat' }] });
        const html = formHtml(state, identity);
        expect(html).not.toContain('id="threeSixtyYaw"');
        expect(html).not.toContain('id="threeSixtyPitch"');
        expect(html).not.toContain('id="threeSixtyFov"');
        expect(html).toContain('Click on the image to place a hotspot');
    });

    it('escapes scene-provided values', () => {
        const state = makeState({
            version: 2,
            scenes: [{ id: 's', title: '"><script>x</script>', alt: '<img>' }],
        });
        const html = formHtml(state, identity);
        expect(html).not.toContain('<script>x</script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

describe('unsupportedVersionHtml', () => {
    it('names the version and promises data preservation', () => {
        const html = unsupportedVersionHtml(3, identity);
        expect(html).toContain('role="alert"');
        expect(html).toContain('format version 3');
        expect(html).toContain('saving keeps it unchanged');
    });
});
