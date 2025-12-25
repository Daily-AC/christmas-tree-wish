import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

console.log("Christmas Tree Project Initialized 🎄");

const TREE_HEIGHT = 20;
const TREE_RADIUS = 8;
const PARTICLE_COUNT = 3000; // Increased for density
const SNOW_COUNT = 1500;

async function init() {
    const loading = document.getElementById('loading');
    
    // --- 1. Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020205, 0.02); // Darker fog matching bg

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;
    camera.position.y = 10;
    camera.lookAt(0, 5, 0);

    const renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('mainCanvas'), 
        antialias: false, // Bloom often wants false or specific handling, but 'true' is fine usually
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ReinhardToneMapping; // Better light handling

    // --- Post Processing (Bloom) ---
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.2; // Glowing strength
    bloomPass.radius = 0.5;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);


    // --- 2. Particle Nebula Tree (Volumetric) ---
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    
    // Physics Data stored in typed arrays for performance
    const count = 5000; // Nebula density
    const originalPositions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    const colorObj = new THREE.Color();

    for (let i = 0; i < count; i++) {
        // Volumetric Cone Logic
        // Height: 0 to TREE_HEIGHT
        const h = Math.random() * TREE_HEIGHT;
        // Radius at this height
        const maxR = (1 - (h / TREE_HEIGHT)) * TREE_RADIUS;
        // Random point inside circle at height h
        // sqrt(random) for uniform distribution, or just random for center-bias (nebula core)
        const r = Math.random() * maxR; 
        const angle = Math.random() * Math.PI * 2;

        const x = Math.cos(angle) * r;
        const y = h - 5; // Center Y
        const z = Math.sin(angle) * r;

        positions.push(x, y, z);
        
        // Store original for physics return
        originalPositions[i*3] = x;
        originalPositions[i*3+1] = y;
        originalPositions[i*3+2] = z;

        // Init velocities
        velocities[i*3] = 0;
        velocities[i*3+1] = 0;
        velocities[i*3+2] = 0;

        // Nebula Colors
        // Core: Gold/Warm. Edges: Blue/Cold or Green.
        // Let's mix Christmas: Deep Green, with glowing Gold core and Red accents.
        const distFromCenter = r / TREE_RADIUS;
        const rand = Math.random();

        if (rand > 0.90) {
            // Ornaments (Red/Gold)
            colorObj.setHex(rand > 0.95 ? 0xffd700 : 0xff0000);
            colorObj.multiplyScalar(2.0); // Bright bloom
            sizes.push(0.6); // Large
        } else {
            // Tree Body
            // Mix Green and Teal for magical look
            if (distFromCenter < 0.3) {
                colorObj.setHex(0xffffaa); // Inner glow
                colorObj.multiplyScalar(0.5);
            } else {
                colorObj.setHex(0x228b22); // Green
                // Add some Blue gradient for "Frozen/Magic" feel
                colorObj.lerp(new THREE.Color(0x0044aa), Math.random() * 0.3);
            }
            sizes.push(Math.random() * 0.3 + 0.1);
        }

        colors.push(colorObj.r, colorObj.g, colorObj.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    // Refined Shader for Soft Particles
    const vertexShader = `
        attribute float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = size * ( 400.0 / -mvPosition.z );
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        varying vec3 vColor;
        void main() {
            vec2 xy = gl_PointCoord.xy - vec2(0.5);
            float ll = length(xy);
            if (ll > 0.5) discard;
            
            // Soft glow gradient
            float alpha = (0.5 - ll) * 2.0;
            alpha = pow(alpha, 2.0);
            
            gl_FragColor = vec4( vColor, alpha );
        }
    `;

    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // --- Snow System using same shader but white ---
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = [];
    const snowVel = [];
    for(let i=0; i<SNOW_COUNT; i++) {
        snowPos.push(
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * 60
        );
        snowVel.push(
            (Math.random() - 0.5) * 0.05,
            -(Math.random() * 0.1 + 0.05),
            (Math.random() - 0.5) * 0.05
        );
    }
    snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
    snowGeo.setAttribute('size', new THREE.Float32BufferAttribute(new Float32Array(SNOW_COUNT).fill(0.3), 1));
    snowGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(SNOW_COUNT * 3).fill(1.0), 3));
    
    const snowSystem = new THREE.Points(snowGeo, material.clone()); // Clone material to share shader
    scene.add(snowSystem);

    // Star interaction light
    const starGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(0, TREE_HEIGHT - 5, 0);
    scene.add(star);
    
    // Add point light for star
    const starLight = new THREE.PointLight(0xffaa00, 3, 30);
    starLight.position.set(0, TREE_HEIGHT - 5, 0);
    scene.add(starLight);

    // --- 2.1 Setup Photos ---
    setupPhotos(scene);

    // --- 3. Animation Loop ---
    const clock = new THREE.Clock();
    
    // Force Field Vars
    const mouseSphere = new THREE.Vector3();
    const repulsionRadius = 6.0;
    const forceStrength = 20.0;
    const returnStrength = 2.0;
    const damping = 0.90;

    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1); // Cap delta
        const time = clock.getElapsedTime();

        // 1. Calculate Hand 3D Position for Repulsion
        // Project ray to Z=0 plane (approx tree center-ish) or closer
        if (handState.visible) {
             raycaster.setFromCamera(handState.vector, camera);
             // Plane at Z = 5 (front of tree roughly)
             // Ray: O + tD.  z = Oz + tDz = 5 => t = (5 - Oz)/Dz
             const targetZ = 5;
             const t = (targetZ - raycaster.ray.origin.z) / raycaster.ray.direction.z;
             mouseSphere.copy(raycaster.ray.origin).add(raycaster.ray.direction.multiplyScalar(t));
        } else {
            mouseSphere.set(1000, 1000, 1000); // Far away
        }

        // 2. Physics Update
        // Only run physics if hand is visible/close or particles are displaced? 
        // Always run for return logic + "breathing"
        const attrs = particles.geometry.attributes.position.array;
        let needsUpdate = false;

        for(let i=0; i<count; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;

            let px = attrs[ix];
            let py = attrs[iy];
            let pz = attrs[iz];

            // A. Breathing / Idle movement
            const ox = originalPositions[ix];
            const oy = originalPositions[iy];
            const oz = originalPositions[iz];

            // Add simple noise drift to original target?
            const drift = Math.sin(time * 2 + i) * 0.05; 
            const targetX = ox + drift;
            const targetY = oy + drift;
            const targetZ = oz;

            // B. Repulsion Force
            const dx = px - mouseSphere.x;
            const dy = py - mouseSphere.y;
            const dz = pz - mouseSphere.z;
            const distSq = dx*dx + dy*dy + dz*dz;

            if (distSq < repulsionRadius * repulsionRadius) {
                const dist = Math.sqrt(distSq);
                const force = (1 - dist / repulsionRadius) * forceStrength;
                // Direction * Force * Delta
                velocities[ix] += (dx / dist) * force * delta;
                velocities[iy] += (dy / dist) * force * delta;
                velocities[iz] += (dz / dist) * force * delta;
            }

            // C. Return Force (Spring)
            velocities[ix] += (targetX - px) * returnStrength * delta;
            velocities[iy] += (targetY - py) * returnStrength * delta;
            velocities[iz] += (targetZ - pz) * returnStrength * delta;

            // D. Damping
            velocities[ix] *= damping;
            velocities[iy] *= damping;
            velocities[iz] *= damping;

            // E. Apply
            attrs[ix] += velocities[ix] * delta;
            attrs[iy] += velocities[iy] * delta;
            attrs[iz] += velocities[iz] * delta;
        }

        particles.geometry.attributes.position.needsUpdate = true;

        // Tree Rotation (Group or Camera orbit?)
        // Since physics is world-space based on originalPos, rotating the MESH will rotate the physics interaction frame?
        // Actually, if we rotate the mesh `particles.rotation.y`, the vertex positions are local.
        // Screen raycast is world space.
        // We need to inverse rotate the repulsion point into local space, OR rotate originalPositions?
        // Simpler: Rotate the Mesh. The `positions` attribute is LOCAL to the mesh.
        // Physics Calculation: Hand(World) -> Transform to Local -> Apply Force(Local).
        
        if (!grabbedPhoto && handState.visible) {
             // Convert mouseSphere (World) to Local Space of particles
             // particles.worldToLocal(mouseSphere.clone()); // Careful, we modify simpler.
             // Just rotate the input vector inverse to tree rotation.
             const cosR = Math.cos(-particles.rotation.y);
             const sinR = Math.sin(-particles.rotation.y);
             // Rotate x,z
             const lx = mouseSphere.x * cosR - mouseSphere.z * sinR;
             const lz = mouseSphere.x * sinR + mouseSphere.z * cosR;
             mouseSphere.x = lx;
             mouseSphere.z = lz;
             // Now mouseSphere is approximate local.
        }

        // Slowly Rotate Tree
        if (!grabbedPhoto) {
            particles.rotation.y = time * 0.05;
            
            // Sync photos
            photos.forEach(p => {
                 if(p !== grabbedPhoto) {
                    const radius = p.userData.radius;
                    const currentAngle = p.userData.initialAngle + particles.rotation.y;
                    p.position.x = Math.cos(currentAngle) * radius;
                    p.position.z = Math.sin(currentAngle) * radius;
                    p.lookAt(camera.position); 
                }
            });
        }
        
        star.rotation.y = -time * 0.2;

        // Snow animation
        const snowP = snowSystem.geometry.attributes.position.array;
        for(let i=0; i<SNOW_COUNT; i++) {
            snowP[i*3] += snowVel[i*3];
            snowP[i*3+1] += snowVel[i*3+1];
            snowP[i*3+2] += snowVel[i*3+2];
            
            if(snowP[i*3+1] < -20) {
                 snowP[i*3+1] = 20;
            }
        }
        snowSystem.geometry.attributes.position.needsUpdate = true;

        updateInteractions(camera, scene);
        
        composer.render();
    }

    animate();
    
    // Handle Window Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    if(loading) loading.style.display = 'none';

    // Start MediaPipe
    setupMediaPipe();
}

// --- MediaPipe & Gesture Logic ---
const handState = { 
    x: 0, 
    y: 0, 
    pinching: false, 
    visible: false,
    vector: new THREE.Vector2() // For raycasting
};

function setupMediaPipe() {
    const videoElement = document.querySelector('.input_video');
    
    const hands = new window.Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    const camera = new window.Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 1280,
        height: 720
    });
    
    // Attempt camera start, but handle errors silently or fallback
    camera.start().catch(e => {
        console.warn("Camera failed to start, using mouse/touch fallback", e);
    });
    
    console.log("MediaPipe Hands initialized");

    // --- Fallback Mouse/Touch Interaction ---
    window.addEventListener('mousemove', (e) => {
        if (!handState.visible) { // Only if no hand detected
            updateHandStateFromInput(e.clientX, e.clientY);
        }
    });
    
    window.addEventListener('mousedown', () => { if(!handState.visible) handState.pinching = true; });
    window.addEventListener('mouseup', () => { if(!handState.visible) handState.pinching = false; });

    window.addEventListener('touchmove', (e) => {
        if (!handState.visible && e.touches.length > 0) {
            updateHandStateFromInput(e.touches[0].clientX, e.touches[0].clientY);
        }
    });
    window.addEventListener('touchstart', () => { if(!handState.visible) handState.pinching = true; });
    window.addEventListener('touchend', () => { if(!handState.visible) handState.pinching = false; });
}

function updateHandStateFromInput(clientX, clientY) {
     // Normalize to [-1, 1] relative to center
     // Screen: 0,0 top-left. Three.js: -1,-1 bottom-left? No. Raycaster expects normalized device coords (NDC).
     // NDC: -1 to +1.
     // x = (clientX / w) * 2 - 1
     // y = -(clientY / h) * 2 + 1
     
     handState.x = (clientX / window.innerWidth) * 2 - 1;
     handState.y = -(clientY / window.innerHeight) * 2 + 1;
     
     handState.vector.set(handState.x, handState.y);
     
     // Update cursor manually for mouse (though system cursor exists, this keeps style consistent)
     updateCursor(handState.x, handState.y, handState.pinching);
}

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Landmarks: 8 (Index Tip), 4 (Thumb Tip)
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];
        
        // Calculate distance for pinch detection
        const distance = Math.hypot(
            indexTip.x - thumbTip.x,
            indexTip.y - thumbTip.y
        );

        // Normalize coordinates to [-1, 1] for Three.js
        // MediaPipe x is 0(left) to 1(right). Three.js x is -1(left) to 1(right).
        // MediaPipe y is 0(top) to 1(bottom). Three.js y is 1(top) to -1(bottom).
        handState.x = (indexTip.x * 2) - 1; 
        handState.x = -handState.x; // Mirror effect for natural feel
        
        handState.y = -(indexTip.y * 2) + 1;

        handState.vector.set(handState.x, handState.y);
        handState.visible = true;
        
        // Pinch threshold
        handState.pinching = distance < 0.05;

        updateCursor(handState.x, handState.y, handState.pinching);

    } else {
        handState.visible = false;
        hideCursor();
    }
}

// Visual Cursor for feedback
const cursor = document.createElement('div');
cursor.style.width = '20px';
cursor.style.height = '20px';
cursor.style.borderRadius = '50%';
cursor.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
cursor.style.border = '2px solid gold';
cursor.style.position = 'absolute';
cursor.style.zIndex = '100';
cursor.style.pointerEvents = 'none';
cursor.style.transform = 'translate(-50%, -50%)';
cursor.style.display = 'none';
cursor.style.boxShadow = '0 0 10px gold';
document.body.appendChild(cursor);


function updateCursor(ndcX, ndcY, isPinching) {
    // NDC to Screen Coordinates
    // NDC x: -1 (Left) -> 1 (Right)
    // NDC y: 1 (Top) -> -1 (Bottom)
    
    // Note: ndcX came from handState.x which IS ALREADY MIRRORED for MediaPipe.
    // So -1 means Visual Left (Screen Left).
    // Mouse input is standard, so we mapped it to standard NDC (-1 Left).
    
    // Screen X = ((ndcX + 1) / 2) * width
    const cssX = ((ndcX + 1) / 2) * window.innerWidth;
    
    // Screen Y = ((-ndcY + 1) / 2) * height
    const cssY = ((-ndcY + 1) / 2) * window.innerHeight;

    cursor.style.left = `${cssX}px`;
    cursor.style.top = `${cssY}px`;
    cursor.style.display = 'block';
    
    cursor.style.backgroundColor = isPinching ? 'red' : 'rgba(255, 255, 255, 0.8)';
    cursor.style.transform = isPinching ? 'translate(-50%, -50%) scale(0.8)' : 'translate(-50%, -50%) scale(1)';
}

function hideCursor() {
    cursor.style.display = 'none';
}

function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// --- Photo Manager & Interaction ---
const photos = [];
const raycaster = new THREE.Raycaster();
let grabbedPhoto = null;
let originalGrabPos = new THREE.Vector3();

function setupPhotos(scene) {
    const photoCount = 6;
    const loader = new THREE.TextureLoader(); // Use placeholder or generated texture
    
    // Create a placeholder texture for now
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,300,400);
    ctx.fillStyle = '#c0392b';
    ctx.font = '40px Arial';
    ctx.fillText('Photo', 100, 200);
    const placeHolderTex = new THREE.Texture(canvas);
    placeHolderTex.needsUpdate = true;

    for(let i=0; i<photoCount; i++) {
        const geometry = new THREE.PlaneGeometry(3, 4); // Photo aspect ratio
        const material = new THREE.MeshBasicMaterial({ 
            map: placeHolderTex,
            side: THREE.DoubleSide
        });
        const photo = new THREE.Mesh(geometry, material);
        
        // Distribute on tree
        const t = (i / photoCount);
        const y = 3 + t * 10;
        const radius = TREE_RADIUS * (1 - t * 0.5) + 1; // Slightly outside
        const angle = t * Math.PI * 2 * 2; // Spread around

        photo.position.set(
            Math.cos(angle) * radius,
            y,
            Math.sin(angle) * radius
        );
        
        // Store initial data for rotation/return
        photo.userData = {
            initialAngle: angle,
            radius: radius,
            originalY: y
        };
        
        scene.add(photo);
        photos.push(photo);
    }
}

function updateInteractions(camera, scene) {
    if (!handState.visible) return;

    raycaster.setFromCamera(handState.vector, camera);
    const intersects = raycaster.intersectObjects(photos);

    // Hover state
    document.body.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
    if(intersects.length > 0) {
        cursor.style.borderColor = 'cyan';
    } else {
        cursor.style.borderColor = 'gold';
    }

    // Grab Logic
    if (handState.pinching) {
        if (!grabbedPhoto && intersects.length > 0) {
            grabbedPhoto = intersects[0].object;
            // Store offset or just snap? Snap is easier for "magic" feel
        }
    } else {
        if (grabbedPhoto) {
            // Release: Check if we should return it or keep it "open"?
            // Per requirement: "Pull out". 
            // Return logic: Simple linear interpolation back to tree spot in animate loop?
            // For now, snap back immediately or leave it?
            // Let's snap back for simplicity, or complex "floating" mode.
            grabbedPhoto = null;
        }
    }

    if (grabbedPhoto) {
        // Move photo to hand position
        // Project hand 2D -> 3D plane at distance X
        const vector = new THREE.Vector3(handState.vector.x, handState.vector.y, 0.5); // z=0.5 is halfway between near/far in NDC? No.
        
        // Unproject requires vector in [-1, 1] for x,y,z.
        // We want a fixed distance from camera.
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = 15; // Distance from camera to hold photo
        const targetPos = camera.position.clone().add(dir.multiplyScalar(distance));
        
        grabbedPhoto.position.copy(targetPos);
        grabbedPhoto.lookAt(camera.position);
        grabbedPhoto.scale.set(1.5, 1.5, 1.5); // Enlarge
    } else {
        // Reset scale slowly or check if photos are in place
        photos.forEach(p => {
             if (p.scale.x > 1) p.scale.set(1,1,1);
        });
    }
}

init();
