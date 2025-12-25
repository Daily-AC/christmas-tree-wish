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


    // --- 2. Particle Tree Generation ---
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = []; // Varying sizes for particles
    const colorObj = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Spiral Cone
        const t = i / PARTICLE_COUNT;
        const angle = t * Math.PI * 2 * 15; // More spirals
        const radius = (1 - t) * TREE_RADIUS;
        
        // Jitter
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.8;
        const y = t * TREE_HEIGHT - 5; 
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.8;

        positions.push(x, y, z);

        // Better Colors
        // 70% Green (Base), 15% Gold (Lights), 15% Red/Blue (Ornaments)
        const rand = Math.random();
        let size = 0.2;
        
        if (rand > 0.85) {
            colorObj.setHex(0xff0000); // Red
            size = 0.5; // Bigger ornaments
        }
        else if (rand > 0.70) {
            colorObj.setHex(0xffaa00); // Gold
            colorObj.multiplyScalar(2); // Super bright for bloom
            size = 0.4;
        } 
        else if (rand > 0.65) {
            colorObj.setHex(0x0088ff); // Ice Blue
            colorObj.multiplyScalar(2); 
            size = 0.4;
        }
        else {
             // Forest Green varying
             colorObj.setHex(0x228b22); 
             colorObj.offsetHSL(0, 0, (Math.random()-0.5)*0.1);
        }

        colors.push(colorObj.r, colorObj.g, colorObj.b);
        sizes.push(size);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    // ShaderMaterial for twinkling/round particles
    const vertexShader = `
        attribute float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = size * ( 300.0 / -mvPosition.z );
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        varying vec3 vColor;
        void main() {
            // Circular particle
            float r = distance(gl_PointCoord, vec2(0.5, 0.5));
            if (r > 0.5) discard;
            
            // Soft edge
            float glow = 1.0 - (r * 2.0);
            glow = pow(glow, 1.5);
            
            gl_FragColor = vec4( vColor, glow );
        }
    `;

    const material = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // --- Snow System ---
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = [];
    const snowVel = []; // Velocities
    for(let i=0; i<SNOW_COUNT; i++) {
        snowPos.push(
            (Math.random() - 0.5) * 50,
            (Math.random() - 0.5) * 50,
            (Math.random() - 0.5) * 50
        );
        snowVel.push(
            (Math.random() - 0.5) * 0.1, // x drift
            -(Math.random() * 0.1 + 0.05), // fall speed
            (Math.random() - 0.5) * 0.1 // z drift
        );
    }
    snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
    
    // Snow uses simple points
    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.2,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
         map: createParticleTexture() // reuse texture
    });
    const snowSystem = new THREE.Points(snowGeo, snowMat);
    scene.add(snowSystem);


    // Star at the top (Brighter)
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

    function animate() {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime();

        // Rotate tree slowly
        if (!grabbedPhoto) {
            particles.rotation.y = time * 0.05; // slower, more majestic
            
            // Sync photos rotation matches tree
            const treeRotation = particles.rotation.y;
             photos.forEach(p => {
                if(p !== grabbedPhoto) {
                    const radius = p.userData.radius;
                    // Initial angle + tree rotation
                    const currentAngle = p.userData.initialAngle + treeRotation;
                    p.position.x = Math.cos(currentAngle) * radius;
                    p.position.z = Math.sin(currentAngle) * radius;
                    // Make photo face outward or camera? Outward looks like decoration.
                    // p.lookAt(0, p.position.y, 0); // Face center (backwards)
                    // p.rotation.y += Math.PI; // Flash outward
                    p.lookAt(camera.position); // Billboard usually best for photos
                }
            });
        }
        
        star.rotation.y = -time * 0.2;

        // Snow animation
        const positions = snowSystem.geometry.attributes.position.array;
        for(let i=0; i<SNOW_COUNT; i++) {
            positions[i*3] += snowVel[i*3];
            positions[i*3+1] += snowVel[i*3+1];
            positions[i*3+2] += snowVel[i*3+2];
            
            // Reset if below floor
            if(positions[i*3+1] < -15) {
                 positions[i*3+1] = 15;
            }
        }
        snowSystem.geometry.attributes.position.needsUpdate = true;

        updateInteractions(camera, scene);
        
        // renderer.render(scene, camera); // Replace with composer
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
