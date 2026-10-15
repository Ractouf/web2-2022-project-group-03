import { Color3, PointLight, SceneLoader, Sound, StandardMaterial, Vector3 } from '@babylonjs/core';
import level1 from '../models/seinecourt1.glb';
import level3 from '../models/seinecourt2.glb';
import level5 from '../models/seinecourt3.glb';
import level6 from '../models/seinefin.glb';
import level2 from '../models/seineplateform1.glb';
import level4 from '../models/seineplateform2.glb';
import music2 from '../sounds/music2.mp3';
import music3 from '../sounds/music3.mp3';
import music4 from '../sounds/music4.mp3';
import music5 from '../sounds/music5.mp3';
import music6 from '../sounds/music6.mp3';

const LEVELS = [
    [level1, music5],
    [level2, music2],
    [level3, music3],
    [level4, music4],
    [level5, music5],
    [level6, music6],
];

export const LAST_LEVEL = LEVELS.length;

/**
 * Loads the level mesh and music, and sets mesh properties based on naming conventions from Blender
 * @param {Scene} scene The current scene
 * @param {number} level The level to load, 1-based
 */
export default async function loadEnvironment(scene, level) {
    const [model, music] = LEVELS[level - 1];
    const result = await SceneLoader.ImportMeshAsync(null, model, undefined, scene);

    new Sound('music', music, scene, null, { loop: true, autoplay: true });

    result.meshes[0].getChildMeshes().forEach((m) => {
        const mesh = m;
        const { name } = mesh;
        mesh.checkCollisions = true;

        if (name.includes('stairs')) {
            mesh.checkCollisions = false;
            mesh.isPickable = false;
        }

        if (name.includes('fin') || name.includes('mort')) {
            mesh.checkCollisions = false;
            mesh.isPickable = false;
            mesh.isVisible = false;
        }

        if (name.includes('ramp') || name.includes('MUR')) mesh.isVisible = false;

        if (['leaves', 'aspirateur', 'air', 'bark', 'sky'].some((n) => name.includes(n))) mesh.checkCollisions = false;

        if (name.includes('bulb')) {
            const whiteMat = new StandardMaterial('whiteMat', scene);
            whiteMat.emissiveColor = Color3.White();
            whiteMat.alpha = 0.8;
            mesh.material = whiteMat;

            const light = new PointLight('sparklight', new Vector3(0, -1, 0), scene);
            light.intensity = 35;
            light.diffuse = Color3.White();
            light.parent = mesh;
        }
    });
}
