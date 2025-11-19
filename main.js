import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Pane } from 'tweakpane';

import { buildBanitsa } from './banitsa/banitsaBuilder.js';
import { makeTopMaterial, makeSideMaterial } from './banitsa/materials.js';
import { makeBanitsaTextures, makeFillingTexture } from './textures/banitsaTexture.js';
import { makeTableTexture } from './textures/tableTexture.js';
import { createSteamSystem } from './effects/steamSystem.js';

// --- Configuration ---
const CONFIG = {
  slices: 8,
  radius: 6,
  height: 0.8,
  gapDeg: 1.0,
  edgeDip: 0.2,
  wobbleAmp: 0.05,
  coinPosition: 0,
  table: {
    color1: '#f0f0f0',
    color2: '#c0392b'
  },
  fortunes: [
    "Health (Здраве)",
    "Love (Любов)",
    "Travel (Пътуване)",
    "New Car (Нова кола)",
    "New House (Нова къща)",
    "Baby (Бебе)",
    "Promotion (Повишение)",
    "Wedding (Сватба)",
    "Lottery Win (Печалба от тото)",
    "Good Friends (Добри приятели)",
    "Wisdom (Мъдрост)",
    "Lazy Year (Мързелива година)"
  ],
  steam: {
    enabled: true,
    density: 150
  }
};

// Ensure fortune list size matches max slices for UI stability
const MAX_SLICES = 12;
while (CONFIG.fortunes.length < MAX_SLICES) {
  CONFIG.fortunes.push("Luck (Късмет)");
}

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Modern three.js color management
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Key Light (warm sun)
const dirLight = new THREE.DirectionalLight(0xffd7a0, 2.0);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -10;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

// Fill Light (warm ambient)
const hemiLight = new THREE.HemisphereLight(0xfff2d5, 0x3b2b1a, 0.5);
scene.add(hemiLight);

// Rim Light (backlight for contour)
const spotLight = new THREE.SpotLight(0xffc57a, 1.0);
spotLight.position.set(-5, 5, -5);
spotLight.lookAt(0,0,0);
spotLight.penumbra = 0.5;
spotLight.castShadow = true;
scene.add(spotLight);

// Floor for shadows
// Replaced by Table below
// const floorGeo = new THREE.PlaneGeometry(50, 50);
// ...

// --- Table Setup ---
const tableGeo = new THREE.CylinderGeometry(10, 10, 0.5, 64);
// Initial texture
const tableTex = makeTableTexture(CONFIG.table.color1, CONFIG.table.color2);
const tableMat = new THREE.MeshStandardMaterial({ 
  map: tableTex,
  color: 0xffffff,
  roughness: 0.8,
  metalness: 0.0
});
const table = new THREE.Mesh(tableGeo, tableMat);
table.position.y = -0.26; // Just below banitsa (banitsa sits at 0, has height but usually bottom is 0? builder rotates it to sit flat at 0?)
// Banitsa builder uses extrude. Rotate -90X.
// Usually center of extrude is 0,0,0.
// If we rotated around X, the Y extent is 0 to -height? No.
// Extrude along Z. Range 0 to height.
// Rotate X -90. Z becomes Y. Range 0 to height.
// So bottom is Y=0. Top is Y=height.
// Table top should be at Y=0.
// Cylinder center is at 0,0,0. Height 0.5. Top is at +0.25.
// So table position y = -0.25.
table.position.y = -0.25;
table.receiveShadow = true;
scene.add(table);

// --- Banitsa Object ---
const banitsaGroup = new THREE.Group();
scene.add(banitsaGroup);

// --- Banitsa Resources ---
const textureLoader = new THREE.TextureLoader();

// Generate procedural textures as fallback/initial
let banitsaTextures = makeBanitsaTextures();
let fillingTextures = makeFillingTexture();

let topMat = makeTopMaterial(banitsaTextures);
let sideMat = makeSideMaterial(fillingTextures);

// Load Top Texture
// Supports .png with transparency
const banitsaPhotoTexture = textureLoader.load(
  '/banitsa.png', 
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; 
    if (topMat) {
      topMat.map = tex;
      topMat.transparent = true; 
      topMat.alphaTest = 0.5;
      topMat.side = THREE.DoubleSide; 
      topMat.color.setHex(0xffffff);
      topMat.needsUpdate = true;
    }
  },
  undefined,
  () => {
    // Fallback to jpg if png not found
    console.log('banitsa.png not found, trying banitsa.jpg...');
    textureLoader.load('/banitsa.jpg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        if (topMat) {
            topMat.map = tex;
            topMat.transparent = false;
            topMat.color.setHex(0xffffff);
            topMat.needsUpdate = true;
        }
    });
  }
);

// Load Side Texture (banitsa-side.png)
const sidePhotoTexture = textureLoader.load(
  '/banitsa-side.png?v=' + Date.now(), // Cache bust
  (tex) => {
    console.log('Side texture loaded successfully!');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (sideMat) {
      sideMat.map = tex;
      sideMat.transparent = false; 
      sideMat.alphaTest = 0;
      sideMat.side = THREE.DoubleSide;
      sideMat.color.setHex(0xffffff);
      sideMat.needsUpdate = true;
    }
  },
  undefined,
  (err) => {
    console.error('Error loading banitsa-side.png:', err);
  }
);

// --- Create Banitsa Function ---
function createBanitsa() {
  // Clear previous slices
  while (banitsaGroup.children.length > 0) {
    banitsaGroup.remove(banitsaGroup.children[0]);
  }

  const newGroup = buildBanitsa({
    sliceCount: CONFIG.slices,
    radius: CONFIG.radius,
    height: CONFIG.height,
    gapDeg: CONFIG.gapDeg,
    edgeDip: CONFIG.edgeDip,
    wobbleAmp: CONFIG.wobbleAmp,
    topMaterial: topMat,
    sideMaterial: sideMat,
    fortunes: CONFIG.fortunes,
    coinIndex: CONFIG.coinPosition
  });

  // Move children from newGroup to banitsaGroup to keep reference clean
  // or just add the group itself? 
  // Our click handler uses banitsaGroup.children.
  // Let's just add the meshes.
  while (newGroup.children.length > 0) {
    const mesh = newGroup.children[0];
    banitsaGroup.add(mesh);
  }
}

createBanitsa();

// --- Steam Effect ---
const steamSystem = createSteamSystem(CONFIG.steam.density);
steamSystem.position.y = 0.5; // Above banitsa
steamSystem.visible = CONFIG.steam.enabled;
scene.add(steamSystem);

// --- GUI Setup ---
const pane = new Pane({ title: 'Banitsa Config' });
const setupFolder = pane.addFolder({ title: 'Settings' });

// Bind slices and capture the binding
const slicesBinding = setupFolder.addBinding(CONFIG, 'slices', { min: 2, max: MAX_SLICES, step: 1 }).on('change', () => {
  updateCoinInput();
  createBanitsa();
});

let coinBinding;
function updateCoinInput() {
  if (coinBinding) coinBinding.dispose();
  // Coin position must be within range 0 to slices-1
  if (CONFIG.coinPosition >= CONFIG.slices) CONFIG.coinPosition = 0;
  
  coinBinding = setupFolder.addBinding(CONFIG, 'coinPosition', { 
    min: 0, 
    max: CONFIG.slices - 1, 
    step: 1,
    label: 'Coin Slice Index'
  }).on('change', () => {
    // Update visual indication if needed (e.g. debug mode), otherwise hidden
    createBanitsa(); // Re-create to assign coin correctly
  });
}
updateCoinInput();


// Add visual toggles
const visualFolder = pane.addFolder({ title: 'Visuals' });
visualFolder.addBinding(CONFIG, 'radius', { min: 2, max: 8, label: 'Radius' }).on('change', createBanitsa);
visualFolder.addBinding(CONFIG, 'height', { min: 0.2, max: 2, label: 'Thickness' }).on('change', createBanitsa);
visualFolder.addBinding(CONFIG, 'gapDeg', { min: 0, max: 5, label: 'Slice Gap' }).on('change', createBanitsa);
visualFolder.addBinding(CONFIG, 'edgeDip', { min: 0, max: 0.5, label: 'Edge Dip' }).on('change', createBanitsa);
visualFolder.addBinding(CONFIG.steam, 'enabled', { label: 'Steam' }).on('change', (ev) => {
  steamSystem.visible = ev.value;
});

const tableFolder = pane.addFolder({ title: 'Table Colors' });
tableFolder.addBinding(CONFIG.table, 'color1', { label: 'Base' }).on('change', updateTable);
tableFolder.addBinding(CONFIG.table, 'color2', { label: 'Checkers' }).on('change', updateTable);

function updateTable() {
  const newTex = makeTableTexture(CONFIG.table.color1, CONFIG.table.color2);
  tableMat.map.dispose();
  tableMat.map = newTex;
  tableMat.needsUpdate = true;
}

// Create inputs for each potential slice
const fortunesFolder = pane.addFolder({ title: 'Fortunes (per Slice)', expanded: false });
const fortuneBindings = [];
function refreshFortuneBindings() {
  fortuneBindings.forEach(b => b.dispose());
  fortuneBindings.length = 0;

  for (let i = 0; i < MAX_SLICES; i++) {
    const binding = fortunesFolder.addBinding(CONFIG.fortunes, i, {
      label: `Slice ${i}`
    });
    // Hide binding if index >= current slices
    binding.hidden = i >= CONFIG.slices;
    fortuneBindings.push(binding);
  }
}

// Hook up visibility update using the captured binding
slicesBinding.on('change', () => {
  fortuneBindings.forEach((b, i) => {
    b.hidden = i >= CONFIG.slices;
  });
});

refreshFortuneBindings();

// --- Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isSpinning = false;
let spinVelocity = 0;

// Click vs Drag Detection
let isDragging = false;
let mouseDownPos = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
  mouseDownPos.x = event.clientX;
  mouseDownPos.y = event.clientY;
  isDragging = false;
});

window.addEventListener('pointermove', (event) => {
  // If mouse moves significantly while down, mark as drag
  const dx = event.clientX - mouseDownPos.x;
  const dy = event.clientY - mouseDownPos.y;
  if (Math.sqrt(dx*dx + dy*dy) > 5) {
    isDragging = true;
  }
});

window.addEventListener('pointerup', (event) => {
  // Only process click if it wasn't a drag operation
  if (isDragging) return;
  if (isSpinning) return; // Can't pick while spinning

  // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(banitsaGroup.children);

  if (intersects.length > 0) {
    const selectedSlice = intersects[0].object;
    revealFortune(selectedSlice);
  }
});

// Removed old 'click' listener to avoid duplication
// window.addEventListener('click', onMouseClick);

// --- Logic ---
const fortuneDisplay = document.getElementById('fortune-display');

function revealFortune(slice) {
  const fortune = slice.userData.fortune;
  const hasCoin = slice.userData.hasCoin;
  
  let html = `<h2>Your Fortune</h2>`;
  html += `<p style="font-size: 1.2em; font-weight: bold;">${fortune}</p>`;
  
  if (hasCoin) {
    html += `<p style="color: #ffd700; font-weight: bold; font-size: 1.5em;">🪙 You found the COIN! (Prosperity) 🪙</p>`;
  }
  
  html += `<button class="close-btn" onclick="document.getElementById('fortune-display').classList.add('hidden')">Close</button>`;
  
  fortuneDisplay.innerHTML = html;
  fortuneDisplay.classList.remove('hidden');
  
  // Animate slice up and remove
  // Reset others
  banitsaGroup.children.forEach(child => {
    if (child !== slice) {
      child.position.y = 0;
    }
  });

  // Animation logic for the selected slice
  // We can use a simple TWEEN or just update loop logic.
  // For simplicity, let's attach an animation function to the slice
  const startY = slice.position.y;
  const targetY = 4.0; // Lift higher
  const startTime = Date.now();
  const duration = 1200; // ms

  slice.userData.isAnimating = true;
  slice.userData.animate = () => {
    const now = Date.now();
    const progress = Math.min((now - startTime) / duration, 1);
    
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    
    // Vertical Lift
    slice.position.y = startY + (targetY - startY) * ease;
    
    // Gentle Spin/Tilt (Reduced to avoid clipping through table)
    // Only tilt slightly after it has lifted off the ground
    if (progress > 0.2) {
      const spinProgress = (progress - 0.2) / 0.8;
      slice.rotation.y -= 0.02 * spinProgress; 
      slice.rotation.x -= 0.01 * spinProgress; 
    }

    if (progress >= 1) {
      // Remove
      banitsaGroup.remove(slice);
      // Optional: dispose geometry if we want to be clean
      if (slice.geometry) slice.geometry.dispose();
    }
  };
}

// --- Spin Logic ---
document.getElementById('spin-btn').addEventListener('click', () => {
  if (isSpinning) return;
  isSpinning = true;
  spinVelocity = 0.5 + Math.random() * 0.5; // Initial speed
  fortuneDisplay.classList.add('hidden');
  // Reset slice positions
  banitsaGroup.children.forEach(c => c.position.y = 0);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  // Reset the game state (hide fortune, reset rotation)
  isSpinning = false;
  spinVelocity = 0;
  fortuneDisplay.classList.add('hidden');
  
  // Recreate the banitsa to bring back removed slices
  createBanitsa();
  
  banitsaGroup.rotation.y = 0;
});


// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const dt = clock.getDelta();

  if (isSpinning) {
    banitsaGroup.rotation.y += spinVelocity;
    spinVelocity *= 0.98; // Friction
    
    if (spinVelocity < 0.001) {
      isSpinning = false;
      spinVelocity = 0;
    }
  }

  // Animate Steam
  if (CONFIG.steam.enabled && steamSystem.userData.update) {
    steamSystem.userData.update(dt);
  }

  // Animate Removing Slices
  // Iterate backwards to safely remove
  for (let i = banitsaGroup.children.length - 1; i >= 0; i--) {
    const child = banitsaGroup.children[i];
    if (child.userData.isAnimating && child.userData.animate) {
      child.userData.animate();
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
