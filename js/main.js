import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

import { PlayerControls } from './controls.js';
import { createGrass } from './grass.js';
import { createTerrain, createSky } from './scene.js';
import { LightingSystem } from './lighting.js';

// Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x99c1f1, 0.008); // Atmospheric perspective

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance on 4k
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
container.appendChild(renderer.domElement);

// Loading Manager
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

loadingManager.onLoad = () => {
    document.getElementById('loading').style.display = 'none';
    init();
};

// Assets
const texGround = textureLoader.load('ground.png');
texGround.wrapS = texGround.wrapT = THREE.RepeatWrapping;
texGround.repeat.set(16, 16);

const texGrass = textureLoader.load('grass_blade.png');
const texClouds = textureLoader.load('cloud_noise.png');
texClouds.wrapS = texClouds.wrapT = THREE.RepeatWrapping;

// Audio
const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('wind_ambience.mp3', function(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.5);
    // sound.play(); // Requires interaction
});

document.addEventListener('click', () => {
    if(sound.context.state === 'suspended') sound.context.resume();
    if(!sound.isPlaying) sound.play();
}, { once: true });


// Globals
let controls, lighting, composer, grassMesh, terrainMesh;
const clock = new THREE.Clock();

function init() {
    // 1. Scene Objects
    const sky = createSky();
    scene.add(sky);

    terrainMesh = createTerrain(texGround, texClouds);
    scene.add(terrainMesh);

    // High count for "Instanced 4k" look - reduced slightly for safety on mobile
    // 100,000 blades is usually safe on modern mid-range GPU
    grassMesh = createGrass(80000, texGrass, texClouds);
    scene.add(grassMesh);

    // 2. Lighting & Shadows (CSM)
    lighting = new LightingSystem(scene, camera, renderer);

    // 3. Controls
    controls = new PlayerControls(camera, renderer.domElement);

    // 4. Post Processing (The "RTX" Look)
    composer = new EffectComposer(renderer);
    
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // SSAO for contact shadows between grass and ground
    const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 16;
    ssaoPass.minDistance = 0.005;
    ssaoPass.maxDistance = 0.1;
    // composer.addPass(ssaoPass); // SSAO is very heavy with grass opacity, might cause artifacts. Disabled for cleaner alpha.

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.7; // Only bloom very bright spots (specular highlights on grass)
    bloomPass.strength = 0.3;
    bloomPass.radius = 0.5;
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // 5. Events
    window.addEventListener('resize', onWindowResize);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    if(lighting && lighting.csm) lighting.csm.updateFrustums();
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    controls.update(delta);
    lighting.update(delta, time);

    // Update custom shader uniforms
    if (grassMesh) {
        grassMesh.material.uniforms.cloudOffset.value.copy(lighting.cloudOffset);
    }
    if (terrainMesh && terrainMesh.material.userData.shader) {
        terrainMesh.material.userData.shader.uniforms.cloudOffset.value.copy(lighting.cloudOffset);
    }

    // Render via Composer
    composer.render();
}

