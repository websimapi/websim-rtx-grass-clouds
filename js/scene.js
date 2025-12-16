import * as THREE from 'three';

export function createTerrain(texture, cloudTexture) {
    const geometry = new THREE.PlaneGeometry(300, 300, 256, 256);
    geometry.rotateX(-Math.PI / 2);

    // Add some noise displacement to geometry
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        // Simple rolling hills
        const y = (Math.sin(x * 0.05) + Math.cos(z * 0.05)) * 1.5 
                + (Math.sin(x * 0.2) + Math.cos(z * 0.2)) * 0.2;
        pos.setY(i, y);
    }
    geometry.computeVertexNormals();

    const material = new THREE.StandardMaterial({ 
        map: texture,
        roughness: 0.9,
        metalness: 0.1,
        color: 0x88aa88
    });

    // Inject cloud shadows into standard material
    material.onBeforeCompile = (shader) => {
        shader.uniforms.cloudMap = { value: cloudTexture };
        shader.uniforms.cloudOffset = { value: new THREE.Vector2(0, 0) };
        shader.uniforms.cloudScale = { value: 0.005 };
        
        // Add uniforms
        shader.vertexShader = `
            varying vec3 vWorldPos;
            ${shader.vertexShader}
        `.replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
             vWorldPos = (modelMatrix * vec4( transformed, 1.0 )).xyz;`
        );

        shader.fragmentShader = `
            uniform sampler2D cloudMap;
            uniform vec2 cloudOffset;
            uniform float cloudScale;
            varying vec3 vWorldPos;
            ${shader.fragmentShader}
        `.replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            
            // Sample cloud noise
            vec2 cloudUv = (vWorldPos.xz * cloudScale) + cloudOffset;
            float cloudVal = texture2D(cloudMap, cloudUv).r;
            float shadowStrength = smoothstep(0.4, 0.6, cloudVal); // Contrast for clouds

            // Darken diffuse color based on cloud shadow
            vec3 cloudShadowColor = vec3(0.4, 0.4, 0.5); // Bluish shadow
            diffuseColor.rgb = mix(diffuseColor.rgb * cloudShadowColor, diffuseColor.rgb, shadowStrength);
            `
        );
        
        // Keep reference to update uniforms
        material.userData.shader = shader;
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true; // Terrain casts self-shadows

    return mesh;
}

export function createSky() {
    // Simple gradient sky or large sphere
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, '#1e4877'); // Deep Blue Zenith
    grad.addColorStop(0.5, '#4584b4'); 
    grad.addColorStop(1.0, '#99c1f1'); // Hazy Horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false });
    const geo = new THREE.SphereGeometry(400, 32, 32);
    
    return new THREE.Mesh(geo, material);
}

