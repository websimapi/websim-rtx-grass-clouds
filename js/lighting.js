import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { CSMHelper } from 'three/addons/csm/CSMHelper.js';

export class LightingSystem {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.cloudOffset = new THREE.Vector2(0,0);
        this.windSpeed = new THREE.Vector2(0.5, 0.2); // Drifting clouds

        // Ambient (Bounce light sim)
        this.ambientLight = new THREE.HemisphereLight(0x87CEEB, 0x3d4d3d, 0.3);
        this.scene.add(this.ambientLight);

        // Directional Sun for shadows
        this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
        this.sun.position.set(-50, 80, -50);
        this.sun.castShadow = true;
        
        // Basic shadow map settings if CSM fails or as fallback
        this.sun.shadow.mapSize.width = 4096;
        this.sun.shadow.mapSize.height = 4096;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 500;
        this.sun.shadow.bias = -0.0005;
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);

        // Configure CSM (Cascaded Shadow Maps) for high quality shadows at all distances
        this.csm = new CSM({
            maxFar: 200,
            cascades: 4,
            mode: 'practical',
            parent: scene,
            shadowMapSize: 2048,
            lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
            camera: camera
        });
        
        // Adjust CSM fade
        this.csm.fade = true;
    }

    update(delta, time) {
        // Animate Sun position for "Living World" feel? 
        // Let's keep it fixed at a dramatic angle for now as requested (Golden hour-ish)
        // Or slowly rotate it.
        // const angle = time * 0.05;
        // this.csm.lightDirection = new THREE.Vector3(Math.sin(angle), -1, Math.cos(angle)).normalize();
        
        this.csm.update();

        // Update Cloud Offset
        this.cloudOffset.x += this.windSpeed.x * delta;
        this.cloudOffset.y += this.windSpeed.y * delta;
    }
}

