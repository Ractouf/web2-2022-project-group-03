import {
    ActionManager,
    Axis,
    Engine,
    ExecuteCodeAction,
    HemisphericLight,
    Matrix,
    MeshBuilder,
    Quaternion,
    Scene,
    SceneLoader,
    Space,
    Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

import platformModel from '../models/plateform.glb';
import playerModel from '../models/playerbabylontmp.glb';
import carModel from '../models/sierra.glb';

import loadEnvironment, { LAST_LEVEL } from './Environment';
import Hud from './Hud';
import PlayerInput from './Input';
import Player from './Player';

const SPAWN = new Vector3(0, 2, 0);
const CAMERA_SPAWN = new Vector3(-10, 5, 0);
const WHEEL_RADIUS = 0.4;

// [x, z, y rotation in PI, lower z bound, upper z bound, initial direction]
const PLATFORMS = [
    [-26, 104, 1.2, 102, 108, -1],
    [-30, 107, 1.2, 106, 111, -1],
    [-34, 110, 1.3, 108, 113, -1],
    [-38, 113, 1.3, 112, 118, -1],
    [-37, 135, 1 / 1.4, 131, 136, 1],
    [-34, 139, 1 / 1.4, 135, 139, 1],
    [-31, 144, 1 / 1.4, 139, 144, 1],
];

export default class Game {
    level = Math.min(Math.max(parseInt(new URLSearchParams(window.location.search).get('level'), 10) || 1, 1), LAST_LEVEL);
    totalTime = 0;
    intervals = [];

    /**
     * Creates the canvas and engine and loads the first level
     * @param {Function} onQuit Called once the game is closed, with the total time when every level was cleared
     */
    constructor(onQuit) {
        this.onQuit = onQuit;

        this.canvas = document.createElement('canvas');
        document.querySelector('main').appendChild(this.canvas);

        this.engine = new Engine(this.canvas, true);
        this.engine.runRenderLoop(() => {
            if (this.playing) this.scene.render();
        });

        this.onResize = () => this.engine.resize();
        window.addEventListener('resize', this.onResize);

        this.loadLevel();
    }

    /**
     * Loads the current level, the player, the HUD and the level specific obstacles
     */
    async loadLevel() {
        this.playing = false;
        this.levelDone = false;
        this.engine.displayLoadingUI();

        const scene = new Scene(this.engine);
        this.scene = scene;
        scene.detachControl();

        await loadEnvironment(scene, this.level);
        this.assets = await Game.loadCharacter(scene);

        this.ui = new Hud(this);
        this.input = new PlayerInput(scene, this.ui);

        new HemisphericLight('HemiLight', new Vector3(0, 1, 0), scene);
        this.player = new Player(this.assets, scene, this.input, this.canvas, this.ui);
        this.player.activatePlayerCamera();

        await scene.whenReadyAsync();
        this.assets.mesh.position = SPAWN.clone();
        this.intervals.push(setInterval(() => this.ui.tick(), 1000));

        if (this.level === 1) await this.passingCars();
        if (this.level === 2) await this.platforms();
        if (this.level === 4) await this.highway();

        this.registerTriggers();

        this.playing = true;
        this.engine.hideLoadingUI();
        scene.attachControl();
        this.canvas.focus();
    }

    /**
     * Creates a hitbox, imports the player mesh and merges the two
     * @param {Scene} scene The current scene
     * @returns the hitbox mesh and the player animations
     */
    static async loadCharacter(scene) {
        const outer = MeshBuilder.CreateBox('outer', { width: 1, depth: 1, height: 2 }, scene);
        outer.isVisible = false;
        outer.isPickable = false;
        outer.checkCollisions = true;
        outer.bakeTransformIntoVertices(Matrix.Translation(0, 1, 0));
        outer.ellipsoidOffset = new Vector3(0, 1, 0);
        outer.rotationQuaternion = new Quaternion(0, 1, 0, 0);

        const result = await SceneLoader.ImportMeshAsync(null, playerModel, undefined, scene);
        const body = result.meshes[0];
        body.scaling = new Vector3(0.6, 0.6, -0.6);
        body.parent = outer;
        body.isPickable = false;
        body.getChildMeshes().forEach((m) => {
            const mesh = m;
            mesh.isPickable = false;
        });

        return { mesh: outer, animationGroups: result.animationGroups };
    }

    respawn() {
        this.assets.mesh.position = SPAWN.clone();
        this.player.camera.setPosition(CAMERA_SPAWN);
    }

    /**
     * Triggers the end of level menu on the "fin" mesh and a respawn on the "mort" mesh
     */
    registerTriggers() {
        const { actionManager } = this.assets.mesh;
        const onEnter = (mesh, action) => actionManager.registerAction(
            new ExecuteCodeAction({ trigger: ActionManager.OnIntersectionEnterTrigger, parameter: mesh }, action),
        );

        onEnter(this.scene.getMeshByName('fin'), () => this.finishLevel());
        onEnter(this.scene.getMeshByName('mort'), () => this.respawn());
    }

    finishLevel() {
        if (this.levelDone) return;
        this.levelDone = true;
        this.totalTime += this.ui.time;

        if (this.level === LAST_LEVEL) {
            setTimeout(() => this.quit(this.totalTime));
            return;
        }

        this.ui.showMenu(Hud.createMenu(`LEVEL ${this.level} CLEARED IN ${this.ui.time}s`, [
            ['NEXT LEVEL', () => this.nextLevel()],
            ['QUIT', () => this.quit()],
        ]));
    }

    clearIntervals() {
        this.intervals.forEach(clearInterval);
        this.intervals = [];
    }

    nextLevel() {
        this.playing = false;
        this.clearIntervals();
        this.scene.dispose();
        this.level += 1;
        this.loadLevel();
    }

    quit(totalTime) {
        this.playing = false;
        this.clearIntervals();
        window.removeEventListener('resize', this.onResize);
        this.engine.dispose();
        this.onQuit(totalTime);
    }

    /**
     * Imports the car model
     * @param {boolean} solid Whether the player collides with the car
     * @returns the car root mesh
     */
    async loadCar(solid) {
        const result = await SceneLoader.ImportMeshAsync(null, carModel, undefined, this.scene);
        result.meshes[0].getChildMeshes().forEach((m) => {
            const mesh = m;
            mesh.checkCollisions = solid;
            mesh.isPickable = solid;
            if (mesh.name.includes('sierramur')) mesh.isVisible = false;
        });
        return result.meshes[0];
    }

    /**
     * Moves a car forward and spins its wheels to match the distance travelled
     */
    static driveCar(car, step) {
        car.movePOV(0, 0, step);
        car.getChildMeshes()
            .filter((mesh) => mesh.name.includes('wheels'))
            .forEach((wheel) => wheel.rotate(Axis.Y, step / WHEEL_RADIUS, Space.LOCAL));
    }

    /**
     * Level 1: cars driving on loop in the background
     */
    async passingCars() {
        const car = await this.loadCar(false);
        car.position = new Vector3(24.2, 3, -30);

        const car2 = car.clone('car2');
        car2.position = new Vector3(20.8, 3, 70);
        car2.rotation = new Vector3(0, Math.PI * 2, 0);

        const car3 = car.clone('car3');
        car3.position = new Vector3(10, 5.4, 60);
        car3.rotation = new Vector3(0, Math.PI / 2, 0);

        const car4 = car.clone('car4');
        car4.position = new Vector3(-180, 5.4, 56.5);
        car4.rotation = new Vector3(0, Math.PI * 1.5, 0);

        // [car, has reached the end of its road, start of its road]
        const cars = [
            [car, (p) => p.z > 90, new Vector3(22.5, 3, -30)],
            [car2, (p) => p.z < -25, new Vector3(22.5, 3, 70)],
            [car3, (p) => p.x < -80, new Vector3(10, 5.4, 60)],
            [car4, (p) => p.x > 22, new Vector3(-180, 5.4, 60)],
        ];

        this.scene.onBeforeRenderObservable.add(() => {
            const step = 5 * (this.engine.getDeltaTime() / 1000);
            cars.forEach(([mesh, atEnd, start]) => {
                if (atEnd(mesh.position.floor())) mesh.position = start.clone();
                Game.driveCar(mesh, step);
            });
        });
    }

    /**
     * Level 4: a highway to cross, cars on the left lane respawn the player
     */
    async highway() {
        const car = await this.loadCar(true);
        car.position = new Vector3(100, 0, 105);
        car.rotation = new Vector3(0, Math.PI * 1.5, 0);

        let leftLane = [];
        let rightLane = [];
        const lane = (a, b) => (Math.random() < 0.5 ? a : b);

        this.intervals.push(setInterval(() => {
            const clone = car.clone('sierra');
            clone.rotation = new Vector3(0, Math.PI / 2, 0);
            clone.position = new Vector3(210, -4.1, lane(-0.5, 3));
            clone.getChildMeshes()
                .filter((mesh) => mesh.name.includes('sierramur'))
                .forEach((mesh) => this.assets.mesh.actionManager.registerAction(new ExecuteCodeAction(
                    { trigger: ActionManager.OnIntersectionEnterTrigger, parameter: mesh },
                    () => this.respawn(),
                )));
            leftLane.push(clone);
        }, 1000));

        this.intervals.push(setInterval(() => {
            const clone = car.clone('sierra');
            clone.rotation = new Vector3(0, Math.PI * 1.3, 0);
            clone.position = new Vector3(23, -52.5, lane(-101, -104.5));
            rightLane.push(clone);
        }, 2000));

        const drive = (cars, gone, step) => cars.filter((c) => {
            if (gone(c.position)) {
                c.dispose();
                return false;
            }
            Game.driveCar(c, step);
            return true;
        });

        this.scene.onBeforeRenderObservable.add(() => {
            if (this.ui.gamePaused) return;
            const deltaTime = this.engine.getDeltaTime() / 1000;

            leftLane = drive(leftLane, (p) => p.x < 0, 30 * deltaTime);
            rightLane = drive(rightLane, (p) => p.x > 140, 30 * deltaTime);

            if (car.position.x > 170) car.position = new Vector3(100, 0, 105);
            Game.driveCar(car, 10 * deltaTime);
        });
    }

    /**
     * Level 2: platforms moving back and forth
     */
    async platforms() {
        const result = await SceneLoader.ImportMeshAsync(null, platformModel, undefined, this.scene);
        const original = result.meshes[0];
        original.getChildMeshes().forEach((m) => {
            const mesh = m;
            mesh.checkCollisions = true;
            mesh.isPickable = true;
        });

        const platforms = PLATFORMS.map(([x, z, rotation, min, max, dir], i) => {
            const mesh = i === 0 ? original : original.clone(`platform${i}`);
            mesh.position = new Vector3(x, 0, z);
            mesh.rotation = new Vector3(0, Math.PI * rotation, 0);
            return { mesh, min, max, dir };
        });

        this.scene.onBeforeRenderObservable.add(() => {
            const step = 2 * (this.engine.getDeltaTime() / 1000);
            platforms.forEach((p) => {
                const platform = p;
                if (platform.mesh.position.z < platform.min) platform.dir = 1;
                if (platform.mesh.position.z > platform.max) platform.dir = -1;
                platform.mesh.movePOV(0, 0, platform.dir * step);
            });
        });
    }
}
