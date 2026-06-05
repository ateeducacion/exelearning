/**
 * ServerLatexPreRenderer Unit Tests
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { ServerLatexPreRenderer, cleanLatexFromHtml } from './ServerLatexPreRenderer';

describe('ServerLatexPreRenderer', () => {
    let renderer: ServerLatexPreRenderer;

    beforeAll(() => {
        renderer = new ServerLatexPreRenderer();
    });

    describe('hasLatex', () => {
        it('should detect inline LaTeX with \\( \\)', () => {
            expect(renderer.hasLatex('Hello \\(x^2\\) world')).toBe(true);
        });

        it('should detect display LaTeX with \\[ \\]', () => {
            expect(renderer.hasLatex('Hello \\[x^2\\] world')).toBe(true);
        });

        it('should detect display LaTeX with $$', () => {
            expect(renderer.hasLatex('Hello $$x^2$$ world')).toBe(true);
        });

        it('should detect \\begin{equation}', () => {
            expect(renderer.hasLatex('Hello \\begin{equation}x^2\\end{equation} world')).toBe(true);
        });

        it('should detect \\ref{...}', () => {
            expect(renderer.hasLatex('See equation \\ref{eq1}')).toBe(true);
        });

        it('should detect \\eqref{...}', () => {
            expect(renderer.hasLatex('See equation \\eqref{eq1}')).toBe(true);
        });

        it('should return false for plain text', () => {
            expect(renderer.hasLatex('Hello world')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(renderer.hasLatex('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(renderer.hasLatex(null as unknown as string)).toBe(false);
            expect(renderer.hasLatex(undefined as unknown as string)).toBe(false);
        });
    });

    describe('preRender', () => {
        it('should pre-render inline LaTeX to SVG', async () => {
            const html = '<p>The formula \\(x^2\\) is simple.</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).toContain('<svg');
            expect(result.html).toContain('data-latex');
        });

        it('should pre-render display LaTeX to SVG', async () => {
            const html = '<p>The formula: \\[x^2 + y^2 = z^2\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).toContain('data-display="block"');
            expect(result.html).toContain('<svg');
        });

        it('should pre-render multiple LaTeX expressions', async () => {
            const html = '<p>Given \\(a\\) and \\(b\\), we have \\[a + b = c\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(3);
        });

        it('should handle LaTeX with HTML entities', async () => {
            const html = '<p>Formula: \\(a &lt; b\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should handle LaTeX spanning <br> tags', async () => {
            const html = '<p>\\[a + b =<br>c\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should pre-render inline LaTeX inside span elements', async () => {
            const html = '<p><span style="color:#c00">\\(x^2\\)</span></p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should skip LaTeX inside <code> tags', async () => {
            const html = '<p>Example: <code>\\(x^2\\)</code></p>';
            const result = await renderer.preRender(html);

            // The LaTeX pattern is detected but should be skipped
            expect(result.html).not.toContain('exe-math-rendered');
        });

        it('should skip LaTeX inside attribute values', async () => {
            const html = '<p data-formula="\\(x^2\\)">Content</p>';
            const result = await renderer.preRender(html);

            // LaTeX in attribute should not be rendered
            expect(result.html).toContain('data-formula="\\(x^2\\)"');
        });

        it('should return unchanged HTML for text without LaTeX', async () => {
            const html = '<p>Hello world</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(false);
            expect(result.latexRendered).toBe(false);
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        it('should skip already pre-rendered content', async () => {
            // HTML with pre-rendered LaTeX but no raw LaTeX patterns
            const html = '<span class="exe-math-rendered" data-latex="x^2"><svg></svg></span>';
            const result = await renderer.preRender(html);

            // No raw LaTeX patterns detected (exe-math-rendered is already processed)
            expect(result.hasLatex).toBe(false);
            expect(result.latexRendered).toBe(false);
            expect(result.count).toBe(0);
        });

        it('should render raw LaTeX even if content already has exe-math-rendered', async () => {
            // HTML with both raw LaTeX and already-rendered content
            const html = '<p>\\(new\\) <span class="exe-math-rendered"><svg></svg></span></p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should render pending formulas in mixed table content with pre-rendered spans', async () => {
            const html = `
<table border="1" cellpadding="6" style="margin-left: auto; margin-right: auto;">
<tbody>
<tr>
<th style="width: 137px; text-align: center;"><span style="font-size: 12pt;"><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg></span></span></th>
<th style="width: 151px; text-align: center;"><span style="font-size: 12pt;">Resultado</span></th>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathrm{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathrm{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathit{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathit{ABCdef}\\)</span></td>
</tr>
</tbody>
</table>
`;

            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);
            expect(result.html).toContain('data-latex="\\(\\mathrm{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathit{ABCdef}\\)"');
        });

        it('should render all pending ABCdef formulas from provided mixed pre-rendered table', async () => {
            const html = `
<table border="1" cellpadding="6" style="margin-left: auto; margin-right: auto;">
<tbody>
<tr>
<th style="width: 304px; text-align: center;" colspan="2"><span style="font-size: 12pt;">Tipografías matemáticas</span></th>
</tr>
<tr>
<th style="width: 137px; text-align: center;"><span style="font-size: 12pt;"><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg><math></math></span></span></th>
<th style="width: 151px; text-align: center;"><span style="font-size: 12pt;">Resultado</span></th>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathrm{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathrm{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathit{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathit{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathbb{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathbb{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathcal{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathcal{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="color: #0000ff; font-size: 12pt;">&nbsp;\\mathfrak{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathfrak{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathscr{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathscr{ABCdef}\\)</span></td>
</tr>
</tbody>
</table>`;

            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(6);
            expect(result.html).toContain('data-latex="\\(\\mathrm{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathit{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathbb{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathcal{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathfrak{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathscr{ABCdef}\\)"');
        });

        it('should handle fractions', async () => {
            const html = '<p>\\(\\frac{1}{2}\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle square roots', async () => {
            const html = '<p>\\(\\sqrt{x}\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle Greek letters', async () => {
            const html = '<p>\\(\\alpha + \\beta = \\gamma\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle sums and integrals', async () => {
            const html = '<p>\\[\\sum_{i=1}^n x_i\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle matrices', async () => {
            const html = '<p>\\[\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });
    });

    describe('cleanLatexFromHtml', () => {
        it('should strip nested/obfuscated tags without leaving a reassembled tag', () => {
            // A naive single pass on this payload removes the inner tag and splices
            // the halves into a NEW "<script>" tag. The fixed-point loop must keep
            // stripping until no "<tag>" remains.
            const clean = cleanLatexFromHtml('<scr<script>ipt>alert(1)</scr<script>ipt>');
            expect(clean.toLowerCase()).not.toContain('<script');
            // No opening tag "<...>" may survive anywhere in the output.
            expect(/<[^>]+>/.test(clean)).toBe(false);
            expect(clean).toContain('alert(1)');
        });

        it('should strip plain HTML tags but keep LaTeX content', () => {
            expect(cleanLatexFromHtml('<b>\\(x^2\\)</b>')).toBe('\\(x^2\\)');
        });

        it('should convert <br> tags to newlines', () => {
            expect(cleanLatexFromHtml('a<br>b<br/>c')).toBe('a\nb\nc');
        });

        it('should decode double-escaped entity text literally (no over-decoding)', () => {
            // "&amp;lt;" is the literal text "&lt;" and must stay "&lt;",
            // not be over-decoded into "<".
            expect(cleanLatexFromHtml('&amp;lt;')).toBe('&lt;');
            expect(cleanLatexFromHtml('&amp;amp;')).toBe('&amp;');
        });

        it('should still decode genuine entities', () => {
            expect(cleanLatexFromHtml('&lt;')).toBe('<');
            expect(cleanLatexFromHtml('&gt;')).toBe('>');
            expect(cleanLatexFromHtml('&amp;')).toBe('&');
            expect(cleanLatexFromHtml('&quot;')).toBe('"');
            expect(cleanLatexFromHtml('a&nbsp;b')).toBe('a b');
            expect(cleanLatexFromHtml('&#65;')).toBe('A');
            expect(cleanLatexFromHtml('&#x41;')).toBe('A');
        });
    });

    describe('preRenderDataGameLatex', () => {
        it('should decrypt, pre-render, and re-encrypt DataGame content', async () => {
            // Create encrypted JSON with LaTeX
            const gameData = { question: 'What is \\(x^2\\)?' };
            const jsonStr = JSON.stringify(gameData);

            // Encrypt (XOR with key 146)
            let encrypted = '';
            for (let i = 0; i < jsonStr.length; i++) {
                encrypted += String.fromCharCode(jsonStr.charCodeAt(i) ^ 146);
            }
            const escapedEncrypted = escape(encrypted);

            const html = `<div class="quext-DataGame">${escapedEncrypted}</div>`;
            const result = await renderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(1);
            // The content should be different (re-encrypted with pre-rendered LaTeX)
            expect(result.html).not.toBe(html);
        });

        it('should return unchanged HTML if no DataGame divs', async () => {
            const html = '<p>Hello world</p>';
            const result = await renderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        it('should skip DataGame without LaTeX', async () => {
            const gameData = { question: 'What is 2 + 2?' };
            const jsonStr = JSON.stringify(gameData);

            let encrypted = '';
            for (let i = 0; i < jsonStr.length; i++) {
                encrypted += String.fromCharCode(jsonStr.charCodeAt(i) ^ 146);
            }
            const escapedEncrypted = escape(encrypted);

            const html = `<div class="quext-DataGame">${escapedEncrypted}</div>`;
            const result = await renderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });
    });
});
