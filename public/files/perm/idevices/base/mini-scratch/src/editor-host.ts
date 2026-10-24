/** Reuse the already loaded runtime; never bundle a second Blockly in edition. */
export const { Blockly, gui, blockLabels, inject, snapshot, toolbox, button, node, Player, media } =
    globalThis.$miniscratch.authoring;
