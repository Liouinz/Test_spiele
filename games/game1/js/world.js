/**
 * ============================================================
 * WORLD MODULE  –  world.js
 * ============================================================
 * Verantwortlich für:
 *   - Terrain: Spielfeld-Gras (Textur + leichte Unebenheiten)
 *   - Außengelände: Waldboden mit Hügeln am Rand
 *   - Wald: 90 Bäume via InstancedMesh (Stamm + 3 Laub-Schichten)
 *   - Zaun: Pfosten + Querlatten via InstancedMesh
 *   - Gras-Billboards: Streupflanzen für Bodendichte
 *   - Wind-System: Phasenverschobene Sinus-Animation pro Baum
 *
 * Performance-Entscheidungen:
 *   - InstancedMesh für Bäume: 90 Bäume = ~5 Draw Calls statt 270+
 *   - Geteilte Geometrien/Materialien für alle Instanzen
 *   - Prozedurale Canvas-Texturen = 0 externe HTTP-Requests
 *   - Vertex Displacement für Terrain: ohne Physics-Overhead
 * ============================================================
 */

import { THREE } from './engine.js';

// ─── Welt-Dimensionen ─────────────────────────────────────
export const WORLD = {
  fieldW:  32,   // Spielfeld Breite (X)
  fieldD:  64,   // Spielfeld Tiefe  (Z)
  get hw() { return this.fieldW / 2; },  // 16
  get hd() { return this.fieldD / 2; },  // 32
};

// ─── Textur-Fabrik (alle Texturen prozedural) ─────────────
const TexFactory = {

  // Gras-Textur mit Zellen-Variation + zarten Gitterlinien
  grass() {
    const CW = WORLD.fieldW * 20, CH = WORLD.fieldD * 20;
    const cv  = document.createElement('canvas');
    cv.width  = CW; cv.height = CH;
    const ctx = cv.getContext('2d');

    // Basis-Gras (Zell-Variationen für organisches Aussehen)
    for (let x = 0; x < WORLD.fieldW; x++) {
      for (let z = 0; z < WORLD.fieldD; z++) {
        const v   = 0.82 + Math.random() * 0.28;
        const r   = Math.round(55  * v);
        const g   = Math.round(118 * v);
        const b   = Math.round(50  * v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x * 20, z * 20, 20, 20);

        // Sporadische hellere/dunklere Grasbüschel
        if (Math.random() < 0.3) {
          const bv = 0.6 + Math.random() * 0.5;
          ctx.fillStyle = `rgba(${Math.round(40*bv)},${Math.round(130*bv)},${Math.round(35*bv)},0.35)`;
          ctx.beginPath();
          ctx.arc(x*20 + Math.random()*20, z*20 + Math.random()*20, 2+Math.random()*4, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }

    // Zarte Gitterlinien
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth   = 0.6;
    for (let x = 0; x <= WORLD.fieldW; x++) {
      ctx.beginPath(); ctx.moveTo(x*20, 0); ctx.lineTo(x*20, CH); ctx.stroke();
    }
    for (let z = 0; z <= WORLD.fieldD; z++) {
      ctx.beginPath(); ctx.moveTo(0, z*20); ctx.lineTo(CW, z*20); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  },

  // Waldboden: dunkles Grün mit Rauschen-Textur
  forestFloor() {
    const cv  = document.createElement('canvas');
    cv.width  = cv.height = 512;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#2e4220';
    ctx.fillRect(0, 0, 512, 512);

    // Laubstreu + Boden-Variation
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      const s = 1.5 + Math.random() * 6;
      const v = Math.random();
      ctx.fillStyle = v > 0.65
        ? `rgba(80,110,40,${0.15 + Math.random() * 0.28})`
        : `rgba(18,28,10,${0.12 + Math.random() * 0.2})`;
      ctx.fillRect(x, y, s, s);
    }

    // Moos-Flecken
    for (let i = 0; i < 30; i++) {
      const x = Math.random()*512, y = Math.random()*512;
      const r = 8 + Math.random()*20;
      const g = ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0, 'rgba(60,100,35,0.3)');
      g.addColorStop(1, 'rgba(60,100,35,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 22);
    tex.anisotropy = 4;
    return tex;
  },

  // Holz-Textur für Zaun (PBR)
  wood() {
    const cv  = document.createElement('canvas');
    cv.width  = 256; cv.height = 64;
    const ctx = cv.getContext('2d');

    // Basis
    const grad = ctx.createLinearGradient(0,0,0,64);
    grad.addColorStop(0,   '#8B5E35');
    grad.addColorStop(0.5, '#7a4e2d');
    grad.addColorStop(1,   '#6B3F20');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,256,64);

    // Maserung: viele horizontale Linien in verschiedenen Brauntönen
    for (let i = 0; i < 22; i++) {
      const y     = Math.random() * 64;
      const alpha = 0.1 + Math.random() * 0.22;
      const light = Math.random() > 0.5;
      ctx.strokeStyle = light
        ? `rgba(220,170,110,${alpha})`
        : `rgba(30,10,0,${alpha})`;
      ctx.lineWidth = 0.6 + Math.random() * 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (Math.random()-0.5)*5);
      ctx.stroke();
    }

    // Holzknoten
    for (let i = 0; i < 3; i++) {
      const kx = 20 + Math.random() * 216;
      const ky = 10 + Math.random() * 44;
      const ctx2 = cv.getContext('2d');
      ctx2.fillStyle = `rgba(35,12,0,0.28)`;
      ctx2.beginPath();
      ctx2.ellipse(kx, ky, 6 + Math.random()*6, 3 + Math.random()*3, Math.random()*0.8, 0, Math.PI*2);
      ctx2.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },

  // Rinden-Textur für Baumstämme
  bark() {
    const cv  = document.createElement('canvas');
    cv.width  = 128; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#5C3A1E';
    ctx.fillRect(0, 0, 128, 256);

    // Vertikale Rissen-Muster
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 128;
      ctx.strokeStyle = Math.random() > 0.5
        ? `rgba(30,10,0,0.35)`
        : `rgba(180,130,80,0.2)`;
      ctx.lineWidth = 0.5 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      let cy = 0;
      while (cy < 256) {
        cy += 8 + Math.random() * 20;
        ctx.lineTo(x + (Math.random()-0.5)*8, cy);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 3);
    tex.anisotropy = 2;
    return tex;
  },
};

// ─── World-Klasse ─────────────────────────────────────────
export class World {
  constructor(engine) {
    this.engine     = engine;
    this.scene      = engine.scene;
    this.treeData   = [];   // { group, phase, freq, strength } je Baum
    this._elapsed   = 0;
  }

  build() {
    this._buildFieldGround();
    this._buildOuterGround();
    this._buildEdgeHills();
    this._buildFence();
    this._buildForest();
    this._buildGrassPatches();
    return this;
  }

  // ── Spielfeld-Boden ──────────────────────────────────────
  _buildFieldGround() {
    // Leichte Vertex-Unebenheiten (nur visuell, Kollision bleibt eben)
    const geo = new THREE.PlaneGeometry(WORLD.fieldW, WORLD.fieldD, 32, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getY(i);
      // Nur in der Mitte – Ränder bleiben flach für sauberen Zaun-Übergang
      const distToEdge = Math.min(
        WORLD.hw - Math.abs(x),
        WORLD.hd - Math.abs(z)
      );
      if (distToEdge > 2.5) {
        pos.setZ(i, (Math.sin(x*0.8)*Math.cos(z*0.6)) * 0.08);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map:       TexFactory.grass(),
      roughness: 0.92,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x    = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ── Außen-Waldboden ──────────────────────────────────────
  _buildOuterGround() {
    const geo = new THREE.PlaneGeometry(300, 350, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map:       TexFactory.forestFloor(),
      roughness: 0.96,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x    = -Math.PI / 2;
    mesh.position.y    = -0.01;  // minimal tiefer = kein Z-Fighting
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ── Hügel am Rand (Terrain steigt leicht an) ─────────────
  // Vier gebogene Hügel-Streifen entlang der Zaun-Kanten
  _buildEdgeHills() {
    const hillMat = new THREE.MeshStandardMaterial({
      map:       TexFactory.forestFloor(),
      roughness: 0.94,
      metalness: 0.0,
    });

    const makeHill = (w, d, tx, ty, tz, ry) => {
      // Hügel-Geometrie: in der Mitte angehoben
      const geo = new THREE.PlaneGeometry(w, d, 16, 16);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = (pos.getX(i) / (w*0.5) + 1) * 0.5;  // 0..1
        // Sanfter Anstieg: Cosinus-Kurve → höher in der Mitte des Streifens
        const h = Math.cos((u - 0.5) * Math.PI) * 1.8;
        pos.setZ(i, Math.max(0, h));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, hillMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = ry;
      mesh.position.set(tx, ty, tz);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };

    // Norden
    makeHill(WORLD.fieldW + 28, 14, 0, 0, -(WORLD.hd + 7), 0);
    // Süden
    makeHill(WORLD.fieldW + 28, 14, 0, 0,  (WORLD.hd + 7), Math.PI);
    // Westen
    makeHill(14, WORLD.fieldD + 28, -(WORLD.hw + 7), 0, 0, 0);
    // Osten
    makeHill(14, WORLD.fieldD + 28,  (WORLD.hw + 7), 0, 0, 0);
  }

  // ── Zaun (InstancedMesh: 3 Draw Calls für alle Teile) ────
  _buildFence() {
    const woodTex  = TexFactory.wood();
    const postMat  = new THREE.MeshStandardMaterial({
      map: woodTex, roughness: 0.85, metalness: 0.0,
    });
    const railMat  = new THREE.MeshStandardMaterial({
      map: woodTex, roughness: 0.85, metalness: 0.0,
    });
    const dummy = new THREE.Object3D();

    // ── Pfosten ──
    const postPositions = [];
    const spacing = 2.0;  // Pfosten alle 2 Einheiten

    // Nord/Süd-Seiten (X-Achse)
    for (let x = -WORLD.hw; x <= WORLD.hw; x += spacing) {
      // Leichte zufällige Neigung für nicht-perfekten Zaun
      postPositions.push({ x, z: -WORLD.hd, rx: (Math.random()-0.5)*0.04, rz: (Math.random()-0.5)*0.04 });
      postPositions.push({ x, z:  WORLD.hd, rx: (Math.random()-0.5)*0.04, rz: (Math.random()-0.5)*0.04 });
    }
    // Ost/West-Seiten (Z-Achse), ohne Ecken doppelt
    for (let z = -WORLD.hd + spacing; z <= WORLD.hd - spacing; z += spacing) {
      postPositions.push({ x: -WORLD.hw, z, rx: (Math.random()-0.5)*0.04, rz: (Math.random()-0.5)*0.04 });
      postPositions.push({ x:  WORLD.hw, z, rx: (Math.random()-0.5)*0.04, rz: (Math.random()-0.5)*0.04 });
    }

    const postIM = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 1.6, 0.14),
      postMat,
      postPositions.length
    );
    postPositions.forEach(({ x, z, rx, rz }, i) => {
      dummy.position.set(x, 0.8, z);
      dummy.rotation.set(rx, 0, rz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      postIM.setMatrixAt(i, dummy.matrix);
    });
    postIM.instanceMatrix.needsUpdate = true;
    postIM.castShadow  = postIM.receiveShadow = true;
    this.scene.add(postIM);

    // ── Querlatten X-Richtung (Nord/Süd) ──
    const railXPos = [];
    for (let x = -WORLD.hw; x < WORLD.hw; x += spacing) {
      for (const z of [-WORLD.hd, WORLD.hd]) {
        railXPos.push([x + spacing*0.5, 0.40, z]);
        railXPos.push([x + spacing*0.5, 0.90, z]);
      }
    }
    const railXIM = new THREE.InstancedMesh(
      new THREE.BoxGeometry(spacing + 0.04, 0.1, 0.1),
      railMat,
      railXPos.length
    );
    railXPos.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      railXIM.setMatrixAt(i, dummy.matrix);
    });
    railXIM.instanceMatrix.needsUpdate = true;
    railXIM.castShadow = true;
    this.scene.add(railXIM);

    // ── Querlatten Z-Richtung (Ost/West) ──
    const railZPos = [];
    for (let z = -WORLD.hd; z < WORLD.hd; z += spacing) {
      for (const x of [-WORLD.hw, WORLD.hw]) {
        railZPos.push([x, 0.40, z + spacing*0.5]);
        railZPos.push([x, 0.90, z + spacing*0.5]);
      }
    }
    const railZIM = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 0.1, spacing + 0.04),
      railMat,
      railZPos.length
    );
    railZPos.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      railZIM.setMatrixAt(i, dummy.matrix);
    });
    railZIM.instanceMatrix.needsUpdate = true;
    railZIM.castShadow = true;
    this.scene.add(railZIM);
  }

  // ── Wald (InstancedMesh für Performance) ─────────────────
  _buildForest() {
    const TREE_COUNT = 90;
    const barkMat   = new THREE.MeshStandardMaterial({
      map: TexFactory.bark(), roughness: 0.9, metalness: 0.0,
    });
    // 5 verschiedene Laubfarben für Abwechslung
    const canopyMats = [
      new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.88 }),
      new THREE.MeshStandardMaterial({ color: 0x3a7d35, roughness: 0.88 }),
      new THREE.MeshStandardMaterial({ color: 0x234e1f, roughness: 0.88 }),
      new THREE.MeshStandardMaterial({ color: 0x4a8f3f, roughness: 0.88 }),
      new THREE.MeshStandardMaterial({ color: 0x1e6e24, roughness: 0.88 }),
    ];

    // Geteilte Geometrien (ein Satz Geo für alle Bäume)
    const trunkGeo  = new THREE.CylinderGeometry(0.16, 0.26, 1, 8);
    const coneGeos  = [
      new THREE.ConeGeometry(1.4, 2.0, 7),
      new THREE.ConeGeometry(1.1, 1.7, 7),
      new THREE.ConeGeometry(0.78, 1.4, 7),
    ];

    // InstancedMesh für Stämme
    const trunkIM = new THREE.InstancedMesh(trunkGeo, barkMat, TREE_COUNT);
    // Je 3 Laub-Layer → 3 InstancedMeshes
    const canopyIMs = coneGeos.map(g =>
      new THREE.InstancedMesh(g, canopyMats[0], TREE_COUNT)
    );

    const dummy    = new THREE.Object3D();
    let placed = 0, tries = 0;

    while (placed < TREE_COUNT && tries < 5000) {
      tries++;
      const x = (Math.random() - 0.5) * 130;
      const z = (Math.random() - 0.5) * 175;

      // Außerhalb des Spielfeldes + Puffer
      const inField = Math.abs(x) < WORLD.hw + 3.0 && Math.abs(z) < WORLD.hd + 3.0;
      // Nicht zu weit draußen (hinter Nebel-Grenze)
      const tooFar  = Math.abs(x) > 62 || Math.abs(z) > 82;
      if (inField || tooFar) continue;

      const h  = 2.8 + Math.random() * 4.5;     // Baumhöhe
      const sc = 0.55 + Math.random() * 0.95;   // Gesamt-Skalierung
      const ry = Math.random() * Math.PI * 2;   // Zufällige Drehung

      // Stamm-Instanz
      const trunkH = h * 0.38;
      dummy.position.set(x, trunkH * sc * 0.5, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sc, trunkH, sc);
      dummy.updateMatrix();
      trunkIM.setMatrixAt(placed, dummy.matrix);

      // Laubkegel-Instanzen (3 Schichten)
      const layerYOffsets = [0, h*0.28*sc, h*0.52*sc];
      canopyIMs.forEach((im, li) => {
        const ls = sc * (1.05 - li * 0.18);
        dummy.position.set(x, trunkH * sc + layerYOffsets[li], z);
        dummy.rotation.set(0, ry + li * 0.4, 0);
        dummy.scale.set(ls, ls * (0.9 + Math.random()*0.2), ls);

        // Unterschiedliches Material je Instanz (Farb-Variation)
        const matIdx = Math.floor(Math.random() * canopyMats.length);
        im.setMorphAt?.(placed, null);
        dummy.updateMatrix();
        im.setMatrixAt(placed, dummy.matrix);
      });

      // Wind-Daten für diesen Baum
      this.treeData.push({
        idx:      placed,
        phase:    Math.random() * Math.PI * 2,
        freq:     0.5 + Math.random() * 0.7,
        strength: 0.012 + Math.random() * 0.025,
        x, z,
      });

      placed++;
    }

    [trunkIM, ...canopyIMs].forEach(im => {
      im.instanceMatrix.needsUpdate = true;
      im.castShadow  = true;
      im.receiveShadow = true;
      this.scene.add(im);
    });

    // Referenzen für Wind-Update speichern
    this._trunkIM   = trunkIM;
    this._canopyIMs = canopyIMs;
  }

  // ── Gras-Patches (Billboards) ────────────────────────────
  // Kleine Grashalme als Kreuz-Billboard im Wald
  _buildGrassPatches() {
    const cv  = document.createElement('canvas');
    cv.width  = 32; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 32, 64);

    // Einfache Grashalme
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 4;
      ctx.strokeStyle = `rgba(${50+i*8},${120+i*5},${30+i*4},0.9)`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.quadraticCurveTo(x + (Math.random()-0.5)*8, 32, x+(Math.random()-0.5)*6, 8);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.alphaTest = 0.5;

    const grassMat = new THREE.MeshBasicMaterial({
      map:         tex,
      transparent: true,
      alphaTest:   0.4,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });

    const COUNT = 300;
    const dummy = new THREE.Object3D();
    const geo   = new THREE.PlaneGeometry(0.45, 0.9);
    const im1   = new THREE.InstancedMesh(geo, grassMat, COUNT);
    const im2   = new THREE.InstancedMesh(geo, grassMat, COUNT);

    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random()-0.5)*120, z = (Math.random()-0.5)*160;
      if (Math.abs(x) < WORLD.hw + 4 && Math.abs(z) < WORLD.hd + 4) continue;

      const ry = Math.random() * Math.PI;
      dummy.position.set(x, 0.45, z);
      dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(1);
      dummy.updateMatrix(); im1.setMatrixAt(i, dummy.matrix);

      dummy.rotation.set(0, ry + Math.PI/2, 0);
      dummy.updateMatrix(); im2.setMatrixAt(i, dummy.matrix);
    }

    im1.instanceMatrix.needsUpdate = true;
    im2.instanceMatrix.needsUpdate = true;
    this.scene.add(im1);
    this.scene.add(im2);
  }

  /**
   * update(dt, elapsed)
   * Wind-Animation: Jeder Baum wackelt mit eigener Phase + Frequenz.
   * Nur die Laub-Instanzen werden bewegt (nicht die Stämme).
   */
  update(dt, elapsed) {
    this._elapsed += dt;
    const dummy = new THREE.Object3D();

    for (const t of this.treeData) {
      const windX = Math.sin(elapsed * t.freq + t.phase)              * t.strength;
      const windZ = Math.sin(elapsed * t.freq * 0.65 + t.phase + 1.3) * t.strength * 0.45;

      this._canopyIMs.forEach((im, li) => {
        im.getMatrixAt(t.idx, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.rotation.setFromQuaternion(dummy.quaternion);
        dummy.rotation.z = windX;
        dummy.rotation.x = windZ;
        dummy.updateMatrix();
        im.setMatrixAt(t.idx, dummy.matrix);
      });
    }

    this._canopyIMs.forEach(im => { im.instanceMatrix.needsUpdate = true; });
  }
}
