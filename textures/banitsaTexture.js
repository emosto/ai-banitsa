import * as THREE from 'three';

export function makeBanitsaTextures(config = {}) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;

  // --- 1. Height Map Generation (Greyscale) ---
  // We use this for bump/displacement and derive others from it.
  
  // Background: Middle gray
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  
  const cx = size / 2;
  const cy = size / 2;
  
  // Draw Spiral with Distortion (Torn Paper look)
  ctx.lineWidth = size * 0.08; // Thicker
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff'; // High points
  ctx.filter = 'blur(4px)'; // Less blur for sharper "torn" edges
  
  ctx.beginPath();
  const coils = 5;
  const maxRadius = size * 0.48;
  
  for (let i = 0; i < 400; i++) {
    const angle = i * 0.1;
    const rBase = (angle / (coils * Math.PI * 2)) * maxRadius;
    
    // Distortion
    const distort = Math.sin(angle * 10) * 10 + Math.cos(angle * 23) * 5;
    const r = rBase + distort;
    
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.filter = 'none';

  // Add Heavy Noise (Simulate flakes/torn layers)
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Existing value
    const val = data[i];
    // Heavy Noise: -40 to +40
    const noise = (Math.random() - 0.5) * 80;
    // Thresholding to make it look like jagged layers
    let final = val + noise;
    
    // "Torn" effect: sharpen transitions
    if (final > 150 && final < 200) final -= 20;
    if (final > 200) final += 10;

    final = Math.min(255, Math.max(0, final));
    
    data[i] = final;
    data[i+1] = final;
    data[i+2] = final;
    // Alpha stays 255
  }
  ctx.putImageData(imgData, 0, 0);
  
  // Save Height Canvas for Normal generation
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  heightCanvas.getContext('2d').drawImage(canvas, 0, 0);

  // --- 2. Color Map ---
  // Map grayscale height to [Baked Colors]
  // High frequency "flake" noise suggests thin layers.
  // "Torn paper" distortion is simulated by domain warping on height generation (not added here to keep simple, but heavily implied by noise)
  // Color Palette Update: Gold-Light-Brown
  
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext('2d');
  
  const heightData = ctx.getImageData(0, 0, size, size);
  const cData = heightData.data;
  
  for (let i = 0; i < cData.length; i += 4) {
    const h = cData[i]; // 0..255
    
    // Refined Palette:
    // Shadows: Deep Amber/Brown #b87333 (184, 115, 51)
    // Mid: Rich Gold #ffd700 (255, 215, 0) mixed with #e6ac00
    // Highlights: Pale Dough/White #ffefd5 (255, 239, 213)
    
    let r, g, b;
    
    if (h < 80) {
      // Deep cracks
      const t = h / 80;
      r = 139 + (184 - 139) * t;
      g = 69 + (115 - 69) * t;
      b = 19 + (51 - 19) * t;
    } else if (h < 180) {
      // Mid tones (Golden)
      const t = (h - 80) / 100;
      r = 184 + (230 - 184) * t;
      g = 115 + (172 - 115) * t;
      b = 51 + (0 - 51) * t; // Actually let's keep some warm yellow
      // Let's hardcode a nicer gradient
      // 184,115,51 -> 240,180,60
      r = 184 + (240 - 184) * t;
      g = 115 + (180 - 115) * t;
      b = 51 + (60 - 51) * t;
    } else {
      // Highlights (Crispy top)
      const t = (h - 180) / 75;
      r = 240 + (255 - 240) * t;
      g = 180 + (245 - 180) * t;
      b = 60 + (220 - 60) * t;
    }
    
    // Add "torn paper" high freq noise (already in height map but emphasize in color)
    // Darken low-noise spots significantly
    // In step 1 we added noise. Let's assume height map has it.
    // If H is very high (flake tip), make it extra light
    if (h > 240) {
      r = 255; g = 250; b = 240;
    }

    // Burnt spots (random)
    if (Math.random() > 0.99) {
      r *= 0.5; g *= 0.5; b *= 0.4;
    }

    cData[i] = r;
    cData[i+1] = g;
    cData[i+2] = b;
    cData[i+3] = 255;
  }
  colorCtx.putImageData(heightData, 0, 0);

  // --- 3. Roughness Map ---
  // Invert height roughly: Peaks are smoother (oil/egg wash), Valleys are rougher
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d');
  
  const rData = ctx.getImageData(0, 0, size, size); // grab height again
  const rd = rData.data;
  for (let i = 0; i < rd.length; i+=4) {
    const h = rd[i];
    // Invert: 255 -> 0 (smooth), 0 -> 255 (rough)
    // But let's clamp. Egg wash makes top shiny (roughness ~0.4), cracks dry (~0.9).
    const val = 0.9 - (h/255) * 0.5; // 0.9 down to 0.4
    const pixel = val * 255;
    rd[i] = pixel; rd[i+1]=pixel; rd[i+2]=pixel;
  }
  roughCtx.putImageData(rData, 0, 0);

  // --- Create Textures ---
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  
  // Normal Map (Simple Sobel approximation from height)
  // For brevity, we'll skip full manual Sobel and let bumpScale do the heavy lifting on the StandardMaterial,
  // or use a very simple normal map if critical.
  // Let's rely on the geometry detail + roughness map for now to save complexity, 
  // or generate a basic one if needed.
  // A simple normal map is better.
  const normalCanvas = createNormalMap(heightCanvas);
  const normalMap = new THREE.CanvasTexture(normalCanvas);

  // AO Map (Inverted blurred height)
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = size;
  aoCanvas.height = size;
  const aoCtx = aoCanvas.getContext('2d');
  aoCtx.filter = 'blur(10px)';
  aoCtx.drawImage(heightCanvas, 0, 0); // draw height
  // Invert for AO (peaks = white = no occlusion? No, peaks = white, valleys = black. 
  // AO map: white = fully lit, black = occluded.
  // Valleys should be darker. So Height map is actually a good AO map base!
  // Just maybe contrast it a bit.
  const aoMap = new THREE.CanvasTexture(aoCanvas);

  return { map, normalMap, roughnessMap, aoMap };
}

export function makeFillingTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Base: Pale yellowish-white (Dough + Cheese)
  ctx.fillStyle = '#fdf5e6'; // Old Lace
  ctx.fillRect(0, 0, size, size);
  
  // Layers (Wavy horizontal lines)
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      
      // Layer Wave
      const wave = Math.sin(y * 0.1 + Math.sin(x * 0.05) * 5) * 0.5 + 0.5;
      
      // Noise (Cheese crumbles vs Air pockets)
      const noise = Math.random();
      
      let r = 253, g = 245, b = 230; // Base
      
      // Darker layers (Dough separation)
      if (wave < 0.3) {
        // Golden brown tint
        r = 210; g = 160; b = 100; 
      }
      
      // Cheese White chunks
      if (noise > 0.8) {
        r = 255; g = 255; b = 255;
      }
      
      // Egg Yellow spots
      if (noise < 0.1) {
        r = 255; g = 220; b = 100;
      }
      
      // Apply noise intensity
      const varN = (Math.random() - 0.5) * 20;
      
      data[i] = Math.min(255, Math.max(0, r + varN));
      data[i+1] = Math.min(255, Math.max(0, g + varN));
      data[i+2] = Math.min(255, Math.max(0, b + varN));
      data[i+3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 1); // Stretch horizontally along the cut

  // Normal Map for layers
  // Simple: just use intensity of wave derivative?
  // Let's reuse the generator logic to make a bump map
  // ... or just return map and let standard material derive normals from bumpMap if we provide one.
  // Let's provide a bump map (grayscale version of above).
  
  // Reuse canvas for bump
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');
  
  const bImgData = bCtx.createImageData(size, size);
  for (let k = 0; k < data.length; k+=4) {
    const gray = (data[k] + data[k+1] + data[k+2]) / 3;
    bImgData.data[k] = gray;
    bImgData.data[k+1] = gray;
    bImgData.data[k+2] = gray;
    bImgData.data[k+3] = 255;
  }
  bCtx.putImageData(bImgData, 0, 0);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 1);

  return { map, bumpMap };
}

function createNormalMap(heightCanvas) {
  const size = heightCanvas.width;
  const ctx = heightCanvas.getContext('2d');
  const data = ctx.getImageData(0, 0, size, size).data;
  
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d');
  const nData = nCtx.createImageData(size, size);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Get neighbors
      const i = (y * size + x) * 4;
      const left = (y * size + Math.max(0, x-1)) * 4;
      const right = (y * size + Math.min(size-1, x+1)) * 4;
      const up = (Math.max(0, y-1) * size + x) * 4;
      const down = (Math.min(size-1, y+1) * size + x) * 4;
      
      const dx = (data[right] - data[left]) * 2.0; // scale strength
      const dy = (data[down] - data[up]) * 2.0;
      const dz = 255.0; // strength Z
      
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Encode to RGB 0..255
      nData.data[i] = ((dx/len) * 0.5 + 0.5) * 255;
      nData.data[i+1] = ((dy/len) * 0.5 + 0.5) * 255;
      nData.data[i+2] = ((dz/len) * 0.5 + 0.5) * 255;
      nData.data[i+3] = 255;
    }
  }
  nCtx.putImageData(nData, 0, 0);
  return normalCanvas;
}
