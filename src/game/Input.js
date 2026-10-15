import { ActionManager, ExecuteCodeAction, Scalar } from '@babylonjs/core';
import Player from './Player';

const FORWARD = ['z', 'w'];
const BACK = ['s'];
const LEFT = ['q', 'a'];
const RIGHT = ['d'];

export default class PlayerInput {
    keys = {};
    horizontal = 0;
    vertical = 0;
    jumpKeyDown = false;
    firstPerson = false;

    /**
     * Tracks pressed keys and handles the pause and camera toggles
     * @param {Scene} scene The current scene
     * @param {Hud} ui The current ingame ui
     */
    constructor(scene, ui) {
        this.ui = ui;

        scene.actionManager = new ActionManager(scene);
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, ({ sourceEvent }) => {
            this.keys[sourceEvent.key.toLowerCase()] = true;
        }));
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, ({ sourceEvent }) => {
            const key = sourceEvent.key.toLowerCase();
            this.keys[key] = false;

            if (key === 'escape') ui.togglePause();

            if (key === 'c' && !ui.gamePaused) {
                this.firstPerson = !this.firstPerson;
                Player.setFirstPerson(scene.getCameraByName('Camera'), this.firstPerson);
            }
        }));

        scene.onBeforeRenderObservable.add(() => this.update());
    }

    pressed(keys) {
        return !this.ui.gamePaused && keys.some((k) => this.keys[k]);
    }

    update() {
        if (this.pressed(FORWARD)) this.vertical = Scalar.Lerp(this.vertical, 1, 0.2);
        else if (this.pressed(BACK)) this.vertical = Scalar.Lerp(this.vertical, -1, 0.2);
        else this.vertical = 0;

        if (this.pressed(LEFT)) this.horizontal = Scalar.Lerp(this.horizontal, -1, 0.2);
        else if (this.pressed(RIGHT)) this.horizontal = Scalar.Lerp(this.horizontal, 1, 0.2);
        else this.horizontal = 0;

        this.jumpKeyDown = this.pressed([' ']);
    }
}
