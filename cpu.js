/* ====================================================
   CPU 3D MODEL BUILDER
   Baut ein prozedurales CPU-Modell mit separaten
   Layer-Gruppen für die Exploded-View-Animation.
   ==================================================== */

import * as THREE from 'three';

/**
 * Baut ein CPU-Modell und gibt eine Group zurück, deren
 * Kinder einzeln benannte Layer-Gruppen sind (für die
 * Exploded-View beim Scrollen/Hovern).
 */
export function buildCPU(THREE_NS) {
  const T = THREE_NS || THREE;
  const root = new T.Group();
  root.name = 'cpu-root';

  const cyan = 0x00D9FF;
  const gold = 0xC9A227;
  const darkMetal = 0x2A3040;
  const pcbGreen = 0x1B3B2E;

  // --- Layer 0: Pins / Pad-Array (bottom) ---
  const pinsGroup = new T.Group();
  pinsGroup.name = 'layer-pins';
  const pinGeo = new T.CylinderGeometry(0.014, 0.014, 0.05, 6);
  const pinMat = new T.MeshStandardMaterial({ color: gold, metalness: 0.9, roughness: 0.3 });
  const gridSize = 14;
  const spacing = 0.09;
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      if ((x + z) % 5 === 0) continue; // sparse pattern, looks more like real LGA
      const pin = new T.Mesh(pinGeo, pinMat);
      pin.position.set(
        (x - gridSize / 2) * spacing,
        0,
        (z - gridSize / 2) * spacing
      );
      pinsGroup.add(pin);
    }
  }
  root.add(pinsGroup);

  // --- Layer 1: Substrate PCB ---
  const substrateGroup = new T.Group();
  substrateGroup.name = 'layer-substrate';
  const substrateGeo = new T.BoxGeometry(1.4, 0.06, 1.4);
  const substrateMat = new T.MeshStandardMaterial({ color: pcbGreen, metalness: 0.3, roughness: 0.7 });
  const substrate = new T.Mesh(substrateGeo, substrateMat);
  substrate.position.y = 0.08;
  substrateGroup.add(substrate);

  // Edge components (small capacitors around substrate)
  const capGeo = new T.CylinderGeometry(0.02, 0.02, 0.03, 8);
  const capMat = new T.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const r = 0.62;
    const cap = new T.Mesh(capGeo, capMat);
    cap.position.set(Math.cos(angle) * r, 0.1, Math.sin(angle) * r);
    substrateGroup.add(cap);
  }
  root.add(substrateGroup);

  // --- Layer 2: IMC / Memory Controller (small die next to main die) ---
  const imcGroup = new T.Group();
  imcGroup.name = 'layer-imc';
  const imcGeo = new T.BoxGeometry(0.22, 0.05, 0.5);
  const imcMat = new T.MeshStandardMaterial({ color: 0x3A4254, metalness: 0.5, roughness: 0.5 });
  const imc = new T.Mesh(imcGeo, imcMat);
  imc.position.set(0.55, 0.14, 0);
  imcGroup.add(imc);
  root.add(imcGroup);

  // --- Layer 3: Cache rings (visualized as concentric thin rings on die) ---
  const cacheGroup = new T.Group();
  cacheGroup.name = 'layer-cache';
  const cacheMat = new T.MeshStandardMaterial({
    color: cyan, metalness: 0.4, roughness: 0.3, emissive: cyan, emissiveIntensity: 0.15,
  });
  for (let i = 0; i < 3; i++) {
    const ringGeo = new T.TorusGeometry(0.15 + i * 0.05, 0.004, 8, 48);
    const ring = new T.Mesh(ringGeo, cacheMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-0.15, 0.19, 0);
    cacheGroup.add(ring);
  }
  root.add(cacheGroup);

  // --- Layer 4: Cores (small dies arranged in grid) ---
  const coresGroup = new T.Group();
  coresGroup.name = 'layer-cores';
  const coreGeo = new T.BoxGeometry(0.13, 0.045, 0.13);
  const coreMat = new T.MeshStandardMaterial({
    color: 0x445063, metalness: 0.6, roughness: 0.35, emissive: cyan, emissiveIntensity: 0.05,
  });
  const coreGrid = 4;
  for (let x = 0; x < coreGrid; x++) {
    for (let z = 0; z < coreGrid; z++) {
      const core = new T.Mesh(coreGeo, coreMat);
      core.position.set(
        -0.32 + x * 0.15,
        0.17,
        -0.32 + z * 0.15
      );
      coresGroup.add(core);
    }
  }
  root.add(coresGroup);

  // --- Layer 5: Die (the main silicon block, sits above cores visually) ---
  const dieGroup = new T.Group();
  dieGroup.name = 'layer-die';
  const dieGeo = new T.BoxGeometry(0.78, 0.05, 0.78);
  const dieMat = new T.MeshStandardMaterial({
    color: darkMetal, metalness: 0.8, roughness: 0.25,
    emissive: cyan, emissiveIntensity: 0.04,
  });
  const die = new T.Mesh(dieGeo, dieMat);
  die.position.y = 0.16;
  dieGroup.add(die);

  // subtle circuit-line texture via thin emissive lines
  const lineMat = new T.MeshBasicMaterial({ color: cyan, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 6; i++) {
    const lineGeo = new T.BoxGeometry(0.7, 0.001, 0.004);
    const line = new T.Mesh(lineGeo, lineMat);
    line.position.set(0, 0.186, -0.3 + i * 0.12);
    dieGroup.add(line);
  }
  root.add(dieGroup);

  // --- Layer 6: IHS (Integrated Heat Spreader / lid) ---
  const ihsGroup = new T.Group();
  ihsGroup.name = 'layer-ihs';
  const ihsGeo = new T.BoxGeometry(1.0, 0.08, 1.0);
  const ihsMat = new T.MeshStandardMaterial({ color: 0xC8CDD4, metalness: 0.95, roughness: 0.15 });
  const ihs = new T.Mesh(ihsGeo, ihsMat);
  ihs.position.y = 0.24;
  ihsGroup.add(ihs);

  // brand notch detail
  const notchGeo = new T.BoxGeometry(0.08, 0.02, 0.02);
  const notchMat = new T.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.4 });
  const notch1 = new T.Mesh(notchGeo, notchMat);
  notch1.position.set(0.46, 0.24, 0.46);
  ihsGroup.add(notch1);

  root.add(ihsGroup);

  // Store layer order for animation purposes
  root.userData.layerOrder = [
    'layer-pins', 'layer-substrate', 'layer-imc',
    'layer-cores', 'layer-cache', 'layer-die', 'layer-ihs',
  ];
  root.userData.restingY = {};
  root.children.forEach(child => {
    root.userData.restingY[child.name] = child.position.y || 0;
  });

  root.scale.setScalar(1.6);
  return root;
}
