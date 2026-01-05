import Modal from '../modal.js';

/**
 * Modal for publishing projects to GitHub Pages
 * Uses GitHub Device Flow for authentication (no secrets exposed in browser)
 */
export default class ModalPublishToGithub extends Modal {
    constructor(manager) {
        const id = 'modalPublishToGithub';
        super(manager, id, undefined, false);

        this.currentStep = 1;
        this.accessToken = null;
        this.githubUser = null;
        this.repos = [];
        this.selectedRepo = null;
        this.pollInterval = null;

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
        this.connectBtn = this.modalElement.querySelector('#github-connect-btn');
        this.prevBtn = this.modalElement.querySelector('#github-prev-btn');
        this.nextBtn = this.modalElement.querySelector('#github-next-btn');
        this.publishBtn = this.modalElement.querySelector('#github-publish-btn');

        // Set up event listeners
        this.connectBtn?.addEventListener('click', () => this.startDeviceFlow());
        this.prevBtn?.addEventListener('click', () => this.goToStep(this.currentStep - 1));
        this.nextBtn?.addEventListener('click', () => this.goToStep(this.currentStep + 1));
        this.publishBtn?.addEventListener('click', () => this.publish());

        // Repository option toggle
        const repoExisting = this.modalElement.querySelector('#github-repo-existing');
        const repoNew = this.modalElement.querySelector('#github-repo-new');
        repoExisting?.addEventListener('change', () => this.toggleRepoOption('existing'));
        repoNew?.addEventListener('change', () => this.toggleRepoOption('new'));

        // Modal close - cleanup
        this.modalElement.addEventListener('hidden.bs.modal', () => this.cleanup());
    }

    /**
     * Show the modal
     */
    show() {
        this.titleDefault = _('Publish to GitHub Pages');
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
        const deviceFlow = this.modalElement.querySelector('#github-device-flow');
        const authenticated = this.modalElement.querySelector('#github-authenticated');
        deviceFlow?.classList.add('d-none');
        authenticated?.classList.add('d-none');
        this.connectBtn?.classList.remove('d-none');

        // Reset publish UI
        const publishing = this.modalElement.querySelector('#github-publishing');
        const result = this.modalElement.querySelector('#github-publish-result');
        publishing?.classList.add('d-none');
        result?.classList.add('d-none');
    }

    /**
     * Check if user has existing authentication
     */
    async checkExistingAuth() {
        // Check localStorage for saved token
        const savedToken = localStorage.getItem('github_access_token');
        if (savedToken) {
            try {
                this.accessToken = savedToken;
                await this.loadUserInfo();
                this.showAuthenticated();
            } catch {
                // Token invalid, clear it
                localStorage.removeItem('github_access_token');
                this.accessToken = null;
            }
        }
    }

    /**
     * Start GitHub Device Flow authentication
     */
    async startDeviceFlow() {
        const basePath = eXeLearning?.config?.basePath || '';
        this.connectBtn?.classList.add('d-none');

        try {
            const response = await fetch(`${basePath}/api/publish/github/device/start`, {
                method: 'POST',
                credentials: 'include',
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to start authentication');
            }

            // Show device flow UI
            const deviceFlow = this.modalElement.querySelector('#github-device-flow');
            const verificationUrl = this.modalElement.querySelector('#github-verification-url');
            const userCode = this.modalElement.querySelector('#github-user-code');

            verificationUrl.href = data.verification_uri;
            verificationUrl.textContent = data.verification_uri;
            userCode.textContent = data.user_code;
            deviceFlow?.classList.remove('d-none');

            // Start polling for token
            this.startPolling(data.device_code, data.interval);
        } catch (error) {
            console.error('Device flow error:', error);
            this.showError(error.message);
            this.connectBtn?.classList.remove('d-none');
        }
    }

    /**
     * Poll for access token
     */
    startPolling(deviceCode, interval) {
        const basePath = eXeLearning?.config?.basePath || '';
        const pollMs = (interval || 5) * 1000;

        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${basePath}/api/publish/github/device/poll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ device_code: deviceCode }),
                });

                const data = await response.json();

                if (data.error === 'authorization_pending') {
                    // Still waiting, continue polling
                    return;
                }

                if (data.error === 'slow_down') {
                    // Slow down polling
                    clearInterval(this.pollInterval);
                    this.startPolling(deviceCode, interval + 5);
                    return;
                }

                if (data.error) {
                    throw new Error(data.error_description || data.error);
                }

                if (data.access_token) {
                    // Success!
                    clearInterval(this.pollInterval);
                    this.accessToken = data.access_token;
                    localStorage.setItem('github_access_token', data.access_token);
                    await this.loadUserInfo();
                    this.showAuthenticated();
                }
            } catch (error) {
                clearInterval(this.pollInterval);
                console.error('Polling error:', error);
                this.showError(error.message);
            }
        }, pollMs);
    }

    /**
     * Load GitHub user info
     */
    async loadUserInfo() {
        const basePath = eXeLearning?.config?.basePath || '';

        const response = await fetch(`${basePath}/api/publish/github/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ access_token: this.accessToken }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load user info');
        }

        this.githubUser = data.user;
    }

    /**
     * Show authenticated state
     */
    showAuthenticated() {
        const deviceFlow = this.modalElement.querySelector('#github-device-flow');
        const authenticated = this.modalElement.querySelector('#github-authenticated');
        const username = this.modalElement.querySelector('#github-username');

        deviceFlow?.classList.add('d-none');
        authenticated?.classList.remove('d-none');
        username.textContent = this.githubUser?.login || 'Unknown';
        this.connectBtn?.classList.add('d-none');
        this.nextBtn?.classList.remove('d-none');
    }

    /**
     * Go to a specific step
     */
    async goToStep(step) {
        if (step < 1 || step > 3) return;

        // Validate before moving forward
        if (step > this.currentStep) {
            if (this.currentStep === 1 && !this.accessToken) {
                this.showError(_('Please authenticate with GitHub first'));
                return;
            }
            if (this.currentStep === 2) {
                const valid = this.validateRepoSelection();
                if (!valid) return;
            }
        }

        this.currentStep = step;
        this.updateStepVisibility();

        // Load repos when entering step 2
        if (step === 2 && this.repos.length === 0) {
            await this.loadRepos();
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
        const steps = ['auth', 'repo', 'publish'];
        steps.forEach((stepName, index) => {
            const step = this.modalElement.querySelector(`#github-${stepName}-step`);
            if (step) {
                step.classList.toggle('d-none', index + 1 !== this.currentStep);
            }
        });

        // Update buttons
        this.prevBtn?.classList.toggle('d-none', this.currentStep === 1);
        this.nextBtn?.classList.toggle('d-none', this.currentStep === 3 || !this.accessToken);
        this.publishBtn?.classList.toggle('d-none', this.currentStep !== 3);
    }

    /**
     * Load user repositories
     */
    async loadRepos() {
        const basePath = eXeLearning?.config?.basePath || '';
        const select = this.modalElement.querySelector('#github-repo-select');

        try {
            const response = await fetch(`${basePath}/api/publish/github/repos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ access_token: this.accessToken }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load repositories');
            }

            this.repos = data.repos;

            // Populate select
            select.innerHTML = '<option value="">' + _('Select a repository') + '</option>';
            this.repos.forEach((repo) => {
                const option = document.createElement('option');
                option.value = repo.full_name;
                option.textContent = repo.full_name + (repo.private ? ' (private)' : '');
                option.dataset.owner = repo.full_name.split('/')[0];
                option.dataset.name = repo.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load repos:', error);
            select.innerHTML = '<option value="">' + _('Failed to load repositories') + '</option>';
        }
    }

    /**
     * Toggle between existing and new repository options
     */
    toggleRepoOption(option) {
        const existingDiv = this.modalElement.querySelector('#github-existing-repo');
        const newDiv = this.modalElement.querySelector('#github-new-repo');

        existingDiv?.classList.toggle('d-none', option === 'new');
        newDiv?.classList.toggle('d-none', option === 'existing');
    }

    /**
     * Validate repository selection
     */
    validateRepoSelection() {
        const isNew = this.modalElement.querySelector('#github-repo-new')?.checked;

        if (isNew) {
            const name = this.modalElement.querySelector('#github-repo-name')?.value?.trim();
            if (!name) {
                this.showError(_('Please enter a repository name'));
                return false;
            }
            // Validate repo name format
            if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
                this.showError(_('Repository name can only contain letters, numbers, hyphens, underscores, and periods'));
                return false;
            }
            this.selectedRepo = {
                isNew: true,
                name,
                description: this.modalElement.querySelector('#github-repo-description')?.value?.trim(),
                isPrivate: this.modalElement.querySelector('#github-repo-private')?.checked,
            };
        } else {
            const select = this.modalElement.querySelector('#github-repo-select');
            const selectedOption = select?.options[select.selectedIndex];

            if (!selectedOption?.value) {
                this.showError(_('Please select a repository'));
                return false;
            }

            this.selectedRepo = {
                isNew: false,
                owner: selectedOption.dataset.owner,
                name: selectedOption.dataset.name,
                fullName: selectedOption.value,
            };
        }

        return true;
    }

    /**
     * Update publish summary
     */
    updatePublishSummary() {
        const target = this.modalElement.querySelector('#github-publish-target');
        const branch = this.modalElement.querySelector('#github-branch')?.value || 'gh-pages';

        if (this.selectedRepo?.isNew) {
            target.textContent = `${this.githubUser?.login}/${this.selectedRepo.name} (${branch})`;
        } else {
            target.textContent = `${this.selectedRepo?.fullName} (${branch})`;
        }
    }

    /**
     * Publish to GitHub Pages
     */
    async publish() {
        const basePath = eXeLearning?.config?.basePath || '';
        const publishing = this.modalElement.querySelector('#github-publishing');
        const result = this.modalElement.querySelector('#github-publish-result');
        const success = this.modalElement.querySelector('#github-publish-success');
        const error = this.modalElement.querySelector('#github-publish-error');
        const pagesUrl = this.modalElement.querySelector('#github-pages-url');
        const errorMsg = this.modalElement.querySelector('#github-error-message');

        this.publishBtn?.classList.add('d-none');
        publishing?.classList.remove('d-none');
        result?.classList.add('d-none');

        try {
            // If new repo, create it first
            let repoOwner = this.selectedRepo.owner;
            let repoName = this.selectedRepo.name;

            if (this.selectedRepo.isNew) {
                const createResponse = await fetch(`${basePath}/api/publish/github/repos/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        access_token: this.accessToken,
                        name: this.selectedRepo.name,
                        description: this.selectedRepo.description,
                        is_private: this.selectedRepo.isPrivate,
                    }),
                });

                const createData = await createResponse.json();

                if (!createData.success) {
                    throw new Error(createData.error || 'Failed to create repository');
                }

                repoOwner = this.githubUser.login;
                repoName = createData.repo.name;
            }

            // Publish
            const branch = this.modalElement.querySelector('#github-branch')?.value || 'gh-pages';
            const sessionId = eXeLearning.app.project.odeSession;

            const publishResponse = await fetch(`${basePath}/api/publish/github/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    access_token: this.accessToken,
                    session_id: sessionId,
                    repo_owner: repoOwner,
                    repo_name: repoName,
                    branch: encodeURIComponent(branch),
                    commit_message: `Published from eXeLearning - ${new Date().toISOString()}`,
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

    /**
     * Cleanup on modal close
     */
    cleanup() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
}
