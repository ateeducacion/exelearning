import Modal from '../modal.js';

/**
 * Modal for publishing projects to Cloudflare Pages
 */
export default class ModalPublishToCloudflare extends Modal {
    constructor(manager) {
        const id = 'modalPublishToCloudflare';
        super(manager, id, undefined, false);

        this.currentStep = 1;
        this.apiToken = null;
        this.accountId = null;
        this.projects = [];
        this.selectedProject = null;

        // Elements
        this.connectBtn = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.publishBtn = null;
    }

    /**
     * Initialize modal behavior
     */
    behaviour() {
        super.behaviour();

        // Get button references
        this.connectBtn = this.modalElement.querySelector('#cloudflare-connect-btn');
        this.prevBtn = this.modalElement.querySelector('#cloudflare-prev-btn');
        this.nextBtn = this.modalElement.querySelector('#cloudflare-next-btn');
        this.publishBtn = this.modalElement.querySelector('#cloudflare-publish-btn');

        // Set up event listeners
        this.connectBtn?.addEventListener('click', () => this.connect());
        this.prevBtn?.addEventListener('click', () => this.goToStep(this.currentStep - 1));
        this.nextBtn?.addEventListener('click', () => this.goToStep(this.currentStep + 1));
        this.publishBtn?.addEventListener('click', () => this.publish());

        // Project option toggle
        const projectExisting = this.modalElement.querySelector('#cloudflare-project-existing');
        const projectNew = this.modalElement.querySelector('#cloudflare-project-new');
        projectExisting?.addEventListener('change', () => this.toggleProjectOption('existing'));
        projectNew?.addEventListener('change', () => this.toggleProjectOption('new'));
    }

    /**
     * Show the modal
     */
    show() {
        this.titleDefault = _('Publish to Cloudflare Pages');
        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.reset();
            this.modal.show();
            this.checkExistingAuth();
        }, time);
    }

    /**
     * Reset modal state
     */
    reset() {
        this.currentStep = 1;
        this.updateStepVisibility();

        // Reset authentication UI
        const authenticated = this.modalElement.querySelector('#cloudflare-authenticated');
        authenticated?.classList.add('d-none');
        this.connectBtn?.classList.remove('d-none');

        // Reset inputs
        const tokenInput = this.modalElement.querySelector('#cloudflare-token');
        const accountIdInput = this.modalElement.querySelector('#cloudflare-account-id');
        if (tokenInput) tokenInput.value = '';
        if (accountIdInput) accountIdInput.value = '';

        // Reset publish UI
        const publishing = this.modalElement.querySelector('#cloudflare-publishing');
        const result = this.modalElement.querySelector('#cloudflare-publish-result');
        publishing?.classList.add('d-none');
        result?.classList.add('d-none');
    }

    /**
     * Check if user has existing authentication
     */
    checkExistingAuth() {
        const savedToken = localStorage.getItem('cloudflare_api_token');
        const savedAccountId = localStorage.getItem('cloudflare_account_id');

        if (savedToken && savedAccountId) {
            this.apiToken = savedToken;
            this.accountId = savedAccountId;

            const tokenInput = this.modalElement.querySelector('#cloudflare-token');
            const accountIdInput = this.modalElement.querySelector('#cloudflare-account-id');
            if (tokenInput) tokenInput.value = savedToken;
            if (accountIdInput) accountIdInput.value = savedAccountId;
        }
    }

    /**
     * Connect with credentials
     */
    async connect() {
        const tokenInput = this.modalElement.querySelector('#cloudflare-token');
        const accountIdInput = this.modalElement.querySelector('#cloudflare-account-id');
        const token = tokenInput?.value?.trim();
        const accountId = accountIdInput?.value?.trim();

        if (!token) {
            this.showError(_('Please enter your Cloudflare API token'));
            return;
        }

        if (!accountId) {
            this.showError(_('Please enter your Cloudflare Account ID'));
            return;
        }

        this.apiToken = token;
        this.accountId = accountId;

        // Try to list projects to validate credentials
        const basePath = eXeLearning?.config?.basePath || '';

        try {
            const response = await fetch(`${basePath}/api/publish/cloudflare/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    api_token: this.apiToken,
                    account_id: this.accountId,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Invalid credentials');
            }

            // Credentials are valid, save them
            localStorage.setItem('cloudflare_api_token', token);
            localStorage.setItem('cloudflare_account_id', accountId);
            this.projects = data.projects;

            // Show authenticated state
            const authenticated = this.modalElement.querySelector('#cloudflare-authenticated');
            authenticated?.classList.remove('d-none');
            this.connectBtn?.classList.add('d-none');
            this.nextBtn?.classList.remove('d-none');
        } catch (error) {
            console.error('Cloudflare connect error:', error);
            this.showError(error.message || _('Invalid credentials'));
        }
    }

    /**
     * Go to a specific step
     */
    async goToStep(step) {
        if (step < 1 || step > 3) return;

        // Validate before moving forward
        if (step > this.currentStep) {
            if (this.currentStep === 1 && (!this.apiToken || !this.accountId)) {
                this.showError(_('Please connect with your Cloudflare credentials first'));
                return;
            }
            if (this.currentStep === 2) {
                const valid = this.validateProjectSelection();
                if (!valid) return;
            }
        }

        this.currentStep = step;
        this.updateStepVisibility();

        // Populate projects when entering step 2
        if (step === 2) {
            this.populateProjects();
        }

        // Update publish summary when entering step 3
        if (step === 3) {
            this.updatePublishSummary();
        }
    }

    /**
     * Update step visibility
     */
    updateStepVisibility() {
        const steps = ['auth', 'project', 'publish'];
        steps.forEach((stepName, index) => {
            const step = this.modalElement.querySelector(`#cloudflare-${stepName}-step`);
            if (step) {
                step.classList.toggle('d-none', index + 1 !== this.currentStep);
            }
        });

        // Update buttons
        this.prevBtn?.classList.toggle('d-none', this.currentStep === 1);
        this.connectBtn?.classList.toggle('d-none', this.currentStep !== 1 || (this.apiToken && this.accountId));
        this.nextBtn?.classList.toggle('d-none', this.currentStep === 3 || (this.currentStep === 1 && (!this.apiToken || !this.accountId)));
        this.publishBtn?.classList.toggle('d-none', this.currentStep !== 3);
    }

    /**
     * Populate projects dropdown
     */
    populateProjects() {
        const select = this.modalElement.querySelector('#cloudflare-project-select');

        select.innerHTML = '<option value="">' + _('Select a project') + '</option>';
        this.projects.forEach((project) => {
            const option = document.createElement('option');
            option.value = project.name;
            option.textContent = project.name;
            option.dataset.subdomain = project.subdomain;
            select.appendChild(option);
        });
    }

    /**
     * Toggle between existing and new project options
     */
    toggleProjectOption(option) {
        const existingDiv = this.modalElement.querySelector('#cloudflare-existing-project');
        const newDiv = this.modalElement.querySelector('#cloudflare-new-project');

        existingDiv?.classList.toggle('d-none', option === 'new');
        newDiv?.classList.toggle('d-none', option === 'existing');
    }

    /**
     * Validate project selection
     */
    validateProjectSelection() {
        const isNew = this.modalElement.querySelector('#cloudflare-project-new')?.checked;

        if (isNew) {
            const name = this.modalElement.querySelector('#cloudflare-project-name')?.value?.trim();
            if (!name) {
                this.showError(_('Please enter a project name'));
                return false;
            }
            // Validate project name format
            if (!/^[a-z0-9-]+$/.test(name)) {
                this.showError(_('Project name can only contain lowercase letters, numbers, and hyphens'));
                return false;
            }
            this.selectedProject = {
                isNew: true,
                name,
            };
        } else {
            const select = this.modalElement.querySelector('#cloudflare-project-select');
            const selectedOption = select?.options[select.selectedIndex];

            if (!selectedOption?.value) {
                this.showError(_('Please select a project'));
                return false;
            }

            this.selectedProject = {
                isNew: false,
                name: selectedOption.value,
                subdomain: selectedOption.dataset.subdomain,
            };
        }

        return true;
    }

    /**
     * Update publish summary
     */
    updatePublishSummary() {
        const target = this.modalElement.querySelector('#cloudflare-publish-target');
        target.textContent = `${this.selectedProject?.name}.pages.dev`;
    }

    /**
     * Publish to Cloudflare Pages
     */
    async publish() {
        const basePath = eXeLearning?.config?.basePath || '';
        const publishing = this.modalElement.querySelector('#cloudflare-publishing');
        const result = this.modalElement.querySelector('#cloudflare-publish-result');
        const success = this.modalElement.querySelector('#cloudflare-publish-success');
        const error = this.modalElement.querySelector('#cloudflare-publish-error');
        const pagesUrl = this.modalElement.querySelector('#cloudflare-pages-url');
        const errorMsg = this.modalElement.querySelector('#cloudflare-error-message');

        this.publishBtn?.classList.add('d-none');
        publishing?.classList.remove('d-none');
        result?.classList.add('d-none');

        try {
            const sessionId = eXeLearning.app.project.odeSession;

            const publishResponse = await fetch(`${basePath}/api/publish/cloudflare/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    api_token: this.apiToken,
                    account_id: this.accountId,
                    session_id: sessionId,
                    project_name: this.selectedProject.name,
                    create_project: this.selectedProject.isNew,
                    export_type: 'html5',
                }),
            });

            const publishData = await publishResponse.json();

            publishing?.classList.add('d-none');
            result?.classList.remove('d-none');

            if (publishData.success) {
                success?.classList.remove('d-none');
                error?.classList.add('d-none');
                pagesUrl.href = publishData.url;
                pagesUrl.textContent = publishData.url;
            } else {
                throw new Error(publishData.error || 'Publish failed');
            }
        } catch (err) {
            console.error('Publish error:', err);
            publishing?.classList.add('d-none');
            result?.classList.remove('d-none');
            success?.classList.add('d-none');
            error?.classList.remove('d-none');
            errorMsg.textContent = err.message;
            this.publishBtn?.classList.remove('d-none');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        eXeLearning.app.modals.alert.show({
            title: _('Error'),
            body: message,
        });
    }
}
