import * as THREE from 'three';

// Custom shader for instanced grass with wind and shadow support
const vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vHeight;

    uniform float time;
    uniform sampler2D cloudMap;
    uniform vec2 cloudOffset;
    uniform float cloudScale;

    attribute float aScale;
    
    // Simple wind noise function
    float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
        vUv = uv;
        
        // Instance transforms
        vec3 pos = position;
        
        // Scaling
        pos.y *= aScale;
        
        // Wind Simulation
        // Calculate global position for noise sampling
        vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        
        float windStrength = 0.5;
        float windSpeed = 1.0;
        
        // Multi-frequency wind
        float wave = sin(time * windSpeed + instancePos.x * 0.5 + instancePos.z * 0.5);
        float wave2 = cos(time * windSpeed * 1.5 + instancePos.x * 2.0);
        
        // Only move the top of the blade (uv.y > 0.0)
        float t = uv.y;
        float windX = t * t * (wave + wave2) * windStrength;
        float windZ = t * t * cos(time + instancePos.z) * windStrength * 0.5;

        pos.x += windX;
        pos.z += windZ;

        // Apply instance matrix
        vec4 worldPosition = instanceMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPosition.xyz;
        vHeight = pos.y;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
        
        // Shadow map support chunks usually injected here by three.js 
        // but for custom depth material we need separate shader.
        // This is main render shader.
    }
`;

const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vHeight;

    uniform sampler2D map;
    uniform sampler2D cloudMap;
    uniform vec2 cloudOffset;
    uniform float cloudScale;
    uniform vec3 sunColor;
    uniform vec3 ambientColor;

    void main() {
        // Base grass color (gradient from bottom to top)
        vec3 bottomColor = vec3(0.05, 0.2, 0.0);
        vec3 topColor = vec3(0.4, 0.7, 0.1);
        
        vec4 texColor = texture2D(map, vUv);
        if (texColor.a < 0.5) discard;

        vec3 color = mix(bottomColor, topColor, vUv.y);
        color *= texColor.rgb;

        // --- Cloud Shadow Logic ---
        // Sample cloud noise texture using world coordinates
        vec2 cloudUv = (vWorldPosition.xz * cloudScale) + cloudOffset;
        float cloudVal = texture2D(cloudMap, cloudUv).r;
        
        // Sharpen cloud edges for that "drifting patterns" look
        float shadowFactor = smoothstep(0.3, 0.7, cloudVal); 
        
        // Fake lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3)); // Match sun
        float diff = max(dot(vec3(0.0, 1.0, 0.0), lightDir), 0.0);
        
        // Combine Light
        // If in cloud shadow, reduce diffuse light significantly
        vec3 finalLight = ambientColor + (sunColor * diff * shadowFactor);
        
        // Specular/Translucency for grass
        // Sun shining through back of blade
        float viewDot = dot(normalize(vWorldPosition), lightDir);
        float translucency = pow(max(viewDot, 0.0), 2.0) * shadowFactor * 0.5;
        
        gl_FragColor = vec4(color * finalLight + (vec3(0.8, 0.9, 0.2) * translucency), 1.0);
        
        // Simple fog
        float depth = gl_FragCoord.z / gl_FragCoord.w;
        float fogFactor = smoothstep(20.0, 100.0, depth);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.6, 0.7, 0.8), fogFactor);
        
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export function createGrass(count, texture, cloudTexture) {
    const geometry = new THREE.PlaneGeometry(0.5, 2.0, 1, 4); // Divided height for bending
    geometry.translate(0, 1.0, 0); // Pivot at bottom

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            map: { value: texture },
            cloudMap: { value: cloudTexture },
            cloudOffset: { value: new THREE.Vector2(0, 0) },
            cloudScale: { value: 0.005 },
            sunColor: { value: new THREE.Color(1.5, 1.4, 1.0) }, // Bright sun
            ambientColor: { value: new THREE.Color(0.2, 0.3, 0.4) }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.DoubleSide,
        transparent: false // Alpha test used in shader
    });

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const scales = [];

    for (let i = 0; i < count; i++) {
        // Random position within a 100x100 area
        const x = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;
        
        dummy.position.set(x, 0, z);
        
        // Random rotation
        dummy.rotation.y = Math.random() * Math.PI * 2;
        
        // Varying scale
        const s = 0.8 + Math.random() * 0.8;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        
        mesh.setMatrixAt(i, dummy.matrix);
        scales.push(s);
    }
    
    // Add custom attribute for scale if needed in shader (we used instanceMatrix scale but explicit is sometimes safer)
    geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array(scales), 1));

    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: texture,
        alphaTest: 0.5
    });
    
    // Hook up wind animation
    mesh.onBeforeRender = function(renderer, scene, camera, geometry, material, group) {
        material.uniforms.time.value = performance.now() / 1000;
    };

    return mesh;
}

