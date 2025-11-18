import * as THREE from 'three';

export function createSteamSystem({ 
  count = 200, 
  texture = null 
} = {}) {
  // If no texture provided, create a simple soft blurred circle
  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    texture = new THREE.CanvasTexture(canvas);
  }

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3); // x, y, z speed
  const phases = new Float32Array(count); // 0..1 lifetime phase
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    resetParticle(i, positions, velocities, phases, sizes);
    // Scramble phase so they don't all start at once
    phases[i] = Math.random(); 
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  // We'll use a custom shader or just loop on CPU. 
  // For 200 particles, CPU loop is totally fine and easier to tweak drift.
  
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    map: texture,
    transparent: true,
    opacity: 0.3,
    size: 1.0, // base size, will scale
    depthWrite: false,
    blending: THREE.NormalBlending // or AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  
  // Animation Logic
  points.userData.update = (dt) => {
    const pos = geometry.attributes.position.array;
    
    for (let i = 0; i < count; i++) {
      let idx = i * 3;
      
      // Update Age/Phase
      phases[i] += dt * 0.3; // speed of aging
      
      if (phases[i] > 1) {
        resetParticle(i, positions, velocities, phases, sizes);
        phases[i] = 0;
      }

      // Move
      pos[idx] += velocities[idx] * dt;     // X drift
      pos[idx+1] += velocities[idx+1] * dt; // Y rise
      pos[idx+2] += velocities[idx+2] * dt; // Z drift
      
      // Add some noise/drift
      pos[idx] += Math.sin(phases[i] * 10 + i) * 0.01;
      
      // Reset if too high (redundant with phase but good safety)
      if (pos[idx+1] > 5) phases[i] = 1.1; 
    }
    geometry.attributes.position.needsUpdate = true;
  };

  return points;
}

function resetParticle(i, pos, vel, phase, size) {
  // Random start position on the banitsa surface (radius ~5)
  const r = Math.random() * 4;
  const theta = Math.random() * Math.PI * 2;
  
  pos[i*3] = Math.cos(theta) * r;
  pos[i*3+1] = 0.5 + Math.random() * 0.5; // Start slightly above
  pos[i*3+2] = Math.sin(theta) * r;
  
  vel[i*3] = (Math.random() - 0.5) * 0.5; // slight wind
  vel[i*3+1] = 1.0 + Math.random() * 1.0; // Upward speed
  vel[i*3+2] = (Math.random() - 0.5) * 0.5;
  
  size[i] = 0.5 + Math.random() * 1.0;
}
