import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Pane } from 'tweakpane';

// --- Configuration ---
const CONFIG = {
  slices: 8,
  radius: 5,
  height: 0.8,
  coinPosition: 0, // 0-indexed
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
  ]
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
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffd700, 0.8); // Golden light
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// --- Banitsa Object ---
const banitsaGroup = new THREE.Group();
scene.add(banitsaGroup);

// Materials
// Texture simulation: procedural texture or just noise. Let's use a rough noisy material.
const crustMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xeebb66, // Doughy color
  roughness: 0.8,
  metalness: 0.1,
  bumpScale: 0.02
});

// Top surface material - simpler to simulate the "baked sheets" look with color and bump
const topMaterial = new THREE.MeshStandardMaterial({
  color: 0xd4a017, // Golden baked
  roughness: 0.9,
  metalness: 0.0
});

function createBanitsa() {
  // Clear existing
  while(banitsaGroup.children.length > 0){ 
    banitsaGroup.remove(banitsaGroup.children[0]); 
  }

  const anglePerSlice = (Math.PI * 2) / CONFIG.slices;
  
  for (let i = 0; i < CONFIG.slices; i++) {
    // Create a slice using Shape and ExtrudeGeometry for better control than Cylinder
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.arc(0, 0, CONFIG.radius, i * anglePerSlice, (i + 1) * anglePerSlice, false);
    shape.lineTo(0, 0);
    
    const extrudeSettings = {
      steps: 1,
      depth: CONFIG.height,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 2
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate to lay flat
    geometry.rotateX(-Math.PI / 2);
    
    const sliceMesh = new THREE.Mesh(geometry, [topMaterial, crustMaterial]);
    
    // Store data in user data
    // Use the fortune from the config index directly (or we could shuffle, but "configurable placement" implies mapping index to fortune)
    // To support "where I put what", we map Slice 0 -> Fortune 0, etc.
    sliceMesh.userData = {
      id: i,
      fortune: CONFIG.fortunes[i],
      hasCoin: (i === CONFIG.coinPosition),
      originalY: 0
    };
    
    // Add a slight gap between slices for visual separation
    // Calculate center angle of the slice
    const midAngle = (i * anglePerSlice) + (anglePerSlice / 2);
    // Move slightly outward
    const gap = 0.1;
    sliceMesh.position.x = Math.cos(midAngle) * gap;
    sliceMesh.position.z = Math.sin(midAngle) * gap;

    banitsaGroup.add(sliceMesh);
  }
}

createBanitsa();

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

const fortunesFolder = pane.addFolder({ title: 'Fortunes (per Slice)', expanded: false });

// Create inputs for each potential slice
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

function onMouseClick(event) {
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
}

window.addEventListener('click', onMouseClick);

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
  
  // Animate slice up
  // Reset others
  banitsaGroup.children.forEach(child => {
    child.position.y = 0;
    if (child === slice) {
      child.position.y = 1; // Pop up
    }
  });
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
  banitsaGroup.children.forEach(c => c.position.y = 0);
  banitsaGroup.rotation.y = 0;
  // We do not scramble config here as the user configured it
});


// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);

  if (isSpinning) {
    banitsaGroup.rotation.y += spinVelocity;
    spinVelocity *= 0.98; // Friction
    
    if (spinVelocity < 0.001) {
      isSpinning = false;
      spinVelocity = 0;
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
