import * as THREE from 'three';

export function buildBanitsa({
  sliceCount, 
  radius, 
  height, 
  gapDeg = 1.0, // Gap between slices in degrees
  edgeDip = 0.02, // How much the edges dip down (simulation of rolled dough)
  wobbleAmp = 0.02,
  topMaterial,
  sideMaterial,
  fortunes,
  coinIndex
}) {
  const group = new THREE.Group();
  const anglePerSlice = (Math.PI * 2) / sliceCount;
  // Convert gap to radians
  const gapRad = THREE.MathUtils.degToRad(gapDeg);
  // Actual angle of the slice is the full segment minus the gap
  // We center the slice in its slot
  const sliceAngle = anglePerSlice - gapRad;
  
  if (sliceAngle <= 0) {
    console.warn("Gap is too large for the number of slices!");
    return group;
  }

  for (let i = 0; i < sliceCount; i++) {
    // --- Geometry Generation ---
    const shape = new THREE.Shape();
    
    // We draw the shape centered around angle 0 for simpler UV mapping later, then rotate the mesh
    // Or we can draw it in place. Let's draw it from 0 to sliceAngle to keep it simple
    shape.moveTo(0, 0);
    shape.arc(0, 0, radius, 0, sliceAngle, false);
    shape.lineTo(0, 0);

    const extrudeSettings = {
      steps: 1,
      depth: height,
      bevelEnabled: false, // Disable bevel to keep sides sharp (cut-like)
      curveSegments: 12
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // --- Micro-details (Edge Dip & Wobble) ---
    // Modify top vertices to simulate "rolled dough" rounding at the edges manually
    
    const posAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    
    for ( let v = 0; v < posAttribute.count; v ++ ) {
      vertex.fromBufferAttribute( posAttribute, v );
      
      // Without bevel, Z ranges exactly from 0 to height
      // Top face is at Z = height
      if (Math.abs(vertex.z - height) < 0.001) {
        // We are on top.
        // 1. Polar coordinates relative to slice start
        const d = Math.sqrt(vertex.x*vertex.x + vertex.y*vertex.y);
        const angle = Math.atan2(vertex.y, vertex.x); // 0 to sliceAngle
        
        // 2. Edge Dip: varying Z based on proximity to angle 0 or angle sliceAngle
        // Normalize angle to 0..1
        let t = angle / sliceAngle;
        // Clamp t for safety
        t = Math.max(0, Math.min(1, t));
        
        const distToEdge = Math.min(t, 1-t); 
        // dipFactor = 1 at edges, 0 at center
        // Using smoothstep-like curve
        const dipFactor = Math.pow(1 - (distToEdge * 2), 3); 
        
        vertex.z -= dipFactor * edgeDip;

        // 3. Wobble
        const noise = Math.sin(vertex.x * 3) * Math.cos(vertex.y * 3);
        vertex.z += noise * wobbleAmp;
      }
      
      posAttribute.setXYZ( v, vertex.x, vertex.y, vertex.z );
    }
    
    geometry.computeVertexNormals();

    // --- UV Remapping for Top Face (Planar Projection) ---
    // We want a planar mapping (Top-Down) so a photo of a round banitsa maps perfectly.
    // UV space 0..1 corresponds to X: -radius..+radius, Z: -radius..+radius (World Space)
    const uvAttribute = geometry.attributes.uv;
    
    // We need to iterate again because we might have modified positions in the previous loop
    // or we can do it in the same loop if careful. But position attribute is updated in place.
    // Let's do a separate loop to be safe and clear.
    
    const worldVertex = new THREE.Vector3();

    for ( let v = 0; v < posAttribute.count; v ++ ) {
      worldVertex.fromBufferAttribute( posAttribute, v );
      
      // Check if vertex is on the top face
      // Note: we modified Z in previous loop, so check against height * 0.9
      if (worldVertex.z > height * 0.5) {
        // Current vertex is in "Slice Local" space (before Y-rotation).
        // Coordinate system: X is radial-ish, Y is tangential-ish.
        
        // We need to rotate vector (x, y) by the slice angle to get global x, y.
        const sliceRotation = -(i * anglePerSlice + gapRad/2);
        
        // Rotate point (x,y)
        const cos = Math.cos(sliceRotation);
        const sin = Math.sin(sliceRotation);
        
        const gx = worldVertex.x * cos - worldVertex.y * sin;
        const gy = worldVertex.x * sin + worldVertex.y * cos;
        
        // Map gx, gy (which are within -radius..radius) to 0..1 UVs.
        // We map -radius to 0, +radius to 1.
        // SCALE ADJUSTMENT:
        // The user wants to "shrink the outer circle" to avoid gaps.
        // This means we need to map the geometry radius (5) to a smaller UV radius (e.g. < 0.5).
        // So we DIVIDE by a larger number.
        // radius * 1.1 -> UVs go from ~0.05 to ~0.95.
        // This ensures we stay inside the "safe" non-transparent area of the texture.
        const mapRadius = radius * 1.1;
        
        const u = (gx / (2 * mapRadius)) + 0.5;
        const vCoord = (gy / (2 * mapRadius)) + 0.5;
        
        uvAttribute.setXY(v, u, vCoord); 
      } else {
        // Side Vertex
        // PROJECT Top Texture Down:
        
        const sliceRotation = -(i * anglePerSlice + gapRad/2);
        const cos = Math.cos(sliceRotation);
        const sin = Math.sin(sliceRotation);
        
        const gx = worldVertex.x * cos - worldVertex.y * sin;
        const gy = worldVertex.x * sin + worldVertex.y * cos;
        
        // Use same safe scale
        const mapRadius = radius * 1.1;
        
        const u = (gx / (2 * mapRadius)) + 0.5;
        const vCoord = (gy / (2 * mapRadius)) + 0.5;
        
        uvAttribute.setXY(v, u, vCoord);
      }
    }
    uvAttribute.needsUpdate = true;

    // --- Mesh Creation ---
    // Rotate geometry to lay flat (Extrude is usually along Z)
    geometry.rotateX(-Math.PI / 2);

    const sliceMesh = new THREE.Mesh(geometry, [topMaterial, sideMaterial]);
    
    // Position & Rotation
    // We generated the shape from 0 to sliceAngle.
    // We need to rotate it around Y to its slot.
    // Slot i starts at i * anglePerSlice.
    // We also center it within that slot if we want equal gaps, or just offset by gap/2.
    const rotationY = - (i * anglePerSlice + gapRad / 2); 
    // Note: - rotation because standard math is CCW, but usually in 3D we might want matching indices.
    // Let's stick to standard: positive angle.
    
    sliceMesh.rotation.y = -(i * anglePerSlice + gapRad/2); 
    // Wait, extrude geometry shape was X/Y plane. We rotated X -90. Now it's X/Z plane.
    // Rotation Y rotates around center.
    
    sliceMesh.castShadow = true;
    sliceMesh.receiveShadow = true;
    
    // User Data
    sliceMesh.userData = {
      id: i,
      fortune: fortunes[i],
      hasCoin: (i === coinIndex),
      originalY: 0
    };
    
    // Name for raycasting
    sliceMesh.name = `slice-${i}`;

    group.add(sliceMesh);
  }
  
  return group;
}
