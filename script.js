import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// --- Global Configuration & State ---
const CONFIG = {
    treeHeight: 25,
    treeRadius: 10,
    particleCount: 1500, // Main instanced mesh
    dustCount: 2500,     // Background dust
    cameraPos: new THREE.Vector3(0, 2, 45)
};

const STATE = {
    mode: 'TREE', // TREE, SCATTER, FOCUS
    targetPhoto: null,
    handDetected: false,
    handRotation: new THREE.Vector2(0, 0),
    gesture: 'NONE' // NONE, PINCH, FIST, OPEN
};

// --- Main Classes ---

class ChristmasApp {
    constructor() {
        this.container = document.body;
        this.canvas = document.getElementById('mainCanvas');
        this.clock = new THREE.Clock();
        
        this.initThree();
        this.initPostProcessing();
        this.initContent();
        this.initInputs();
        this.initMediaPipe();
        
        this.animate();
    }

    initThree() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 2.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Scene & Camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.copy(CONFIG.cameraPos);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        const pointLight = new THREE.PointLight(0xffaa00, 2, 20); 
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);

        const spotGold = new THREE.SpotLight(0xd4af37, 1000);
        spotGold.position.set(30, 40, 40);
        spotGold.angle = Math.PI / 6;
        spotGold.penumbra = 0.5;
        spotGold.castShadow = true;
        this.scene.add(spotGold);

        const spotBlue = new THREE.SpotLight(0x0044aa, 500);
        spotBlue.position.set(-30, 20, -30); 
        this.scene.add(spotBlue);
        
        // Root Container
        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);
        
        // --- Eternal Galaxy Background ---
        this.initGalaxyBackground();

        // Resize Handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
            // Update shader uniforms resolution if needed
            if(this.bgMaterial) {
                this.bgMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
            }
        });
    }
    
    initGalaxyBackground() {
        // Fullscreen quad at the back
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        const uniforms = {
            time: { value: 0 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        // Shader based on simple noise and nebula colors
        const fragmentShader = `
            uniform float time;
            uniform vec2 resolution;
            varying vec2 vUv;

            // Simplex Noise (simplified)
            vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
            float snoise(vec2 v){
              const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
              vec2 i  = floor(v + dot(v, C.yy) );
              vec2 x0 = v - i + dot(i, C.xx);
              vec2 i1;
              i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
              vec4 x12 = x0.xyxy + C.xxzz;
              x12.xy -= i1;
              i = mod(i, 289.0);
              vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
              + i.x + vec3(0.0, i1.x, 1.0 ));
              vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
              m = m*m ;
              m = m*m ;
              vec3 x = 2.0 * fract(p * C.www) - 1.0;
              vec3 h = abs(x) - 0.5;
              vec3 ox = floor(x + 0.5);
              vec3 a0 = x - ox;
              m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
              vec3 g;
              g.x  = a0.x  * x0.x  + h.x  * x0.y;
              g.yz = a0.yz * x12.xz + h.yz * x12.yw;
              return 130.0 * dot(m, g);
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                // Aspect ratio fix
                uv.x *= resolution.x / resolution.y;
                
                // Slow drift
                float t = time * 0.05;
                
                // Layers of nebula
                float n1 = snoise(uv * 1.5 + vec2(t*0.5, t*0.2));
                float n2 = snoise(uv * 3.0 - vec2(t*0.2, t*0.8));
                float n3 = snoise(uv * 6.0 + vec2(t, -t));
                
                float stars = pow(max(0.0, snoise(uv * 20.0 + vec2(t * 0.1))), 20.0) * 1.0;
                
                // Colors: Deep Blue/Purple/Gold
                vec3 c1 = vec3(0.0, 0.05, 0.2); // Deep Blue
                vec3 c2 = vec3(0.1, 0.0, 0.2);  // Purple
                vec3 c3 = vec3(0.6, 0.4, 0.1);  // Gold dust
                
                float mix1 = smoothstep(-0.5, 1.0, n1);
                float mix2 = smoothstep(-0.5, 1.0, n2);
                
                vec3 col = mix(c1, c2, mix1);
                col += c3 * max(0.0, n3) * 0.3; // Add gold dust
                col += vec3(stars); // Add stars
                
                // Vignette
                float dist = length(vUv - 0.5);
                col *= smoothstep(1.2, 0.2, dist);

                gl_FragColor = vec4(col, 1.0);
            }
        `;

        this.bgMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            depthWrite: false
        });

        const bgMesh = new THREE.Mesh(geometry, this.bgMaterial);
        // Add to separate scene or put it way back?
        // Since we use RoomEnvironment and standard pipeline, simpler to put it far away in scene.
        this.scene.background = new THREE.Color(0x000000); // Fallback
        
        // Actually, to make it display behind everything, we can render it first or put it far back.
        // Let's create a Background Scene for renderPass?
        // Simpler: Just a big plane way back attached to camera.
        this.scene.add(bgMesh);
        // Wait, screen quad logic needs to be attached to camera or use Orthographic cam.
        // Let's us simple skybox sphere instead? No, user wants shader.
        // Let's use Background property workarounds or just render quad.
        
        // Proper way: Put mesh in scene, attached to camera, drawn first.
        bgMesh.frustumCulled = false;
        // Make it huge and far
        bgMesh.position.z = -100;
        bgMesh.scale.set(300, 300, 1);
        this.scene.add(bgMesh); // Add to scene
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6, // Strength increased for galaxy glow
            0.4,  
            0.5   // Lower threshold for galaxy
        );
        this.composer.addPass(bloomPass);
    }
    
    initContent() {
        this.particleSystem = new ParticleManager(this.mainGroup, CONFIG.particleCount);
    }

    handleGestures(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            STATE.handDetected = true;
            const lm = results.landmarks[0]; 

            const palm = lm[9];
            const targetRotX = (palm.y - 0.5) * 1.5; 
            const targetRotY = (palm.x - 0.5) * 2.5; 
            
            STATE.handRotation.x += (targetRotX - STATE.handRotation.x) * 0.1;
            STATE.handRotation.y += (targetRotY - STATE.handRotation.y) * 0.1;

            const thumb = lm[4];
            const index = lm[8];
            const wrist = lm[0];
            const tips = [lm[8], lm[12], lm[16], lm[20]]; 

            const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
            let avgTipDist = 0;
            tips.forEach(t => avgTipDist += Math.hypot(t.x - wrist.x, t.y - wrist.y));
            avgTipDist /= 4;

            // --- IMPROVED GESTURE LOGIC ---
            // 1. Prioritize PINCH (Focus)
            if (pinchDist < 0.05) {
                STATE.gesture = 'PINCH';
                STATE.mode = 'FOCUS';
                this.particleSystem.triggerFocus();
            } 
            // 2. OPEN HAND (Scatter) - Increased threshold strictly
            else if (avgTipDist > 0.45) { 
                STATE.gesture = 'OPEN';
                STATE.mode = 'SCATTER';
            } 
            // 3. FIST (Tree) - Relaxed threshold, easier to trigger
            else if (avgTipDist < 0.25) { 
                STATE.gesture = 'FIST';
                STATE.mode = 'TREE';
            } 
            else {
                STATE.gesture = 'NONE';
                // Important: Default fallthrough!
                // If hand is just chilling, default back to TREE gently.
                // Don't 'stick' in Scatter mode.
                if (STATE.mode === 'SCATTER') {
                     STATE.mode = 'TREE'; // Auto-recover
                }
            }

        } else {
            STATE.handDetected = false;
            // No hand? Always TREE.
            STATE.mode = 'TREE';
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Update Shader
        if(this.bgMaterial) {
            this.bgMaterial.uniforms.time.value = time;
        }

        if (STATE.handDetected) {
            this.mainGroup.rotation.x = STATE.handRotation.x;
            this.mainGroup.rotation.y = STATE.handRotation.y;
        } else {
            this.mainGroup.rotation.y += 0.002;
            this.mainGroup.rotation.x = Math.sin(time * 0.5) * 0.05;
        }

        this.particleSystem.update(delta, time, STATE.mode);
        this.composer.render();
    }

        // 1. Instanced Mesh Particles (Gold Boxes & Spheres)
        const boxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const sphereGeo = new THREE.SphereGeometry(0.25, 16, 16);
        
        const goldMat = new THREE.MeshStandardMaterial({ 
            color: 0xd4af37, roughness: 0.1, metalness: 0.9 
        });
        const greenMat = new THREE.MeshStandardMaterial({ 
            color: 0x003300, roughness: 0.8, metalness: 0.1 
        });
        const redMat = new THREE.MeshPhysicalMaterial({
            color: 0xaa0000, roughness: 0.2, metalness: 0.1, clearcoat: 1.0
        });

        // We'll manage particles in a custom class for State Machine logic
        this.particleSystem = new ParticleManager(this.mainGroup, CONFIG.particleCount);
    }

    initInputs() {
        // UI Logic
        const uiContainer = document.getElementById('ui-container');
        window.addEventListener('keydown', (e) => {
            if(e.key.toLowerCase() === 'h') {
                uiContainer.classList.toggle('ui-hidden');
            }
        });

        // File Upload
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        uploadBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            if(e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    new THREE.TextureLoader().load(ev.target.result, (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;
                        this.particleSystem.addPhoto(texture);
                    });
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }

    async initMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });

        const video = document.getElementById('webcam');
        
        // Start Webcam
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            video.addEventListener('loadeddata', () => {
                this.predictWebcam();
                // Remove Loading Screen
                const loader = document.getElementById('loader');
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 1000);
            });
        } catch (err) {
            console.warn("Webcam access denied", err);
             // Remove Loader anyway for non-camera users
            const loader = document.getElementById('loader');
            if(loader) loader.remove();
        }
    }

    async predictWebcam() {
        const video = document.getElementById('webcam');
        if(!video) return;

        let lastVideoTime = -1;
        
        const renderLoop = async () => {
            if(video.currentTime !== lastVideoTime) {
                lastVideoTime = video.currentTime;
                const results = this.handLandmarker.detectForVideo(video, performance.now());
                this.handleGestures(results);
            }
            requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    handleGestures(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            STATE.handDetected = true;
            const lm = results.landmarks[0]; // First hand

            // 1. Map Position (Landmark 9 is wrist/palm centerish. 0 is wrist)
            const palm = lm[9];
            // Smooth lerp for rotation
            const targetRotX = (palm.y - 0.5) * 1.5; // Up/Down
            const targetRotY = (palm.x - 0.5) * 2.5; // Left/Right
            
            STATE.handRotation.x += (targetRotX - STATE.handRotation.x) * 0.1;
            STATE.handRotation.y += (targetRotY - STATE.handRotation.y) * 0.1;

            // 2. Gesture Recognition
            const thumb = lm[4];
            const index = lm[8];
            const wrist = lm[0];
            const tips = [lm[8], lm[12], lm[16], lm[20]]; // Index, Middle, Ring, Pinky

            // Calc distances
            const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
            
            // Avg dist from tips to wrist (for Fist/Open)
            let avgTipDist = 0;
            tips.forEach(t => avgTipDist += Math.hypot(t.x - wrist.x, t.y - wrist.y));
            avgTipDist /= 4;

            // --- IMPROVED GESTURE LOGIC ---
            // 1. Prioritize PINCH (Focus)
            if (pinchDist < 0.05) {
                STATE.gesture = 'PINCH';
                STATE.mode = 'FOCUS';
                this.particleSystem.triggerFocus();
            } 
            // 2. OPEN HAND (Scatter) - Increased threshold to 0.45 to prevent accidental scatter
            else if (avgTipDist > 0.45) { 
                STATE.gesture = 'OPEN';
                STATE.mode = 'SCATTER';
            } 
            // 3. FIST (Tree) - Relaxed threshold to 0.25 (easier to form)
            else if (avgTipDist < 0.25) { 
                STATE.gesture = 'FIST';
                STATE.mode = 'TREE';
            } 
            else {
                STATE.gesture = 'NONE';
                // Auto-Recover: If user is neutral or confused, default back to TREE
                // This fixes the "stuck in Scatter" issue.
                if (STATE.mode === 'SCATTER' || STATE.mode === 'FOCUS') {
                     // Add a small delay/debounce logic if needed, but linear lerp handles smoothness.
                     // Simply setting it to TREE makes it feel "elastic"
                     STATE.mode = 'TREE'; 
                }
            }
            
        } else {
            STATE.handDetected = false;
            // No hand present? Always revert to Tree
            STATE.mode = 'TREE';
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Update Shader Time
        if(this.bgMaterial) {
            this.bgMaterial.uniforms.time.value = time;
        }

        // Global Scene Rotation (Autospin or Hand Control)
        if (STATE.handDetected) {
            // Hand control
            this.mainGroup.rotation.x = STATE.handRotation.x;
            this.mainGroup.rotation.y = STATE.handRotation.y;
        } else {
            // Auto idle spin
            this.mainGroup.rotation.y += 0.002;
            // Gentle float
            this.mainGroup.rotation.x = Math.sin(time * 0.5) * 0.05;
        }

        // Update Particle System
        this.particleSystem.update(delta, time, STATE.mode);

        this.composer.render();
    }
}

// --- Particle Manager Logic ---
class ParticleManager {
    constructor(parentDetails, count) {
        this.items = [];
        this.parent = parentDetails;
        
        // Materials
        this.goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.1, metalness: 0.9 });
        this.redMat = new THREE.MeshPhysicalMaterial({ color: 0xaa0000, roughness: 0.2, metalness: 0.1, clearcoat: 1.0 });
        this.greenMat = new THREE.MeshStandardMaterial({ color: 0x114411, roughness: 0.8 });
        
        // Geometries
        this.boxGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        this.sphereGeo = new THREE.SphereGeometry(0.2, 16, 16);

        // Generate Decoration Particles
        for(let i=0; i<count; i++) {
            const mesh = new THREE.Mesh(
                Math.random() > 0.5 ? this.boxGeo : this.sphereGeo,
                Math.random() > 0.7 ? this.goldMat : (Math.random() > 0.5 ? this.redMat : this.greenMat)
            );
            
            mesh.userData = {
                // Tree Target
                treePos: this.calculateTreePos(i, count),
                // Scatter Target
                scatterPos: this.calculateScatterPos(),
                // Velocity for scatter
                rotationSpeed: new THREE.Vector3(
                    Math.random()-0.5, Math.random()-0.5, Math.random()-0.5
                ).multiplyScalar(2.0),
                type: 'PARTICLE'
            };
            
            // Init Pos
            mesh.position.copy(mesh.userData.treePos);
            mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);

            this.parent.add(mesh);
            this.items.push(mesh);
        }

        // Default Photo
        this.createDefaultPhoto();
    }

    createDefaultPhoto() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,512,512);
        ctx.fillStyle = '#d4af37';
        ctx.font = 'bold 60px Times New Roman';
        ctx.textAlign = 'center';
        ctx.fillText('JOYEUX', 256, 200);
        ctx.fillText('NOEL', 256, 300);
        
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        this.addPhoto(tex);
    }

    addPhoto(texture) {
        const geo = new THREE.BoxGeometry(3, 4, 0.2); // Frame depth
        
        // Materials: Gold Frame + Photo Facade
        const frameMat = this.goldMat;
        const photoMat = new THREE.MeshBasicMaterial({ map: texture });
        
        const mesh = new THREE.Mesh(geo, [
            frameMat, frameMat, frameMat, frameMat, // sides
            photoMat, // front
            frameMat  // back
        ]);

        mesh.userData = {
            treePos: this.calculateTreePos(Math.random() * 1000, 1000, true), // On surface
            scatterPos: this.calculateScatterPos(),
            rotationSpeed: new THREE.Vector3(0.5, 0.5, 0.5),
            type: 'PHOTO'
        };
        
        mesh.position.copy(mesh.userData.treePos);
        this.parent.add(mesh);
        this.items.push(mesh);
    }

    calculateTreePos(i, total, surfaceOnly = false) {
        const t = i / total;
        // Spiral
        const angle = t * Math.PI * 2 * 12; // 12 turns
        const h = t * CONFIG.treeHeight;
        
        // Cone radius at height h
        // Base is at y=-10, Top at y=15
        // Let's center it: y from -12 to +12
        const y = (t * CONFIG.treeHeight) - (CONFIG.treeHeight / 2);
        
        // Radius: Wide at bottom, narrow at top
        const progress = 1 - t; // 1 at bottom, 0 at top
        let r = progress * CONFIG.treeRadius;
        
        if (!surfaceOnly) {
            // Fill volume
            r *= Math.sqrt(Math.random()); 
        }

        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        
        return new THREE.Vector3(x, y, z);
    }

    calculateScatterPos() {
        // Random sphere shell 10~25
        const r = 10 + Math.random() * 15;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        
        return new THREE.Vector3(x, y, z);
    }
    
    triggerFocus() {
        // Find a random photo to focus
        const photos = this.items.filter(i => i.userData.type === 'PHOTO');
        if (photos.length > 0) {
            const target = photos[Math.floor(Math.random() * photos.length)];
            STATE.targetPhoto = target;
        }
    }

    update(delta, time, mode) {
        // Lerp factor
        const lerpFactor = 2.0 * delta; 
        
        this.items.forEach(mesh => {
            let targetPos;
            let targetRot = null;
            let targetScale = 1;

            if (mode === 'TREE') {
                targetPos = mesh.userData.treePos;
                // Look at center-ish?
                // Just use identity rotation or stored?
                // For randomness:
                // mesh.rotation.y += delta; // Spin in place?
            } 
            else if (mode === 'SCATTER') {
                targetPos = mesh.userData.scatterPos;
                // Rotate wildly
                mesh.rotation.x += mesh.userData.rotationSpeed.x * delta;
                mesh.rotation.y += mesh.userData.rotationSpeed.y * delta;
            }
            else if (mode === 'FOCUS') {
                if (mesh === STATE.targetPhoto) {
                    // Focus Target
                    targetPos = new THREE.Vector3(0, 2, 35); // Close to camera (z=45)
                    // Face Camera precisely
                    targetRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)); // Camera looks at 0,0,0
                    // Actually lookAt logic is easier per frame
                    mesh.lookAt(0, 2, 45); // Look at camera pos
                    // But we want to smooth interplate to looking at camera.
                    // For now, just snap rotation or ignore smoothing on rotation for focus.
                    
                    targetScale = 4.0;
                } else {
                    // Background
                    targetPos = mesh.userData.scatterPos;
                }
            }

            // Apply Position Lerp
            if (targetPos) {
                 mesh.position.lerp(targetPos, lerpFactor);
            }
            
            // Apply Box/Scale Lerp
            const currentScale = mesh.scale.x;
            if (Math.abs(currentScale - targetScale) > 0.01) {
                const s = THREE.MathUtils.lerp(currentScale, targetScale, lerpFactor);
                mesh.scale.set(s, s, s);
            }
        });
    }
}

// Start App
new ChristmasApp();
