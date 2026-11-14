/** Native export lifecycle. SPDX-License-Identifier: AGPL-3.0-or-later */
import { Blockly, gui, blockLabels, inject, snapshot, toolbox } from './blocks';
import { Player, renderView, node, button } from './player';
const script = document.currentScript as HTMLScriptElement | null;
const media = script?.src ? new URL('media/', script.src).href : '';
const players = new Map<HTMLElement, Player>();
let observer: MutationObserver | undefined;
function scan(): void {
    document.querySelectorAll<HTMLElement>('[data-block-programming]').forEach((root) => {
        if (players.has(root) || root.closest('.ms-author')) return;
        try {
            const player = new Player(root, JSON.parse(decodeURIComponent(root.dataset.blockProgramming!)), media);
            players.set(root, player);
        } catch (error) {
            root.textContent = String((error as Error).message);
        }
    });
    if (players.size && !observer) {
        observer = new MutationObserver(() => {
            for (const [root, player] of players)
                if (!root.isConnected) {
                    player.dispose();
                    players.delete(root);
                }
            if (!players.size) {
                observer?.disconnect();
                observer = undefined;
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
if (!globalThis.$blockprogramming) {
    globalThis.$blockprogramming = {
        renderView,
        renderBehaviour: scan,
        init: scan,
        authoring: { Blockly, gui, blockLabels, inject, snapshot, toolbox, Player, node, button, media },
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
    else scan();
}
