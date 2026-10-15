import {
    ActionManager,
    ArcRotateCamera,
    Quaternion,
    Ray,
    TransformNode,
    Vector2,
    Vector3
} from "@babylonjs/core";

export default class Player extends TransformNode {
    camera;
    scene;
    input;
    canvas;
    ui;
    mesh;
    run;
    idle;
    jump;
    land;
    currentAnim = null;
    prevAnim;
    isFalling = false;
    jumped = false;
    static PLAYER_SPEED = 10;
    static JUMP_FORCE = 0.5;
    static GRAVITY = -1.8;
    deltaTime;
    h;
    v;
    gravity = new Vector3();
    lastGroundPos = Vector3.Zero();
    grounded;
    jumpCount;
    moveDirection = new Vector3();

    /**
     * setup camera and animations
     * places the camera
     * @param {Mesh} assets The player mesh
     * @param {Scene} scene The current scene
     * @param {PlayerInput} input The player inputs
     * @param {HTMLCanvasElement} canvas The current canvas
     * @param {Hud} ui The current ingame ui
     */
    constructor(assets, scene, input, canvas, ui) {
        super("player", scene);
        [, this.idle, this.jump, this.land, this.run] = assets.animationGroups;

        this.scene = scene;
        this.input = input;
        this.canvas = canvas
        this.ui = ui;

        this.setupPlayerCamera();
        this.setUpAnimations();

        this.mesh = assets.mesh;
        this.mesh.parent = this;
        this.mesh.actionManager = new ActionManager(this.scene);

        this.camera.target = this.mesh;
        this.camera.targetScreenOffset = new Vector2(0, -3);
    }

    /**
     * Gets the inputs and corrects them so that forward is where the camera looks
     */
    updateFromControls() {
        this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
        this.moveDirection = Vector3.Zero();

        const { horizontal, vertical } = this.input;

        if (horizontal !== 0 || vertical !== 0) {
            const fwd = this.camera.getDirection(new Vector3(0, 0, 1)).scaleInPlace(vertical);
            const right = this.camera.getDirection(new Vector3(1, 0, 0)).scaleInPlace(horizontal);
            const move = right.addInPlace(fwd).normalize();

            this.moveDirection = new Vector3(move.x, 0, move.z);

            const angle = Math.atan2(move.x, move.z);
            const targ = Quaternion.FromEulerAngles(0, angle, 0);
            this.mesh.rotationQuaternion = Quaternion.Slerp(this.mesh.rotationQuaternion, targ, 10 * this.deltaTime);
        }
    }

    /**
     * Setups all animations
     */
    setUpAnimations() {
        this.scene.stopAllAnimations();
        this.run.loopAnimation = true;
        this.idle.loopAnimation = true;

        this.currentAnim = this.idle;
        this.prevAnim = this.land;
    }

    /**
     * Starts and stops the animations
     */
    animatePlayer() {
        if (!this.ui.gamePaused) {
            if (!this.isFalling && !this.jumped && (this.input.horizontal !== 0 || this.input.vertical !== 0)) {
                this.currentAnim = this.run;
            } else if (this.jumped && !this.isFalling) {
                this.currentAnim = this.jump;
            } else if (!this.isFalling && this.grounded) {
                this.currentAnim = this.idle;
            } else if (this.isFalling) {
                this.currentAnim = this.land;
            }
        } else {
            this.currentAnim = this.idle;
        }

        if (this.currentAnim != null && this.prevAnim !== this.currentAnim) {
            this.prevAnim.stop();
            this.currentAnim.play(this.currentAnim.loopAnimation);
            this.prevAnim = this.currentAnim;
        }
    }

    /**
     * Sends a raycast down from the player, offset on the x and z axes
     * @returns the pick info
     */
    pickDown(offsetx, offsetz, length) {
        const origin = new Vector3(this.mesh.position.x + offsetx, this.mesh.position.y + 0.5, this.mesh.position.z + offsetz);
        const ray = new Ray(origin, Vector3.Down(), length);
        return this.scene.pickWithRay(ray, (mesh) => mesh.isPickable && mesh.isEnabled());
    }

    isGrounded() {
        return this.pickDown(0, 0, 0.6).hit;
    }

    /**
     * Sends 4 raycasts to the ground to detect when we are on a ramp
     * @returns boolean
     */
    checkSlope() {
        const offsets = [[0, 0.25], [0, -0.25], [0.25, 0], [-0.25, 0]];
        for (let i = 0; i < offsets.length; i += 1) {
            const pick = this.pickDown(...offsets[i], 1.5);
            if (pick.hit && (i === 0 || !pick.getNormal().equals(Vector3.Up()))) return pick.pickedMesh.name.includes('ramp');
        }
        return false;
    }

    /**
     * Calculates gravity and player speed using delta time
     * sets flags to know when the player is allowed to jump
     */
    updateGroundDetection() {
        this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        if (!this.isGrounded()) {
            if (this.checkSlope() && this.gravity.y <= 0) {
                this.gravity.y = 0;
                this.jumpCount = 1;
                this.grounded = true;
            } else {
                this.gravity = this.gravity.addInPlace(Vector3.Up().scale(Player.GRAVITY * this.deltaTime));
                this.grounded = false;
            }
        }
        if (this.gravity.y < -Player.JUMP_FORCE) {
            this.gravity.y = -Player.JUMP_FORCE;
        }

        if (this.gravity.y < 0 && this.jumped) {
            this.isFalling = true;
        }

        this.moveDirection = this.moveDirection.scaleInPlace(Player.PLAYER_SPEED * this.deltaTime);
        this.mesh.moveWithCollisions(this.moveDirection.addInPlace(this.gravity));

        if (this.isGrounded()) {
            this.gravity.y = 0;
            this.grounded = true;

            this.jumpCount = 1;

            this.jumped = false;
            this.isFalling = false;
        }

        if (this.input.jumpKeyDown && this.jumpCount > 0) {
            this.gravity.y = Player.JUMP_FORCE;
            this.jumpCount--;

            this.jumped = true;
            this.isFalling = false;
        }
    }

    beforeRenderUpdate() {
        this.updateFromControls();
        this.updateGroundDetection();
        this.animatePlayer();
    }

    activatePlayerCamera() {
        this.scene.registerBeforeRender(() => {
            this.beforeRenderUpdate();
        });
        return this.camera;
    }

    /**
     * Creates a camera and limits the camera movements
     * Adds collisions to the camera
     * @returns the camera
     */
    setupPlayerCamera() {
        this.camera = new ArcRotateCamera("Camera", 0, 0, 0, new Vector3(0, 0, 0), this.scene);

        this.camera.setPosition(new Vector3(-10, 5, 0));

        this.camera.lowerRadiusLimit = 4;
        this.camera.upperRadiusLimit = 8;

        this.camera.checkCollisions = true;
        this.camera.collisionRadius = new Vector3(0.1, 0.1, 0.1);

        this.camera.attachControl(this.canvas, true);

        this.camera.inputs.attached.keyboard.detachControl();

        return this.camera;
    }

    /**
     * Switches the camera between first and third person view
     * @param {ArcRotateCamera} camera The current camera
     * @param {boolean} enabled true for first person
     */
    static setFirstPerson(camera, enabled) {
        const cam = camera;
        cam.lowerRadiusLimit = enabled ? 1 : 4;
        cam.upperRadiusLimit = enabled ? 1 : 8;
        cam.checkCollisions = !enabled;
        cam.targetScreenOffset = new Vector2(0, enabled ? -2.4 : -3);
        cam.radius = enabled ? 0 : 8;
    }
}
