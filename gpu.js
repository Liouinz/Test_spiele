/* ====================================================
   GPU 3D MODEL BUILDER
   ==================================================== */

import * as THREE from 'three';

export function buildGPU(THREE_NS) {
  const T = THREE_NS || THREE;
  const root = new T.Group();
  root.name = 'gpu-root';

  const orange = 0xFF6B35;
  const pcbDark = 0x141826;
  const metalGray = 0x3A4150;
  const copperColor = 0xB87333;

  // --- Layer 0: Backplate ---
  const backplateGroup = new T.Group();
  backplateGroup.name = 'layer-backplate';
  const backplateGeo = new T.BoxGeometry(2.6, 0.03, 0.9);
  const backplateMat = new T.MeshStandardMaterial({ color: 0x1A1E28, metalness: 0.85, roughness: 0.3 });
  const backplate = new T.Mesh(backplateGeo, backplateMat);
  backplate.position.y = -0.18;
  backplateGroup.add(backplate);
  root.add(backplateGroup);

  // --- Layer 1: PCB ---
  const pcbGroup = new T.Group();
  pcbGroup.name = 'layer-pcb';
  const pcbGeo = new T.BoxGeometry(2.5, 0.04, 0.85);
  const pcbMat = new T.MeshStandardMaterial({ color: pcbDark, metalness: 0.2, roughness: 0.75 });
  const pcb = new T.Mesh(pcbGeo, pcbMat);
  pcb.position.y = -0.1;
  pcbGroup.add(pcb);

  // PCIe connector (gold fingers at the edge)
  const fingerGeo = new T.BoxGeometry(0.025, 0.02, 0.18);
  const fingerMat = new T.MeshStandardMaterial({ color: 0xC9A227, metalness: 0.9, roughness: 0.25 });
  for (let i = 0; i < 18; i++) {
    const finger = new T.Mesh(fingerGeo, fingerMat);
    finger.position.set(-1.15 + i * 0.03, -0.13, -0.55);
    pcbGroup.add(finger);
  }
  root.add(pcbGroup);

  // --- Layer 2: VRMs (small components near power connector) ---
  const vrmGroup = new T.Group();
  vrmGroup.name = 'layer-vrm';
  const vrmGeo = new T.CylinderGeometry(0.035, 0.035, 0.06, 8);
  const vrmMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 8; i++) {
    const vrm = new T.Mesh(vrmGeo, vrmMat);
    vrm.position.set(0.85, -0.06, -0.3 + i * 0.08);
    vrmGroup.add(vrm);
  }
  root.add(vrmGroup);

  // --- Layer 3: VRAM modules around the die ---
  const vramGroup = new T.Group();
  vramGroup.name = 'layer-vram';
  const vramGeo = new T.BoxGeometry(0.16, 0.025, 0.16);
  const vramMat = new T.MeshStandardMaterial({ color: 0x1F2430, metalness: 0.5, roughness: 0.5 });
  const vramPositions = [
    [-0.5, -0.05, 0.28], [-0.3, -0.05, 0.28], [0.3, -0.05, 0.28], [0.5, -0.05, 0.28],
    [-0.5, -0.05, -0.28], [-0.3, -0.05, -0.28], [0.3, -0.05, -0.28], [0.5, -0.05, -0.28],
  ];
  vramPositions.forEach(pos => {
    const vram = new T.Mesh(vramGeo, vramMat);
    vram.position.set(...pos);
    vramGroup.add(vram);
  });
  root.add(vramGroup);

  // --- Layer 4: GPU Die ---
  const dieGroup = new T.Group();
  dieGroup.name = 'layer-die';
  const dieGeo = new T.BoxGeometry(0.5, 0.045, 0.5);
  const dieMat = new T.MeshStandardMaterial({
    color: 0x0D0F14, metalness: 0.85, roughness: 0.2,
    emissive: orange, emissiveIntensity: 0.08,
  });
  const die = new T.Mesh(dieGeo, dieMat);
  die.position.y = -0.04;
  dieGroup.add(die);
  root.add(dieGroup);

  // --- Layer 5: Heatpipes ---
  const heatpipeGroup = new T.Group();
  heatpipeGroup.name = 'layer-heatpipes';
  const pipeMat = new T.MeshStandardMaterial({ color: copperColor, metalness: 0.95, roughness: 0.2 });
  const pipePositions = [-0.7, -0.35, 0, 0.35, 0.7];
  pipePositions.forEach(x => {
    const pipeGeo = new T.CylinderGeometry(0.035, 0.035, 1.0, 12);
    const pipe = new T.Mesh(pipeGeo, pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(x, 0.08, 0);
    heatpipeGroup.add(pipe);
  });
  root.add(heatpipeGroup);

  // --- Layer 6: Heatsink fins ---
  const finsGroup = new T.Group();
  finsGroup.name = 'layer-fins';
  const finMat = new T.MeshStandardMaterial({ color: metalGray, metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < 24; i++) {
    const finGeo = new T.BoxGeometry(0.012, 0.32, 0.78);
    const fin = new T.Mesh(finGeo, finMat);
    fin.position.set(-1.15 + i * 0.1, 0.22, 0);
    finsGroup.add(fin);
  }
  root.add(finsGroup);

  // --- Layer 7: Shroud + Fans ---
  const shroudGroup = new T.Group();
  shroudGroup.name = 'layer-shroud';

  const shroudMat = new T.MeshStandardMaterial({ color: 0x1A1D24, metalness: 0.6, roughness: 0.4 });
  const shroudGeo = new T.BoxGeometry(2.55, 0.06, 0.88);
  const shroudTop = new T.Mesh(shroudGeo, shroudMat);
  shroudTop.position.y = 0.42;
  shroudGroup.add(shroudTop);

  const fanRimMat = new T.MeshStandardMaterial({ color: 0x22262E, metalness: 0.5, roughness: 0.5 });
  const bladeMat = new T.MeshStandardMaterial({
    color: 0x2C313C, metalness: 0.4, roughness: 0.45,
    emissive: orange, emissiveIntensity: 0.03,
  });

  [-0.75, 0, 0.75].forEach(x => {
    const fanGroup = new T.Group();
    const rimGeo = new T.TorusGeometry(0.32, 0.025, 12, 32);
    const rim = new T.Mesh(rimGeo, fanRimMat);
    fanGroup.add(rim);

    const hubGeo = new T.CylinderGeometry(0.06, 0.06, 0.04, 16);
    const hub = new T.Mesh(hubGeo, fanRimMat);
    hub.rotation.x = Math.PI / 2;
    fanGroup.add(hub);

    const bladeCount = 9;
    for (let b = 0; b < bladeCount; b++) {
      const bladeGeo = new T.BoxGeometry(0.27, 0.012, 0.06);
      const blade = new T.Mesh(bladeGeo, bladeMat);
      const angle = (b / bladeCount) * Math.PI * 2;
      blade.position.set(Math.cos(angle) * 0.16, 0, Math.sin(angle) * 0.16);
      blade.rotation.y = angle + 0.5;
      fanGroup.add(blade);
    }

    fanGroup.position.set(x, 0.46, 0);
    fanGroup.rotation.x = Math.PI / 2;
    fanGroup.name = `fan-${x}`;
    shroudGroup.add(fanGroup);
  });

  root.add(shroudGroup);

  root.userData.layerOrder = [
    'layer-backplate', 'layer-pcb', 'layer-vrm', 'layer-vram',
    'layer-die', 'layer-heatpipes', 'layer-fins', 'layer-shroud',
  ];
  root.userData.restingY = {};
  root.children.forEach(child => {
    root.userData.restingY[child.name] = child.position.y || 0;
  });
  root.userData.fans = shroudGroup.children.filter(c => c.name.startsWith('fan-'));

  root.scale.setScalar(0.95);
  return root;
}
