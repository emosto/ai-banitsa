import * as THREE from 'three';

export function makeTopMaterial(textureSet) {
  return new THREE.MeshStandardMaterial({
    map: textureSet.map,
    normalMap: textureSet.normalMap,
    roughnessMap: textureSet.roughnessMap,
    aoMap: textureSet.aoMap,
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.0,
    bumpScale: 0.05, // Additional bump from normal map
    side: THREE.DoubleSide
  });
}

export function makeSideMaterial(fillingTexture = null) {
  if (!fillingTexture) {
    return new THREE.MeshStandardMaterial({
      color: 0xb67636, 
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
  }
  
  return new THREE.MeshStandardMaterial({
    map: fillingTexture.map,
    bumpMap: fillingTexture.bumpMap,
    bumpScale: 0.05,
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide
  });
}
