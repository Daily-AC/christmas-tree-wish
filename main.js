import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

console.log('Main.js loaded. Initializing Three.js scene...');

// --- 1. Scene Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// --- 2. Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 + 0.2; // Don't go too far below ground

// --- 3. Post-processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.4; // Higher threshold = only bright lights bloom
bloomPass.strength = 1.0; // Lower strength
bloomPass.radius = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- 4. Refined Particle System (Aesthetics) ---
const PARTICLE_COUNT = 45000; // Increased density
const particleGeometry = new THREE.BufferGeometry();

const treePositions = new Float32Array(PARTICLE_COUNT * 3);
const scatterPositions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);
const randoms = new Float32Array(PARTICLE_COUNT * 3); // For individual noise offset

// Advanced Palette (HSL based essentially)
const c_green_deep = new THREE.Color('#0b4f18');
const c_green_light = new THREE.Color('#388e3c');
const c_gold = new THREE.Color('#ffd700');
const c_red = new THREE.Color('#d32f2f');
const c_white = new THREE.Color('#fcfcfc');

const tempColor = new THREE.Color();

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // --- Tree Formation (More Organic Cone) ---
    const y = Math.random() * 20 - 10; 
    const level = (10 - y) / 20; // 0 (top) to 1 (bottom)
    
    // Non-perfect cone: slightly curved
     const radiusBase = level * 7.5;
    const angle = y * 6.0 + Math.random() * 6.28; // Tighter spiral
    
    // Volumetric thickness
    const rOffset = Math.random() * 1.5 * level;
    
    treePositions[i3] = Math.cos(angle) * (radiusBase + rOffset);
    treePositions[i3 + 1] = y;
    treePositions[i3 + 2] = Math.sin(angle) * (radiusBase + rOffset);

    // --- Scatter Formation (Cosmic Flow) ---
    // Instead of random sphere, make it a wide galaxy-like disk or field
    const rScatter = 15 + Math.random() * 25;
    const aScatter = Math.random() * 6.28;
    // Flat-ish spread
    scatterPositions[i3] = Math.cos(aScatter) * rScatter;
    scatterPositions[i3 + 1] = (Math.random() - 0.5) * 10; // Less vertical spread
    scatterPositions[i3 + 2] = Math.sin(aScatter) * rScatter;

    // --- Colors & Logic ---
    const rand = Math.random();
    let size = 1.0;
    
    if (rand > 0.96) {
        // Gold Lights (Top tier)
        tempColor.copy(c_gold);
        size = 3.5 + Math.random() * 2.0;
    } else if (rand > 0.94) {
        // Red Ornaments
        tempColor.copy(c_red);
        size = 3.0 + Math.random();
    } else if (rand > 0.90) {
        // White snow/sparkle
        tempColor.copy(c_white);
        size = 2.0 + Math.random();
    } else {
        // Leaves (Gradient)
        tempColor.copy(c_green_deep).lerp(c_green_light, Math.random() * 0.7);
        // Make leaves smaller for better look
        size = 0.8 + Math.random() * 1.2;
    }
    
    colors[i3] = tempColor.r;
    colors[i3 + 1] = tempColor.g;
    colors[i3 + 2] = tempColor.b;
    
    sizes[i] = size;
    
    randoms[i3] = Math.random();
    randoms[i3+1] = Math.random();
    randoms[i3+2] = Math.random();
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(treePositions, 3));
particleGeometry.setAttribute('targetPosition', new THREE.BufferAttribute(scatterPositions, 3));
particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
particleGeometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

// Curl Noise Shader
const vertexShader = `
    uniform float uTime;
    uniform float uMix;
    uniform float uPixelRatio;
    
    attribute vec3 targetPosition;
    attribute vec3 color;
    attribute float size;
    attribute vec3 aRandom;
    
    varying vec3 vColor;
    varying float vAlpha;
    
    // Simplex Noise (Simplified)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i); 
        vec4 p = permute( permute( permute( 
            i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            
        float n_ = 0.142857142857; 
        vec3  ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ ); 
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        vColor = color;
        
        // Non-linear mix
        // Use a curve for uMix to make it snap or ease
        float t = uMix;
        
        // Basic interpolation
        vec3 pos = mix(position, targetPosition, t);
        
        // Add Curl/Turbulence when Scatter (uMix > 0)
        float noiseScale = 0.1;
        float noiseTime = uTime * 0.5;
        
        // Different noise for different axis with offsets
        float nX = snoise(vec3(pos.x * noiseScale, pos.y * noiseScale, noiseTime + aRandom.x));
        float nY = snoise(vec3(pos.x * noiseScale, pos.y * noiseScale, noiseTime + aRandom.y + 10.0));
        float nZ = snoise(vec3(pos.x * noiseScale, pos.y * noiseScale, noiseTime + aRandom.z + 20.0));
        
        // Apply noise primarily when scattering to simulate "Floating"
        float turbulence = t * 2.0; 
        pos.x += nX * turbulence;
        pos.y += nY * turbulence;
        pos.z += nZ * turbulence;
        
        // Spiral rotation for Tree when forming
        if (t < 0.5) {
            float rot = uTime * 0.1;
            float cx = pos.x * cos(rot) - pos.z * sin(rot);
            float cz = pos.x * sin(rot) + pos.z * cos(rot);
            pos.x = cx;
            pos.z = cz;
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Depth-based size attenuation
        gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
        
        // Fade out particles that are too close or too far for DOF effect (fake)
        // or just alpha
        vAlpha = 1.0;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
        // Soft Glow Particle
        vec2 xy = gl_PointCoord.xy - vec2(0.5);
        float r = length(xy);
        if (r > 0.5) discard;
        
        // Soft edge
        float glow = 1.0 - (r * 2.0);
        glow = pow(glow, 1.5); // sharpen a bit
        
        gl_FragColor = vec4(vColor, vAlpha * glow);
    }
`;

const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMix: { value: 0.0 }, 
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

const state = {
    gesture: 'loading', // loading, closed, open, none
    targetMix: 0.0, // 0 = Tree, 1 = Scatter
    lastVideoTime: -1,
};


// --- 6. MediaPipe Integration ---
let handLandmarker = undefined;
const video = document.getElementById('webcam');

// Initialize HandLandmarker
async function createHandLandmarker() {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
        });
        console.log("HandLandmarker created.");
        
        // Start Webcam
        enableCam();
    } catch (e) {
        console.error("Error creating HandLandmarker:", e);
        alert("无法加载手势识别模型，请刷新重试。");
    }
}

function enableCam() {
    if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("getUserMedia() not supported.");
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        
        // Hide loading text
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerText = "准备就绪！请对准摄像头：\n🖐️张开手 = 粒子炸裂  |  ✊握拳 = 变回圣诞树";
            setTimeout(() => loading.classList.add('hidden'), 5000);
        }
    }); 
}

// Gesture Prediction Logic
// Determine if hand is Open or Closed based on distance ratio to handle depth variations
function detectGesture(landmarks) {
    if (!landmarks || landmarks.length === 0) return 'none';

    // Helper to calculate distance
    const dist = (p1, p2) => {
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) + 
            Math.pow(p1.y - p2.y, 2) + 
            Math.pow(p1.z - p2.z, 2)
        );
    };

    const wrist = landmarks[0];
    
    // Check 4 fingers (Index to Pinky)
    // Tips: 8, 12, 16, 20
    // PIPs (Middle Joint): 6, 10, 14, 18 (Using PIP or MCP as shorter reference)
    // MCPs (Knuckles): 5, 9, 13, 17
    
    // We compare distance (Wrist -> Tip) vs (Wrist -> MCP)
    // Extended: Tip is much further than MCP.
    // Curled: Tip is close to MCP distance or closer.
    
    const fingerIndices = [
        { tip: 8, mcp: 5 },  // Index
        { tip: 12, mcp: 9 }, // Middle
        { tip: 16, mcp: 13 },// Ring
        { tip: 20, mcp: 17 } // Pinky
    ];
    
    let extendedCount = 0;
    
    fingerIndices.forEach(({tip, mcp}) => {
        const dTip = dist(landmarks[tip], wrist);
        const dMcp = dist(landmarks[mcp], wrist);
        
        // Ratio > 1.3 usually means extended. < 1.2 usually means curled.
        if (dTip > dMcp * 1.5) {
            extendedCount++;
        }
    });

    // Determine state
    // 0 or 1 extended -> Closed
    // 3 or 4 extended -> Open
    
    if (extendedCount >= 3) return 'open';
    if (extendedCount <= 1) return 'closed';
    
    return 'none'; // Ambiguous
}

async function predictWebcam() {
    // Resize logic for video if needed, but we used hidden video so just size consistency matters little
    
    if (handLandmarker && video.currentTime !== state.lastVideoTime) {
        state.lastVideoTime = video.currentTime;
        const startTimeMs = performance.now();
        const results = handLandmarker.detectForVideo(video, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
            // Check the first detected hand
            const gesture = detectGesture(results.landmarks[0]);
            
            if (gesture === 'open') {
                state.targetMix = 1.0; // Scatter
            } else if (gesture === 'closed') {
                state.targetMix = 0.0; // Tree
            }
            state.gesture = gesture;
        } else {
            // No hands detected? Maybe slowly return to Tree?
            // Or keep last state? Let's slowly return to tree for "Idle" mode
            state.targetMix = Math.max(0, state.targetMix - 0.02);
            state.gesture = 'none';
        }
    }
    
    // Call next frame via requestAnimationFrame inside animate loop instead? 
    // Usually standard to request again here for video frame loop, but we can just invoke via main animate
    window.requestAnimationFrame(predictWebcam);
}


// Start everything
createHandLandmarker();

// --- 7. Animation Loop ---

// --- 5. Resize Handler ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- 6. Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    // Update time
    particleMaterial.uniforms.uTime.value += 0.01;
    
    // Smooth transition logic
    // We will update state.targetMix based on gestures later
    // For now, let's create a simple auto-test if needed, or just let it recognize static var
    
    // Linear interpolation for smooth transition
    particleMaterial.uniforms.uMix.value += (state.targetMix - particleMaterial.uniforms.uMix.value) * 0.05;

    controls.update();
    composer.render();
}

animate();

// Remove loading screen for now
setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
}, 1000);
