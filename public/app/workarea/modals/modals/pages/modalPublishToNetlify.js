import Modal from '../modal.js';

/**
 * Modal for publishing projects to Netlify
 */
export default class ModalPublishToNetlify extends Modal {
    constructor(manager) {
        const id = 'modalPublishToNetlify';
        super(manager, id, undefined, false);

        this.currentStep = 1;
        this.accessToken = null;
        this.sites = [];
        this.selectedSite = null;

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
        this.connectBtn = this.modalElement.querySelector('#netlify-connect-btn');
        this.prevBtn = this.modalElement.querySelector('#netlify-prev-btn');
        this.nextBtn = this.modalElement.querySelector('#netlify-next-btn');
        this.publishBtn = this.modalElement.querySelector('#netlify-publish-btn');

        // Set up event listeners
        this.connectBtn?.addEventListener('click', () => this.connect());
        this.prevBtn?.addEventListener('click', () => this.goToStep(this.currentStep - 1));
        this.nextBtn?.addEventListener('click', () => this.goToStep(this.currentStep + 1));
        this.publishBtn?.addEventListener('click', () => this.publish());

        // Site option toggle
        const siteExisting = this.modalElement.querySelector('#netlify-site-existing');
        const siteNew = this.modalElement.querySelector('#netlify-site-new');
        siteExisting?.addEventListener('change', () => this.toggleSiteOption('existing'));
        siteNew?.addEventListener('change', () => this.toggleSiteOption('new'));
    }

    /**
     * Show the modal
     */
    show() {
        this.titleDefault = _('Publish to Netlify');
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
        const authenticated = this.modalElement.querySelector('#netlify-authenticated');
        authenticated?.classList.add('d-none');
        this.connectBtn?.classList.remove('d-none');

        // Reset token input
        const tokenInput = this.modalElement.querySelector('#netlify-token');
        if (tokenInput) tokenInput.value = '';

        // Reset publish UI
        const publishing = this.modalElement.querySelector('#netlify-publishing');
        const result = this.modalElement.querySelector('#netlify-publish-result');
        publishing?.classList.add('d-none');
        result?.classList.add('d-none');
    }

    /**
     * Check if user has existing authentication
     */
    checkExistingAuth() {
        const savedToken = localStorage.getItem('netlify_access_token');
        if (savedToken) {
            this.accessToken = savedToken;
            const tokenInput = this.modalElement.querySelector('#netlify-token');
            if (tokenInput) tokenInput.value = savedToken;
        }
    }

    /**
     * Connect with token
     */
    async connect() {
        const tokenInput = this.modalElement.querySelector('#netlify-token');
        const token = tokenInput?.value?.trim();

        if (!token) {
            this.showError(_('Please enter your Netlify access token'));
            return;
        }

        this.accessToken = token;

        // Try to list sites to validate token
        const basePath = eXeLearning?.config?.basePath || '';

        try {
            const response = await fetch(`${basePath}/api/publish/netlify/sites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ access_token: this.accessToken }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Invalid token');
            }

            // Token is valid, save it
            localStorage.setItem('netlify_access_token', token);
            this.sites = data.sites;

            // Show authenticated state
            const authenticated = this.modalElement.querySelector('#netlify-authenticated');
            authenticated?.classList.remove('d-none');
            this.connectBtn?.classList.add('d-none');
            this.nextBtn?.classList.remove('d-none');
        } catch (error) {
            console.error('Netlify connect error:', error);
            this.showError(error.message || _('Invalid token'));
        }
    }

    /**
     * Go to a specific step
     */
    async goToStep(step) {
        if (step < 1 || step > 3) return;

        // Validate before moving forward
        if (step > this.currentStep) {
            if (this.currentStep === 1 && !this.accessToken) {
                this.showError(_('Please connect with your Netlify token first'));
                return;
            }
            if (this.currentStep === 2) {
                const valid = this.validateSiteSelection();
                if (!valid) return;
            }
        }

        this.currentStep = step;
        this.updateStepVisibility();

        // Populate sites when entering step 2
        if (step === 2) {
            this.populateSites();
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
        const steps = ['auth', 'site', 'publish'];
        steps.forEach((stepName, index) => {
            const step = this.modalElement.querySelector(`#netlify-${stepName}-step`);
            if (step) {
                step.classList.toggle('d-none', index + 1 !== this.currentStep);
            }
        });

        // Update buttons
        this.prevBtn?.classList.toggle('d-none', this.currentStep === 1);
        this.connectBtn?.classList.toggle('d-none', this.currentStep !== 1 || this.accessToken);
        this.nextBtn?.classList.toggle('d-none', this.currentStep === 3 || (this.currentStep === 1 && !this.accessToken));
        this.publishBtn?.classList.toggle('d-none', this.currentStep !== 3);
    }

    /**
     * Populate sites dropdown
     */
    populateSites() {
        const select = this.modalElement.querySelector('#netlify-site-select');

        select.innerHTML = '<option value="">' + _('Select a site') + '</option>';
        this.sites.forEach((site) => {
            const option = document.createElement('option');
            option.value = site.id;
            option.textContent = site.name;
            option.dataset.url = site.url;
            select.appendChild(option);
        });
    }

    /**
     * Toggle between existing and new site options
     */
    toggleSiteOption(option) {
        const existingDiv = this.modalElement.querySelector('#netlify-existing-site');
        const newDiv = this.modalElement.querySelector('#netlify-new-site');

        existingDiv?.classList.toggle('d-none', option === 'new');
        newDiv?.classList.toggle('d-none', option === 'existing');
    }

    /**
     * Validate site selection
     */
    validateSiteSelection() {
        const isNew = this.modalElement.querySelector('#netlify-site-new')?.checked;

        if (isNew) {
            const name = this.modalElement.querySelector('#netlify-site-name')?.value?.trim();
            if (!name) {
                this.showError(_('Please enter a site name'));
                return false;
            }
            // Validate site name format
            if (!/^[a-z0-9-]+$/.test(name)) {
                this.showError(_('Site name can only contain lowercase letters, numbers, and hyphens'));
                return false;
            }
            this.selectedSite = {
                isNew: true,
                name,
            };
        } else {
            const select = this.modalElement.querySelector('#netlify-site-select');
            const selectedOption = select?.options[select.selectedIndex];

            if (!selectedOption?.value) {
                this.showError(_('Please select a site'));
                return false;
            }

            this.selectedSite = {
                isNew: false,
                id: selectedOption.value,
                name: selectedOption.textContent,
                url: selectedOption.dataset.url,
            };
        }

        return true;
    }

    /**
     * Update publish summary
     */
    updatePublishSummary() {
        const target = this.modalElement.querySelector('#netlify-publish-target');

        if (this.selectedSite?.isNew) {
            target.textContent = `${this.selectedSite.name}.netlify.app`;
        } else {
            target.textContent = this.selectedSite?.url || this.selectedSite?.name;
        }
    }

    /**
     * Publish to Netlify
     */
    async publish() {
        const basePath = eXeLearning?.config?.basePath || '';
        const publishing = this.modalElement.querySelector('#netlify-publishing');
        const result = this.modalElement.querySelector('#netlify-publish-result');
        const success = this.modalElement.querySelector('#netlify-publish-success');
        const error = this.modalElement.querySelector('#netlify-publish-error');
        const siteUrl = this.modalElement.querySelector('#netlify-site-url');
        const errorMsg = this.modalElement.querySelector('#netlify-error-message');

        this.publishBtn?.classList.add('d-none');
        publishing?.classList.remove('d-none');
        result?.classList.add('d-none');

        try {
            const sessionId = eXeLearning.app.project.odeSession;

            const publishResponse = await fetch(`${basePath}/api/publish/netlify/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    access_token: this.accessToken,
                    session_id: sessionId,
                    site_id: this.selectedSite.isNew ? undefined : this.selectedSite.id,
                    site_name: this.selectedSite.isNew ? this.selectedSite.name : undefined,
                    create_site: this.selectedSite.isNew,
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
