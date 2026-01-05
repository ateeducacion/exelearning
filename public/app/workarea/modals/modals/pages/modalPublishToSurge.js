import Modal from '../modal.js';

/**
 * Modal for publishing projects to Surge.sh
 */
export default class ModalPublishToSurge extends Modal {
    constructor(manager) {
        const id = 'modalPublishToSurge';
        super(manager, id, undefined, false);

        this.currentStep = 1;
        this.email = null;
        this.token = null;
        this.projects = [];
        this.selectedDomain = null;

        // Elements
        this.connectBtn = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.publishBtn = null;
        this.requestTokenBtn = null;
    }

    /**
     * Initialize modal behavior
     */
    behaviour() {
        super.behaviour();

        // Get button references
        this.connectBtn = this.modalElement.querySelector('#surge-connect-btn');
        this.prevBtn = this.modalElement.querySelector('#surge-prev-btn');
        this.nextBtn = this.modalElement.querySelector('#surge-next-btn');
        this.publishBtn = this.modalElement.querySelector('#surge-publish-btn');
        this.requestTokenBtn = this.modalElement.querySelector('#surge-request-token-btn');

        // Set up event listeners
        this.connectBtn?.addEventListener('click', () => this.connect());
        this.prevBtn?.addEventListener('click', () => this.goToStep(this.currentStep - 1));
        this.nextBtn?.addEventListener('click', () => this.goToStep(this.currentStep + 1));
        this.publishBtn?.addEventListener('click', () => this.publish());
        this.requestTokenBtn?.addEventListener('click', () => this.requestToken());

        // Domain option toggle
        const domainExisting = this.modalElement.querySelector('#surge-domain-existing');
        const domainNew = this.modalElement.querySelector('#surge-domain-new');
        domainExisting?.addEventListener('change', () => this.toggleDomainOption('existing'));
        domainNew?.addEventListener('change', () => this.toggleDomainOption('new'));
    }

    /**
     * Show the modal
     */
    show() {
        this.titleDefault = _('Publish to Surge.sh');
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
        const authenticated = this.modalElement.querySelector('#surge-authenticated');
        const tokenSent = this.modalElement.querySelector('#surge-token-sent');
        authenticated?.classList.add('d-none');
        tokenSent?.classList.add('d-none');
        this.connectBtn?.classList.remove('d-none');

        // Reset inputs
        const emailInput = this.modalElement.querySelector('#surge-email');
        const tokenInput = this.modalElement.querySelector('#surge-token');
        if (emailInput) emailInput.value = '';
        if (tokenInput) tokenInput.value = '';

        // Reset publish UI
        const publishing = this.modalElement.querySelector('#surge-publishing');
        const result = this.modalElement.querySelector('#surge-publish-result');
        publishing?.classList.add('d-none');
        result?.classList.add('d-none');
    }

    /**
     * Check if user has existing authentication
     */
    checkExistingAuth() {
        const savedEmail = localStorage.getItem('surge_email');
        const savedToken = localStorage.getItem('surge_token');

        if (savedEmail && savedToken) {
            this.email = savedEmail;
            this.token = savedToken;

            const emailInput = this.modalElement.querySelector('#surge-email');
            const tokenInput = this.modalElement.querySelector('#surge-token');
            if (emailInput) emailInput.value = savedEmail;
            if (tokenInput) tokenInput.value = savedToken;
        }
    }

    /**
     * Request token via email
     */
    async requestToken() {
        const emailInput = this.modalElement.querySelector('#surge-email');
        const email = emailInput?.value?.trim();

        if (!email) {
            this.showError(_('Please enter your email address'));
            return;
        }

        const basePath = eXeLearning?.config?.basePath || '';
        this.requestTokenBtn.disabled = true;
        this.requestTokenBtn.textContent = _('Sending...');

        try {
            const response = await fetch(`${basePath}/api/publish/surge/request-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.success) {
                const tokenSent = this.modalElement.querySelector('#surge-token-sent');
                tokenSent?.classList.remove('d-none');
            } else {
                this.showError(data.error || _('Failed to send token'));
            }
        } catch (error) {
            console.error('Request token error:', error);
            this.showError(error.message || _('Failed to send token'));
        } finally {
            this.requestTokenBtn.disabled = false;
            this.requestTokenBtn.textContent = _('Request Token via Email');
        }
    }

    /**
     * Connect with credentials
     */
    async connect() {
        const emailInput = this.modalElement.querySelector('#surge-email');
        const tokenInput = this.modalElement.querySelector('#surge-token');
        const email = emailInput?.value?.trim();
        const token = tokenInput?.value?.trim();

        if (!email) {
            this.showError(_('Please enter your email address'));
            return;
        }

        if (!token) {
            this.showError(_('Please enter your Surge token'));
            return;
        }

        this.email = email;
        this.token = token;

        // Try to list projects to validate credentials
        const basePath = eXeLearning?.config?.basePath || '';

        try {
            const response = await fetch(`${basePath}/api/publish/surge/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: this.email, token: this.token }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Invalid credentials');
            }

            // Credentials are valid, save them
            localStorage.setItem('surge_email', email);
            localStorage.setItem('surge_token', token);
            this.projects = data.projects || [];

            // Show authenticated state
            const authenticated = this.modalElement.querySelector('#surge-authenticated');
            authenticated?.classList.remove('d-none');
            this.connectBtn?.classList.add('d-none');
            this.nextBtn?.classList.remove('d-none');
        } catch (error) {
            console.error('Surge connect error:', error);
            // Even if listing fails, the credentials might be valid for a new user
            // Save them and allow proceeding
            localStorage.setItem('surge_email', email);
            localStorage.setItem('surge_token', token);
            this.projects = [];

            const authenticated = this.modalElement.querySelector('#surge-authenticated');
            authenticated?.classList.remove('d-none');
            this.connectBtn?.classList.add('d-none');
            this.nextBtn?.classList.remove('d-none');
        }
    }

    /**
     * Go to a specific step
     */
    async goToStep(step) {
        if (step < 1 || step > 3) return;

        // Validate before moving forward
        if (step > this.currentStep) {
            if (this.currentStep === 1 && (!this.email || !this.token)) {
                this.showError(_('Please connect with your Surge credentials first'));
                return;
            }
            if (this.currentStep === 2) {
                const valid = this.validateDomainSelection();
                if (!valid) return;
            }
        }

        this.currentStep = step;
        this.updateStepVisibility();

        // Populate domains when entering step 2
        if (step === 2) {
            this.populateDomains();
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
        const steps = ['auth', 'domain', 'publish'];
        steps.forEach((stepName, index) => {
            const step = this.modalElement.querySelector(`#surge-${stepName}-step`);
            if (step) {
                step.classList.toggle('d-none', index + 1 !== this.currentStep);
            }
        });

        // Update buttons
        this.prevBtn?.classList.toggle('d-none', this.currentStep === 1);
        this.connectBtn?.classList.toggle('d-none', this.currentStep !== 1 || (this.email && this.token));
        this.nextBtn?.classList.toggle('d-none', this.currentStep === 3 || (this.currentStep === 1 && (!this.email || !this.token)));
        this.publishBtn?.classList.toggle('d-none', this.currentStep !== 3);
    }

    /**
     * Populate domains dropdown
     */
    populateDomains() {
        const select = this.modalElement.querySelector('#surge-domain-select');

        if (this.projects.length === 0) {
            select.innerHTML = '<option value="">' + _('No existing domains - create a new one') + '</option>';
            // Auto-select new domain option
            const domainNew = this.modalElement.querySelector('#surge-domain-new');
            if (domainNew) domainNew.checked = true;
            this.toggleDomainOption('new');
            return;
        }

        select.innerHTML = '<option value="">' + _('Select a domain') + '</option>';
        this.projects.forEach((project) => {
            const option = document.createElement('option');
            option.value = project.domain;
            option.textContent = project.domain;
            select.appendChild(option);
        });
    }

    /**
     * Toggle between existing and new domain options
     */
    toggleDomainOption(option) {
        const existingDiv = this.modalElement.querySelector('#surge-existing-domain');
        const newDiv = this.modalElement.querySelector('#surge-new-domain');

        existingDiv?.classList.toggle('d-none', option === 'new');
        newDiv?.classList.toggle('d-none', option === 'existing');
    }

    /**
     * Validate domain selection
     */
    validateDomainSelection() {
        const isNew = this.modalElement.querySelector('#surge-domain-new')?.checked;

        if (isNew) {
            const name = this.modalElement.querySelector('#surge-domain-name')?.value?.trim();
            if (!name) {
                this.showError(_('Please enter a domain name'));
                return false;
            }
            // Validate domain name format
            if (!/^[a-z0-9-]+$/.test(name)) {
                this.showError(_('Domain name can only contain lowercase letters, numbers, and hyphens'));
                return false;
            }
            this.selectedDomain = `${name}.surge.sh`;
        } else {
            const select = this.modalElement.querySelector('#surge-domain-select');
            const selectedOption = select?.options[select.selectedIndex];

            if (!selectedOption?.value) {
                this.showError(_('Please select a domain'));
                return false;
            }

            this.selectedDomain = selectedOption.value;
        }

        return true;
    }

    /**
     * Update publish summary
     */
    updatePublishSummary() {
        const target = this.modalElement.querySelector('#surge-publish-target');
        target.textContent = `https://${this.selectedDomain}`;
    }

    /**
     * Publish to Surge.sh
     */
    async publish() {
        const basePath = eXeLearning?.config?.basePath || '';
        const publishing = this.modalElement.querySelector('#surge-publishing');
        const result = this.modalElement.querySelector('#surge-publish-result');
        const success = this.modalElement.querySelector('#surge-publish-success');
        const error = this.modalElement.querySelector('#surge-publish-error');
        const siteUrl = this.modalElement.querySelector('#surge-site-url');
        const errorMsg = this.modalElement.querySelector('#surge-error-message');

        this.publishBtn?.classList.add('d-none');
        publishing?.classList.remove('d-none');
        result?.classList.add('d-none');

        try {
            const sessionId = eXeLearning.app.project.odeSession;

            const publishResponse = await fetch(`${basePath}/api/publish/surge/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: this.email,
                    token: this.token,
                    session_id: sessionId,
                    domain: this.selectedDomain,
                    export_type: 'html5',
                }),
            });

            const publishData = await publishResponse.json();

            publishing?.classList.add('d-none');
            result?.classList.remove('d-none');

            if (publishData.success) {
                success?.classList.remove('d-none');
                error?.classList.add('d-none');
                siteUrl.href = publishData.url;
                siteUrl.textContent = publishData.url;
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
