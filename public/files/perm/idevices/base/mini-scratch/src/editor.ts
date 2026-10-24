/** Teacher forms; activity authors never edit source or test code. SPDX-License-Identifier: AGPL-3.0-or-later */
import { Blockly, gui as _, blockLabels, inject, snapshot, toolbox, button, node, Player } from './editor-host';
import { defaults, TYPES, validateConfig, type Action, type Config } from './model';
let nextEditorId = 0;
export class Editor {
    private formId = `miniScratchForm${++nextEditorId}`;
    private panels: HTMLElement[] = [];
    private tabs: HTMLAnchorElement[] = [];
    private previewStatus!: HTMLElement;
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
    private section(parent: HTMLElement, title: string): HTMLFieldSetElement {
        const fieldset = node('fieldset', parent);
        fieldset.className = 'ms-section';
        node('legend', fieldset, title);
        return fieldset;
    }
    private control(parent: HTMLElement, key: string, title: string, checkbox = false): HTMLElement {
        const wrapper = node('div', parent);
        wrapper.className = checkbox ? 'ms-field ms-check form-check' : 'ms-field exe-field';
        const label = node('label', wrapper, title);
        label.className = checkbox ? 'form-check-label' : 'form-label';
        label.htmlFor = `${this.formId}-${key}`;
        return wrapper;
    }
    private field(
        parent: HTMLElement,
        key: string,
        title: string,
        type = 'text',
        value: unknown = this.config[key as keyof Config],
    ): HTMLInputElement | HTMLTextAreaElement {
        const wrapper = this.control(parent, key, title, type === 'checkbox');
        const input = type === 'textarea' ? node('textarea', wrapper) : node('input', wrapper);
        input.id = `${this.formId}-${key}`;
        input.className = type === 'checkbox' ? 'form-check-input' : 'form-control';
        if (input instanceof HTMLInputElement) input.type = type;
        if (type === 'checkbox') {
            (input as HTMLInputElement).checked = value === true;
            wrapper.prepend(input);
        } else input.value = String(value ?? '');
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
        const wrapper = this.control(parent, key, title);
        const input = node('select', wrapper);
        input.id = `${this.formId}-${key}`;
        input.className = 'form-select';
        options.forEach(([id, text]) => {
            const option = node('option', input, text);
            option.value = id;
        });
        input.value = value;
        input.dataset.field = key;
        this.fields.set(key, input);
        return input;
    }
    /** Reuse native iDevice tabs; add keyboard navigation and Blockly layout refresh. */
    private initTabs(form: HTMLElement): void {
        globalThis.$exeDevicesEdition.iDevice.tabs.init(form.id);
        const list = form.querySelector<HTMLElement>('.exe-form-tabs')!;
        list.setAttribute('role', 'tablist');
        list.setAttribute('aria-label', _('Mini Scratch settings'));
        this.tabs = Array.from(list.querySelectorAll('a'));
        this.tabs.forEach((tab, index) => {
            tab.id = `${this.formId}-tab-${index}`;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', this.panels[index].id);
            tab.parentElement!.setAttribute('role', 'presentation');
            const panel = this.panels[index];
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', tab.id);
            panel.tabIndex = 0;
            tab.addEventListener('click', () => this.selectTab(index), { signal: this.lifetime.signal });
            tab.addEventListener(
                'keydown',
                (event) => {
                    const direction = getComputedStyle(list).direction === 'rtl' ? -1 : 1;
                    let target: number;
                    if (event.key === 'ArrowRight') target = (index + direction + this.tabs.length) % this.tabs.length;
                    else if (event.key === 'ArrowLeft')
                        target = (index - direction + this.tabs.length) % this.tabs.length;
                    else if (event.key === 'Home') target = 0;
                    else if (event.key === 'End') target = this.tabs.length - 1;
                    else if (event.key === ' ') target = index;
                    else return;
                    event.preventDefault();
                    this.tabs[target].click();
                    this.tabs[target].focus();
                },
                { signal: this.lifetime.signal },
            );
        });
        this.selectTab(0);
    }
    private selectTab(index: number): void {
        this.tabs.forEach((tab, i) => {
            tab.setAttribute('aria-selected', String(i === index));
            tab.tabIndex = i === index ? 0 : -1;
            this.panels[i].hidden = i !== index;
        });
        if (index === 1) Blockly.svgResize(this.workspace);
        if (index === 3) this.renderPreview();
        else this.closePreview();
    }
    private closePreview(): void {
        this.preview?.dispose();
        this.preview = undefined;
        this.previewRoot.replaceChildren();
        this.previewRoot.classList.remove('ms-activity');
    }
    private renderPreview(): void {
        try {
            const data = this.save();
            this.preview?.dispose();
            this.preview = new Player(this.previewRoot, data, this.media, true);
            this.previewStatus.textContent = '';
        } catch (error) {
            this.closePreview();
            this.previewStatus.textContent = _((error as Error).message);
        }
    }
    private form(): void {
        this.root.classList.add('ms-author');
        this.root.replaceChildren();
        this.fields.clear();
        this.panels = [];
        const form = node('div', this.root);
        form.id = this.formId;
        for (const title of [_('Activity'), _('Programming'), _('Assessment'), _('Preview')]) {
            const panel = node('div', form);
            panel.className = 'exe-form-tab ms-panel';
            panel.title = title;
            this.panels.push(panel);
        }
        const [activityPanel, programmingPanel, assessmentPanel, previewPanel] = this.panels;
        const example = this.section(activityPanel, _('Ready-to-use examples'));
        example.classList.add('ms-examples');
        node(
            'p',
            example,
            _(
                'Start with an example, then adapt the activity to your class. Loading an example replaces the current settings and starter program.',
            ),
        ).className = 'ms-help';
        const exampleControls = node('div', example);
        exampleControls.className = 'ms-example-controls';
        const choices: [string, string][] = [
            ['destination', _('1. Reach a destination')],
            ['sequence', _('2. Follow a sequence')],
            ['calculation', _('3. Variables and calculations')],
        ];
        const template = this.select(exampleControls, 'example', _('Example'), choices, this.config.challenge);
        button(
            exampleControls,
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
        const assignment = this.section(activityPanel, _('Assignment'));
        this.field(assignment, 'title', _('Activity title'));
        this.field(assignment, 'instructions', _('Instructions'), 'textarea');
        this.field(assignment, 'objective', _('Educational objective'), 'textarea');
        const challenge = this.section(assessmentPanel, _('Challenge'));
        const kind = this.select(challenge, 'challenge', _('Challenge'), choices, this.config.challenge);
        const coordinates = node('div', challenge);
        coordinates.className = 'ms-fields ms-coordinates';
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
        const coordinateHelp = node(
            'p',
            challenge,
            _(
                'The character starts facing right. A right turn increases y. Destination scoring gives equal credit for matching x and y.',
            ),
        );
        coordinateHelp.className = 'ms-help';
        const calculation = node('div', challenge);
        calculation.className = 'ms-fields';
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
            coordinateHelp.hidden = kind.value !== 'destination';
            calculation.hidden = kind.value !== 'calculation';
            sequence.hidden = kind.value !== 'sequence';
            for (const key of ['targetX', 'targetY'])
                this.fields.get(key)!.parentElement!.hidden = kind.value !== 'destination';
        };
        kind.addEventListener('change', visibility, { signal: this.lifetime.signal });
        visibility();
        const grading = this.section(assessmentPanel, _('Scoring and attempts'));
        const gradingFields = node('div', grading);
        gradingFields.className = 'ms-fields';
        this.field(gradingFields, 'graded', _('Report grade to SCORM 1.2'), 'checkbox');
        for (const [key, label, min, max] of [
            ['weight', _('Activity weight'), 1, 100],
            ['pass', _('Passing threshold (0–100)'), 0, 100],
            ['maxAttempts', _('Maximum attempts'), 0, 100],
        ] as const) {
            const input = this.field(gradingFields, key, label, 'number') as HTMLInputElement;
            input.min = String(min);
            input.max = String(max);
        }
        node(
            'p',
            grading,
            _(
                'Use 0 for unlimited attempts. Attempts apply to the current page visit. Only a submitted program reports a grade; running a program is practice.',
            ),
        ).className = 'ms-help';
        const feedback = this.section(assessmentPanel, _('Hints and feedback'));
        this.field(feedback, 'hint', _('Optional hint'), 'textarea');
        this.field(feedback, 'success', _('Passing feedback'), 'textarea');
        this.field(feedback, 'retry', _('Retry feedback'), 'textarea');
        const blocks = this.section(programmingPanel, _('Starter program'));
        node(
            'p',
            blocks,
            _(
                'Students receive this workspace and can edit it. Remove unavailable blocks from the starter before saving. Variable names use letters, digits and underscores and start with a letter.',
            ),
        );
        const picker = node('details', blocks);
        picker.className = 'ms-block-picker';
        node('summary', picker, _('Available blocks'));
        const options = node('div', picker);
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
        const preview = this.section(previewPanel, _('Student preview'));
        node(
            'p',
            preview,
            _('Try the activity as a student. This preview does not send grades or use learner attempts.'),
        ).className = 'ms-help';
        const previewControls = node('div', preview);
        previewControls.className = 'ms-preview-controls';
        this.previewStatus = node('p', preview);
        this.previewStatus.setAttribute('role', 'status');
        button(previewControls, _('Preview activity'), () => this.renderPreview(), this.lifetime.signal);
        button(previewControls, _('Close preview'), () => this.closePreview(), this.lifetime.signal);
        this.previewRoot = node('div', preview);
        node(
            'p',
            assessmentPanel,
            _(
                'Assessment is performed in the browser. Rules are inspectable. Scores are sent to the LMS; student programs are not uploaded. Attempts and blocks are not protected against tampering.',
            ),
        ).className = 'ms-help ms-assessment-note';
        for (const control of form.querySelectorAll('button')) control.classList.add('btn', 'btn-secondary');
        this.initTabs(form);
    }
    private allowed(): Config['allowed'] {
        return TYPES.filter((type) => (this.fields.get(`block-${type}`) as HTMLInputElement).checked);
    }
    private addAction(action: Action): void {
        const row = node('div', this.sequence);
        row.className = 'ms-sequence-row';
        const label = node('label', row, _('Action'));
        label.className = 'ms-action-field';
        const type = node('select', label);
        type.className = 'form-select';
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
        valueBox.className = 'ms-action-values';
        const setValue = (value: string) => {
            valueBox.replaceChildren();
            const field = (name: string, inputType: string, v: string) => {
                const l = node('label', valueBox, name);
                const el = node('input', l);
                el.className = 'form-control';
                el.type = inputType;
                el.value = v;
                el.step = 'any';
                return el;
            };
            if (type.value === 'turn' || type.value === 'visible') {
                const l = node('label', valueBox, _('Expected action'));
                const select = node('select', l);
                select.className = 'form-select';
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
        for (const control of row.querySelectorAll('button')) control.classList.add('btn', 'btn-secondary');
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
