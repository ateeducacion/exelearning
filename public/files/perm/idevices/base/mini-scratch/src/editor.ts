/** Teacher forms; activity authors never edit source or test code. SPDX-License-Identifier: AGPL-3.0-or-later */
import { Blockly, gui as _, blockLabels, inject, snapshot, toolbox, button, node, Player } from './editor-host';
import { defaults, TYPES, validateConfig, type Action, type Config } from './model';
export class Editor {
    private config: Config;
    private disposed = false;
    private workspace!: import('blockly/core').WorkspaceSvg;
    private lifetime = new AbortController();
    private observer!: ResizeObserver;
    private fields = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
    private sequence!: HTMLElement;
    private preview?: import('./player').Player;
    private previewRoot!: HTMLElement;
    constructor(
        private root: HTMLElement,
        data: unknown,
        private media: string,
    ) {
        this.config = data && Object.keys(data).length ? validateConfig(data) : defaults();
        this.form();
    }
    private section(title: string): HTMLFieldSetElement {
        const fieldset = node('fieldset', this.root);
        node('legend', fieldset, title);
        return fieldset;
    }
    private field(
        parent: HTMLElement,
        key: string,
        title: string,
        type = 'text',
        value: unknown = this.config[key as keyof Config],
    ): HTMLInputElement | HTMLTextAreaElement {
        const label = node('label', parent, title);
        const input = type === 'textarea' ? node('textarea', label) : node('input', label);
        if (input instanceof HTMLInputElement) input.type = type;
        if (type === 'checkbox') (input as HTMLInputElement).checked = value === true;
        else input.value = String(value ?? '');
        input.dataset.field = key;
        this.fields.set(key, input);
        return input;
    }
    private select(
        parent: HTMLElement,
        key: string,
        title: string,
        options: [string, string][],
        value: string,
    ): HTMLSelectElement {
        const label = node('label', parent, title);
        const input = node('select', label);
        options.forEach(([id, text]) => {
            const option = node('option', input, text);
            option.value = id;
        });
        input.value = value;
        input.dataset.field = key;
        this.fields.set(key, input);
        return input;
    }
    private form(): void {
        this.root.classList.add('ms-author');
        this.root.replaceChildren();
        this.fields.clear();
        const example = this.section(_('Ready-to-use examples'));
        const choices: [string, string][] = [
            ['destination', _('1. Reach a destination')],
            ['sequence', _('2. Follow a sequence')],
            ['calculation', _('3. Variables and calculations')],
        ];
        const template = this.select(example, 'example', _('Example'), choices, this.config.challenge);
        button(
            example,
            _('Load example (replaces this form)'),
            () => {
                this.preview?.dispose();
                this.workspace.dispose();
                this.observer.disconnect();
                this.lifetime.abort();
                this.lifetime = new AbortController();
                this.config = defaults(template.value as Config['challenge']);
                this.form();
            },
            this.lifetime.signal,
        );
        const assignment = this.section(_('Assignment'));
        this.field(assignment, 'title', _('Activity title'));
        this.field(assignment, 'instructions', _('Instructions'), 'textarea');
        this.field(assignment, 'objective', _('Educational objective'), 'textarea');
        const challenge = this.section(_('Automatic assessment'));
        const kind = this.select(challenge, 'challenge', _('Challenge'), choices, this.config.challenge);
        const coordinates = node('div', challenge);
        coordinates.className = 'ms-fields';
        for (const [key, label] of [
            ['startX', _('Start x')],
            ['startY', _('Start y')],
            ['targetX', _('Target x')],
            ['targetY', _('Target y')],
        ]) {
            const input = this.field(coordinates, key, label, 'number') as HTMLInputElement;
            input.min = '-10';
            input.max = '10';
            input.step = 'any';
        }
        node(
            'p',
            challenge,
            _(
                'The character starts facing right. A right turn increases y. Destination scoring gives equal credit for matching x and y.',
            ),
        );
        const calculation = node('div', challenge);
        this.field(calculation, 'variable', _('Variable to assess'));
        this.field(calculation, 'expected', _('Expected calculated value'), 'number').setAttribute('step', 'any');
        const sequence = node('div', challenge);
        node(
            'p',
            sequence,
            _(
                'Add the observable actions in the required order. Loops and different programs are accepted when they produce the same actions. Each matching action receives equal credit. Extra actions reduce the score.',
            ),
        );
        this.sequence = node('div', sequence);
        this.config.sequence.forEach((action) => this.addAction(action));
        button(
            sequence,
            _('Add action'),
            () => {
                if (this.sequence.children.length < 30) this.addAction({ action: 'move', value: '1' });
            },
            this.lifetime.signal,
        );
        const visibility = () => {
            calculation.hidden = kind.value !== 'calculation';
            sequence.hidden = kind.value !== 'sequence';
            for (const key of ['targetX', 'targetY'])
                this.fields.get(key)!.parentElement!.hidden = kind.value !== 'destination';
        };
        kind.addEventListener('change', visibility, { signal: this.lifetime.signal });
        visibility();
        const grading = node('div', challenge);
        grading.className = 'ms-fields';
        this.field(grading, 'graded', _('Report grade to SCORM 1.2'), 'checkbox');
        for (const [key, label, min, max] of [
            ['weight', _('Activity weight'), 1, 100],
            ['pass', _('Passing threshold (0–100)'), 0, 100],
            ['maxAttempts', _('Maximum submitted attempts per page visit (0 = unlimited)'), 0, 100],
        ] as const) {
            const input = this.field(grading, key, label, 'number') as HTMLInputElement;
            input.min = String(min);
            input.max = String(max);
        }
        const feedback = this.section(_('Hints and feedback'));
        this.field(feedback, 'hint', _('Optional hint'), 'textarea');
        this.field(feedback, 'success', _('Passing feedback'), 'textarea');
        this.field(feedback, 'retry', _('Retry feedback'), 'textarea');
        const blocks = this.section(_('Available blocks and starter program'));
        node(
            'p',
            blocks,
            _(
                'Students receive this workspace and can edit it. Remove unavailable blocks from the starter before saving. Variable names use letters, digits and underscores and start with a letter.',
            ),
        );
        const options = node('div', blocks);
        options.className = 'ms-block-options';
        const labels = blockLabels();
        TYPES.forEach((type, i) => {
            const input = this.field(
                options,
                `block-${type}`,
                labels[i],
                'checkbox',
                this.config.allowed.includes(type),
            ) as HTMLInputElement;
            input.disabled = type === 'start';
            input.addEventListener(
                'change',
                () => {
                    this.workspace.updateToolbox(toolbox({ ...this.config, allowed: this.allowed() }));
                },
                { signal: this.lifetime.signal },
            );
        });
        node(
            'p',
            blocks,
            _(
                'Keyboard: focus the workspace, press T for the toolbox, use arrows, Enter to insert or edit, and M to move blocks.',
            ),
        );
        const canvas = node('div', blocks);
        canvas.className = 'ms-workspace';
        canvas.setAttribute('aria-label', _('Starter programming workspace'));
        this.workspace = inject(canvas, this.config, this.media);
        this.observer = new ResizeObserver(() => Blockly.svgResize(this.workspace));
        this.observer.observe(canvas);
        const preview = this.section(_('Student preview'));
        const status = node('p', preview);
        status.setAttribute('role', 'status');
        button(
            preview,
            _('Preview activity'),
            () => {
                try {
                    const data = this.save();
                    this.preview?.dispose();
                    this.preview = new Player(this.previewRoot, data, this.media, true);
                    status.textContent = '';
                } catch (error) {
                    status.textContent = _((error as Error).message);
                }
            },
            this.lifetime.signal,
        );
        button(
            preview,
            _('Close preview'),
            () => {
                this.preview?.dispose();
                this.previewRoot.replaceChildren();
            },
            this.lifetime.signal,
        );
        this.previewRoot = node('div', preview);
        node(
            'p',
            this.root,
            _(
                'Assessment is performed in the browser. Rules are inspectable. Scores are sent to the LMS; student programs are not uploaded. Attempts and blocks are not protected against tampering.',
            ),
        );
    }
    private allowed(): Config['allowed'] {
        return TYPES.filter((type) => (this.fields.get(`block-${type}`) as HTMLInputElement).checked);
    }
    private addAction(action: Action): void {
        const row = node('div', this.sequence);
        row.className = 'ms-sequence-row';
        const label = node('label', row, _('Action'));
        const type = node('select', label);
        const values: [string, string][] = [
            ['move', _('Move forward')],
            ['turn', _('Turn')],
            ['say', _('Display a message')],
            ['visible', _('Show / hide character')],
            ['position', _('Go to position')],
        ];
        values.forEach(([id, name]) => {
            const opt = node('option', type, name);
            opt.value = id;
        });
        type.value = action.action;
        const valueBox = node('div', row);
        const setValue = (value: string) => {
            valueBox.replaceChildren();
            const field = (name: string, inputType: string, v: string) => {
                const l = node('label', valueBox, name);
                const el = node('input', l);
                el.type = inputType;
                el.value = v;
                el.step = 'any';
                return el;
            };
            if (type.value === 'turn' || type.value === 'visible') {
                const l = node('label', valueBox, _('Expected action'));
                const select = node('select', l);
                const list =
                    type.value === 'turn'
                        ? [
                              ['right', _('Right')],
                              ['left', _('Left')],
                          ]
                        : [
                              ['true', _('Show')],
                              ['false', _('Hide')],
                          ];
                list.forEach(([id, name]) => {
                    const opt = node('option', select, name);
                    opt.value = id;
                });
                select.value = list.some(([id]) => id === value) ? value : list[0][0];
            } else if (type.value === 'position') {
                const [x = '0', y = '0'] = value.split(',');
                field(_('x'), 'number', x);
                field(_('y'), 'number', y);
            } else
                field(
                    type.value === 'move' ? _('Distance') : _('Message'),
                    type.value === 'move' ? 'number' : 'text',
                    value,
                );
        };
        setValue(action.value);
        type.addEventListener(
            'change',
            () => setValue(type.value === 'say' ? 'Hello' : type.value === 'position' ? '0,0' : '1'),
            { signal: this.lifetime.signal },
        );
        button(
            row,
            _('Move action up'),
            () => {
                if (row.previousElementSibling) this.sequence.insertBefore(row, row.previousElementSibling);
            },
            this.lifetime.signal,
        );
        button(row, _('Remove action'), () => row.remove(), this.lifetime.signal);
    }
    save(): Config {
        const data = { ...this.config, allowed: this.allowed() };
        for (const key of [
            'title',
            'instructions',
            'objective',
            'hint',
            'success',
            'retry',
            'variable',
            'challenge',
        ] as const)
            (data as any)[key] = this.fields.get(key)!.value;
        for (const key of [
            'startX',
            'startY',
            'targetX',
            'targetY',
            'expected',
            'weight',
            'pass',
            'maxAttempts',
        ] as const)
            data[key] = Number(this.fields.get(key)!.value);
        data.graded = (this.fields.get('graded') as HTMLInputElement).checked;
        data.sequence = Array.from(this.sequence.children).map((row) => {
            const action = row.querySelector('select')!.value as Action['action'];
            const fields = Array.from(row.children[1].querySelectorAll('input,select')) as (
                HTMLInputElement | HTMLSelectElement
            )[];
            return { action, value: fields.map((field) => field.value).join(',') };
        });
        data.starter = snapshot(this.workspace, data);
        return validateConfig(data);
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.preview?.dispose();
        this.lifetime.abort();
        this.observer.disconnect();
        this.workspace.dispose();
        this.root.classList.remove('ms-author');
    }
}
