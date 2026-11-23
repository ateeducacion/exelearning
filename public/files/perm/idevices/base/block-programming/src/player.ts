/** Learner UI and shared SCORM 1.2 adapter. SPDX-License-Identifier: AGPL-3.0-or-later */
import { Blockly, content as c_, inject, snapshot } from './blocks';
import { assess, execute, initialState, validateConfig, type Config, type State } from './model';
export function node<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    parent?: HTMLElement,
    text?: string,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    parent?.append(element);
    return element;
}
export function button(
    parent: HTMLElement,
    label: string,
    handler: () => void,
    signal?: AbortSignal,
): HTMLButtonElement {
    const b = node('button', parent, label);
    b.type = 'button';
    b.addEventListener('click', handler, { signal });
    return b;
}
export function escapeAttribute(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
}
export function renderView(data: unknown): string {
    let c: Config;
    try {
        c = validateConfig(data);
    } catch {
        return `<p class="ms-error">${escapeAttribute(c_('This Block Programming activity contains invalid data.'))}</p>`;
    }
    return `<section class="ms-activity" data-block-programming="${escapeAttribute(encodeURIComponent(JSON.stringify(c)))}"><h3>${escapeAttribute(c.title)}</h3><p>${escapeAttribute(c.instructions)}</p></section>`;
}
/** Cancelled sleeps settle immediately, including when a player leaves the DOM. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            reject(new DOMException('Stopped', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
        }, ms);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
    });
}
export class Player {
    readonly workspace: import('blockly/core').WorkspaceSvg;
    readonly config: Config;
    private lifetime = new AbortController();
    private execution?: AbortController;
    private observer: ResizeObserver;
    private disposed = false;
    private busy = false;
    private attempts = 0;
    private lastSubmission = '';
    private feedback: HTMLElement;
    private score: HTMLElement;
    private readout: HTMLElement;
    private sprite: SVGElement;
    private runButton: HTMLButtonElement;
    private submitButton: HTMLButtonElement;
    private resetButton: HTMLButtonElement;
    private scorm: any;
    private game: any;
    constructor(
        readonly root: HTMLElement,
        raw: unknown,
        media: string,
        preview = false,
    ) {
        this.config = validateConfig(raw);
        const c = this.config;
        root.classList.add('ms-activity');
        root.replaceChildren();
        root.id ||= `ms-${crypto.randomUUID()}`;
        node('h3', root, c.title);
        node('p', root, c.instructions);
        node('p', root, c.objective);
        const goals = node('ul', root);
        this.criteriaLabels().forEach((label) => node('li', goals, label));
        node(
            'p',
            root,
            c_('The character starts facing right. Coordinates range from −10 to 10. Right turns increase y.'),
        );
        const help = node(
            'p',
            root,
            c_(
                'Keyboard: Tab to the workspace; T opens the toolbox; arrows navigate; Enter edits or inserts; M moves a block; Delete removes it; Escape closes a menu.',
            ),
        );
        help.className = 'ms-keyboard-help';
        const layout = node('div', root);
        layout.className = 'ms-layout';
        const canvas = node('div', layout);
        canvas.className = 'ms-workspace';
        canvas.setAttribute('aria-label', c_('Programming workspace'));
        const stage = node('div', layout);
        stage.className = 'ms-stage';
        stage.innerHTML =
            '<svg viewBox="-11 -11 22 22" aria-hidden="true"><path d="M-10 0H10M0-10V10" stroke="#64748b" stroke-width=".08"/><circle class="ms-target" r=".55" fill="none" stroke="#92400e" stroke-width=".18"/><path class="ms-sprite" d="M-.5-.4L.6 0-.5.4Z" fill="#175b94"/></svg>';
        const target = stage.querySelector('.ms-target')!;
        target.setAttribute('cx', String(c.targetX));
        target.setAttribute('cy', String(c.targetY));
        target.setAttribute('display', c.challenge === 'destination' ? '' : 'none');
        this.sprite = stage.querySelector('.ms-sprite')!;
        this.readout = node('output', stage);
        this.readout.setAttribute('aria-label', c_('Stage and variable values'));
        this.readout.setAttribute('aria-live', 'off');
        if (c.maxAttempts) node('p', root, c_('The attempt limit applies to this page visit.'));
        const controls = node('div', root);
        controls.className = 'ms-controls';
        const signal = this.lifetime.signal;
        this.runButton = button(
            controls,
            c_('Run'),
            () => {
                void this.run(false);
            },
            signal,
        );
        const stop = button(controls, c_('Stop'), () => this.execution?.abort(c_('Program stopped.')), signal);
        stop.setAttribute('aria-label', c_('Stop the running program'));
        this.resetButton = button(controls, c_('Reset'), () => this.reset(), signal);
        this.submitButton = button(
            controls,
            c_('Submit attempt'),
            () => {
                void this.run(true);
            },
            signal,
        );
        if (c.hint)
            button(
                controls,
                c_('Hint'),
                () => {
                    this.feedback.textContent = c.hint;
                },
                signal,
            );
        this.score = node('p', root);
        this.score.className = 'ms-score';
        this.score.setAttribute('role', 'status');
        this.feedback = node('div', root);
        this.feedback.className = 'ms-feedback';
        this.feedback.setAttribute('role', 'status');
        this.feedback.setAttribute('aria-live', 'polite');
        this.workspace = inject(canvas, c, media);
        this.observer = new ResizeObserver(() => Blockly.svgResize(this.workspace));
        this.observer.observe(canvas);
        if (!preview) this.register();
        this.paint(initialState(c));
        this.restore();
        this.updateControls();
    }
    private criteriaLabels(): string[] {
        const c = this.config;
        if (c.challenge === 'destination')
            return [`${c_('Target x')}: ${c.targetX}`, `${c_('Target y')}: ${c.targetY}`];
        if (c.challenge === 'calculation') return [`${c_('Expected variable')}: ${c.variable} = ${c.expected}`];
        const actions = {
            move: c_('Move forward'),
            turn: c_('Turn'),
            say: c_('Display a message'),
            visible: c_('Show / hide character'),
            position: c_('Go to position'),
        };
        return c.sequence
            .map((item) => `${c_('Action')}: ${actions[item.action]} ${item.value}`)
            .concat(c_('Perform exactly these observable actions, in order. Loops are allowed.'));
    }
    private register(): void {
        if (globalThis.eXeLearning) return;
        const registry = globalThis.exeScorm12?.activities;
        const shared = globalThis.$exeDevices?.iDevice?.gamification?.scorm;
        const wrapper = this.root.closest('.idevice_node');
        if (!registry || !shared || !wrapper?.id) return;
        this.scorm = shared;
        this.game = {
            ideviceId: wrapper.id,
            ideviceNumber: Array.from(document.querySelectorAll('.idevice_node')).indexOf(wrapper) + 1,
            main: this.root.id,
            isScorm: this.config.graded ? 2 : 0,
            weighted: this.config.weight,
            passScoreMode: 'custom',
            passScoreCustom: this.config.pass / 10,
            title: this.config.title,
            msgs: { msgYouScore: c_('Score'), msgScore: c_('Score'), msgWeight: c_('Weight') },
        };
        shared.reportActivity(this.game, { total: 1, legacyIndex: this.game.ideviceNumber });
    }
    private restore(): void {
        const record = this.game && globalThis.exeScorm12?.activities?.get(this.game.ideviceId);
        if (record) {
            if (record.score !== null)
                this.score.textContent = `${c_('Saved score')}: ${record.score}/100. ${c_('Rebuild your program to continue; the LMS stores scores, not blocks.')}`;
        }
    }
    private updateControls(): void {
        const locked = this.config.maxAttempts > 0 && this.attempts >= this.config.maxAttempts;
        this.runButton.disabled = this.busy;
        this.resetButton.disabled = this.busy;
        this.submitButton.disabled = this.busy || locked;
        this.submitButton.textContent = locked
            ? c_('No attempts remaining')
            : `${c_('Submit attempt')} (${this.attempts}${this.config.maxAttempts ? `/${this.config.maxAttempts}` : ''})`;
    }
    private paint(state: State): void {
        const x = Math.max(-10, Math.min(10, state.x));
        const y = Math.max(-10, Math.min(10, state.y));
        this.sprite.setAttribute('transform', `translate(${x} ${y}) rotate(${state.direction * 90})`);
        this.sprite.setAttribute('visibility', state.visible ? 'visible' : 'hidden');
        const directions = [c_('Right'), c_('Down'), c_('Left'), c_('Up')];
        this.readout.textContent = `x: ${state.x}, y: ${state.y}\n${c_('Direction')}: ${directions[state.direction]}\n${state.visible ? c_('Character visible') : c_('Character hidden')}\n${state.message}\n${Object.entries(
            state.variables,
        )
            .map(([key, v]) => `${key}: ${v}`)
            .join('\n')}`;
    }
    reset(): void {
        if (this.busy) return;
        Blockly.serialization.workspaces.load(this.config.starter, this.workspace);
        this.paint(initialState(this.config));
        this.feedback.textContent = c_('Starter program restored. Attempts are unchanged.');
    }
    async run(submit: boolean): Promise<void> {
        if (this.busy || this.disposed) return;
        this.restore();
        if (submit && this.config.maxAttempts > 0 && this.attempts >= this.config.maxAttempts) {
            this.updateControls();
            return;
        }
        let data;
        try {
            data = snapshot(this.workspace, this.config);
        } catch (error) {
            this.feedback.textContent = c_((error as Error).message);
            return;
        }
        const signature = JSON.stringify(data);
        if (submit && signature === this.lastSubmission) {
            this.feedback.textContent = c_('Change your program before submitting another attempt.');
            return;
        }
        this.busy = true;
        const abort = new AbortController();
        this.execution = abort;
        if (submit) {
            this.attempts++;
            this.lastSubmission = signature;
        }
        this.updateControls();
        this.feedback.textContent = c_('Running…');
        const deadline = setTimeout(() => abort.abort(c_('Execution time limit exceeded.')), 15000);
        let result = { score: 0, criteria: [] as boolean[] };
        try {
            const program = execute(data, this.config);
            this.paint(initialState(this.config));
            for (;;) {
                if (abort.signal.aborted)
                    throw new Error(abort.signal.reason?.message || abort.signal.reason || c_('Program stopped.'));
                const next = program.next();
                if (next.done) {
                    result = assess(next.value, this.config);
                    break;
                }
                this.paint(next.value.state);
                await pause(Math.max(next.value.delay, 5), abort.signal);
            }
            const labels = this.criteriaLabels();
            this.feedback.textContent = `${result.score >= this.config.pass ? this.config.success : this.config.retry}\n${result.criteria.map((ok, i) => `${ok ? c_('Achieved') : c_('Not yet')}: ${labels[i]}`).join('\n')}`;
        } catch (error) {
            this.feedback.textContent = abort.signal.aborted
                ? String(abort.signal.reason?.message || abort.signal.reason || c_('Program stopped.'))
                : c_((error as Error).message);
        } finally {
            clearTimeout(deadline);
            this.busy = false;
            this.execution = undefined;
            if (!this.disposed) {
                this.score.textContent = `${submit ? c_('Submitted score') : c_('Practice score')}: ${result.score}/100`;
                if (submit && this.config.graded && this.scorm) {
                    this.game.scorerp = result.score / 10;
                    // The shared registry counts answered assignments, not retries.
                    this.game.answered = 1;
                    try {
                        this.scorm.updateActivity(this.game, {}, true);
                    } catch {
                        this.attempts--;
                        this.lastSubmission = '';
                        this.feedback.textContent += `\n${c_('The LMS score could not be saved. Submit again to retry.')}`;
                    }
                }
                this.updateControls();
            }
        }
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.execution?.abort();
        this.lifetime.abort();
        this.observer.disconnect();
        this.workspace.dispose();
    }
}
