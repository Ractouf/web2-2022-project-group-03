import { AdvancedDynamicTexture, Button, Control, Image, Rectangle, StackPanel, TextBlock } from '@babylonjs/gui';
import menuImage from '../img/pauseMenuImage.png';

export default class Hud {
    time = 0;
    gamePaused = false;
    menu = null;

    /**
     * Creates the fullscreen UI with the timer and the pause menu
     * @param {Game} game The running game
     */
    constructor(game) {
        this.ui = AdvancedDynamicTexture.CreateFullscreenUI('UI');
        this.ui.idealHeight = 720;

        this.clock = new TextBlock('clock', '0');
        this.clock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.clock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.clock.top = '14px';
        this.clock.width = '50px';
        this.clock.height = '50px';
        this.clock.fontSize = '30px';
        this.clock.color = 'white';
        this.ui.addControl(this.clock);

        this.pauseMenu = Hud.createMenu(null, [
            ['RESUME', () => this.hideMenu()],
            ['RETRY', () => { this.hideMenu(); game.respawn(); }],
            ['QUIT', () => game.quit()],
        ]);
    }

    /**
     * Creates a centered menu
     * @param {string|null} text Optional text above the buttons
     * @param {Array<[string, Function]>} buttons Label and click handler of each button
     * @returns the menu, not yet shown
     */
    static createMenu(text, buttons) {
        const menu = new Rectangle();
        menu.width = 0.4;
        menu.height = 0.5;
        menu.thickness = 0;
        menu.addControl(new Image('background', menuImage));

        const panel = new StackPanel();
        menu.addControl(panel);

        if (text) {
            const block = new TextBlock('text', text);
            block.height = '40px';
            block.color = 'black';
            panel.addControl(block);
        }

        buttons.forEach(([label, onClick]) => {
            const button = Button.CreateSimpleButton(label, label);
            button.width = 0.3;
            button.height = '40px';
            button.color = 'black';
            button.thickness = 0;
            button.onPointerDownObservable.add(onClick);
            panel.addControl(button);
        });

        return menu;
    }

    showMenu(menu) {
        this.hideMenu();
        this.menu = menu;
        this.ui.addControl(menu);
        this.gamePaused = true;
    }

    hideMenu() {
        if (this.menu) this.ui.removeControl(this.menu);
        this.menu = null;
        this.gamePaused = false;
    }

    togglePause() {
        if (!this.menu) this.showMenu(this.pauseMenu);
        else if (this.menu === this.pauseMenu) this.hideMenu();
    }

    tick() {
        if (this.gamePaused) return;
        this.time += 1;
        this.clock.text = `${this.time}`;
    }
}
