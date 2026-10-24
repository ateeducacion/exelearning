import Modal from '../modal.js';

export default class ModalSessionLogout extends Modal {
    constructor(manager) {
        let id = 'modalSessionLogout';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.saveSessionButton = this.modalElement.querySelector(
            'button.session-logout-save.btn.btn-primary'
        );
        this.notSaveSessionButton = this.modalElement.querySelector(
            'button.session-logout-without-save.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
        // Modal footer content element
        this.modalFooterContent =
            this.modalElement.querySelector('.modal-footer');
    }

    /**
     * Show the save-before-transition dialog.
     *
     * @param {Object} data
     * @param {string} [data.title] - Modal title
     * @param {string} [data.body] - Contextual question shown in the body.
     *   Falls back to "Do you want to save the current project?".
     * @param {string} [data.saveButtonText] - Label for the "save" button.
     *   Falls back to "Yes".
     * @param {string} [data.notSaveButtonText] - Label for the "don't save"
     *   button. Falls back to {@link data.forceOpen} or "Exit without saving".
     * @param {string} [data.forceOpen] - Deprecated label for the "don't save"
     *   button. Kept for backward compatibility; prefer `notSaveButtonText`.
     * @param {Object} [data.pendingAction] - Action descriptor for transitionToProject:
     *   { action: 'new'|'open'|'import', projectUuid?, file? }
     * @param {boolean} [data.offlineExit] - Electron: save-and-close flow
     */
    show(data) {
        // Set title
        this.titleDefault = _('Logout');
        data = data ? data : {};
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        let title = data.title ? data.title : this.titleDefault;
        let body = data.body
            ? data.body
            : _('Do you want to save the current project?');
        setTimeout(() => {
            this.setTitle(title);
            this.setBody(body);
            this.setFooterContent(data);
            this.modal.show();
        }, time);
    }

    /**
     * setFooterContent
     */
    setFooterContent(data) {
        let saveSessionButton = this.saveSessionButton.cloneNode(true);
        let notSaveSessionButton = this.notSaveSessionButton.cloneNode(true);
        let cancelButton = this.cancelButton;

        this.modalFooterContent.innerHTML = '';
        this.modalFooterContent.appendChild(
            this.setSaveSessionButton(saveSessionButton, data)
        );
        this.modalFooterContent.appendChild(
            this.setNotSaveSessionButton(notSaveSessionButton, data)
        );
        this.modalFooterContent.appendChild(cancelButton);
    }

    /**
     * setSaveSessionButton
     */
    setSaveSessionButton(saveSessionButton, data) {
        saveSessionButton.innerHTML = data.saveButtonText
            ? data.saveButtonText
            : _('Yes');
        this.saveSessionEventListener(saveSessionButton, data);
        return saveSessionButton;
    }

    /**
     * setNotSaveSessionButton
     *
     * Prefers the contextual `notSaveButtonText`, falling back to the
     * deprecated `forceOpen` label and finally to "Exit without saving".
     */
    setNotSaveSessionButton(notSaveSessionButton, data) {
        notSaveSessionButton.innerHTML =
            data.notSaveButtonText ||
            data.forceOpen ||
            _('Exit without saving');
        this.notSaveSessionEventListener(notSaveSessionButton, data);
        return notSaveSessionButton;
    }

    /**
     * Close the offline app (Electron window)
     */
    closeOfflineApp() {
        window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
        window.onbeforeunload = null;
        window.close();
    }

    /**
     * Save project and close app in offline mode
     */
    async saveAndCloseOffline() {
        try {
            const project = eXeLearning.app.project;
            // Use Yjs export for saving
            if (
                project?._yjsEnabled &&
                project?.exportToElpxViaYjs
            ) {
                const bridge = project._yjsBridge;
                const result = await project.exportToElpxViaYjs({
                    saveAs: false,
                });
                if (result?.saved !== true || eXeLearning.app.project !== project || project._yjsBridge !== bridge) {
                    return false;
                }
            } else {
                throw new Error('Project export is unavailable');
            }
            this.closeOfflineApp();
            return true;
        } catch (error) {
            console.error(
                '[ModalSessionLogout] Error saving before exit:',
                error
            );
            eXeLearning.app.modals.alert.show({
                title: _('Error saving'),
                body: _('An error occurred while saving the project'),
                contentId: 'error',
            });
            return false;
        }
    }

    /**
     * "Yes" (save) button click handler.
     */
    saveSessionEventListener(saveSessionButton, data) {
        saveSessionButton.addEventListener('click', async () => {
            // Handle offline exit: save and close app
            if (data.offlineExit) {
                this.close();
                await this.saveAndCloseOffline();
                return;
            }

            // Online mode: save + transition via full reload
            const pendingAction = data.pendingAction;
            if (pendingAction && eXeLearning.app.project?.transitionToProject) {
                this.close();
                try {
                    await eXeLearning.app.project.transitionToProject({
                        ...pendingAction,
                        skipSave: false,
                    });
                } catch (error) {
                    console.error('[SessionLogout] Error during transition:', error);
                    eXeLearning.app.modals.alert.show({
                        title: _('Error saving'),
                        body: _('An error occurred while saving the project'),
                        contentId: 'error',
                    });
                }
                return;
            }

            // Pure logout with save: save and redirect
            this.close();
            try {
                const project = eXeLearning.app.project;
                const bridge = project?._yjsBridge;
                const result = await bridge?.saveManager?.save();
                if (result?.success !== true || eXeLearning.app.project !== project || project._yjsBridge !== bridge) {
                    throw new Error('Project save was not confirmed');
                }
            } catch (error) {
                console.error('[SessionLogout] Error saving before logout:', error);
                eXeLearning.app.modals.alert.show({
                    title: _('Error saving'),
                    body: _('An error occurred while saving the project'),
                    contentId: 'error',
                });
                return;
            }
            window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
            window.onbeforeunload = null;
            const basePath = window.eXeLearning?.config?.basePath || '';
            window.location.href = `${basePath}/logout`;
        });
    }

    /**
     * "No" (don't save) button click handler.
     */
    notSaveSessionEventListener(notSaveSessionButton, data) {
        notSaveSessionButton.addEventListener('click', async () => {
            // Handle offline exit: close app without saving
            if (data.offlineExit) {
                this.close();
                this.closeOfflineApp();
                return;
            }

            // Online mode: transition without save
            const pendingAction = data.pendingAction;
            if (pendingAction && eXeLearning.app.project?.transitionToProject) {
                this.close();
                try {
                    await eXeLearning.app.project.transitionToProject({
                        ...pendingAction,
                        skipSave: true,
                    });
                } catch (error) {
                    console.error('[SessionLogout] Error during transition:', error);
                }
                return;
            }

            // Pure logout without save: redirect
            this.close();
            window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
            window.onbeforeunload = null;
            const basePath = window.eXeLearning?.config?.basePath || '';
            window.location.href = `${basePath}/logout`;
        });
    }
}
