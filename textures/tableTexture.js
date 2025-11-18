import * as THREE from 'three';

export function makeTableTexture(color1 = '#f0f0f0', color2 = '#c0392b') {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Background (Color 1)
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, size, size);
  
  // Checkers (Color 2)
  ctx.fillStyle = color2;
  const squares = 8;
  const step = size / squares;
  
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillRect(x * step, y * step, step, step);
      }
    }
  }
  
  // Cloth Fabric Noise
  const imgData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + noise));
    imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4); // Tile it on the table
  
  return texture;
}
