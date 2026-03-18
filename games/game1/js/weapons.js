// weapons.js – 10 Weapons, Mesh Builders, WeaponSystem
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Weapon Definitions
// ─────────────────────────────────────────────────────────────────────────────
export const WEAPON_DATA = {
  sword: {
    name: 'Schwert',
    slot: 0, type: 'melee', icon: '⚔️',
    damage: 55, fireRate: 0.55, range: 4.5,
    accuracy: 1.0, magSize: 999, reloadTime: 0,
    movePenalty: 0.0, spread: 0,
    swingArc: Math.PI * 0.6,
    muzzleColor: 0xffffff, trailColor: 0xaaddff,
    desc: 'Schneller Nahkampf · hoher Schaden',
  },
  axe: {
    name: 'Axt',
    slot: 1, type: 'melee', icon: '🪓',
    damage: 85, fireRate: 1.1, range: 3.8,
    accuracy: 1.0, magSize: 999, reloadTime: 0,
    movePenalty: 0.06, spread: 0,
    swingArc: Math.PI * 0.5,
    muzzleColor: 0xff8800, trailColor: 0xff4400,
    desc: 'Langsamer, aber vernichtend',
  },
  spear: {
    name: 'Speer',
    slot: 2, type: 'melee', icon: '🔱',
    damage: 45, fireRate: 0.45, range: 6.5,
    accuracy: 1.0, magSize: 999, reloadTime: 0,
    movePenalty: 0.03, spread: 0,
    muzzleColor: 0x88ffcc, trailColor: 0x44ffaa,
    desc: 'Große Reichweite · schnell',
  },
  pistol: {
    name: 'Pistole',
    slot: 3, type: 'ranged', icon: '🔫',
    damage: 28, fireRate: 0.38, range: 75,
    accuracy: 0.96, magSize: 12, reloadTime: 1.3,
    movePenalty: 0.0, spread: 0.022,
    muzzleColor: 0xffcc44, flashRadius: 1.8,
    desc: 'Schnell · präzise · kompakt',
  },
  rifle: {
    name: 'Sturmgewehr',
    slot: 4, type: 'ranged', icon: '🪖',
    damage: 22, fireRate: 0.10, range: 100,
    accuracy: 0.92, magSize: 30, reloadTime: 2.0,
    movePenalty: 0.08, spread: 0.032,
    muzzleColor: 0xff9900, flashRadius: 2.2,
    desc: 'Hohes DPS · mittlere Reichweite',
  },
  shotgun: {
    name: 'Schrotflinte',
    slot: 5, type: 'ranged', icon: '💥',
    damage: 18, fireRate: 0.9, range: 25,
    accuracy: 0.70, magSize: 8, reloadTime: 2.5,
    movePenalty: 0.05, spread: 0.14, pellets: 8,
    muzzleColor: 0xff5500, flashRadius: 3.0,
    desc: 'Tödlich nah · nutzlos fern',
  },
  sniper: {
    name: 'Sniper',
    slot: 6, type: 'ranged', icon: '🎯',
    damage: 140, fireRate: 1.6, range: 300,
    accuracy: 0.995, magSize: 5, reloadTime: 2.8,
    movePenalty: 0.25, spread: 0.003,
    muzzleColor: 0x88ddff, flashRadius: 1.5,
    desc: 'Ein Schuss · ein Kill · langsam',
  },
  lasergun: {
    name: 'Laser Gun',
    slot: 7, type: 'energy', icon: '🔆',
    damage: 35, fireRate: 0.07, range: 150,
    accuracy: 1.0, magSize: 60, reloadTime: 2.2,
    movePenalty: 0.0, spread: 0.001, isLaser: true,
    muzzleColor: 0x00ffff, flashRadius: 1.6,
    desc: 'Exakt · Endlos-DPS · kein Rückstoß',
  },
  rocketlauncher: {
    name: 'Raketenwerfer',
    slot: 8, type: 'explosive', icon: '🚀',
    damage: 200, fireRate: 1.8, range: 120,
    accuracy: 0.98, magSize: 3, reloadTime: 3.5,
    movePenalty: 0.2, spread: 0.01, splashRadius: 5,
    muzzleColor: 0xff3300, flashRadius: 4.0,
    desc: 'Splash-Schaden · Selbstgefahr',
  },
  magicstaff: {
    name: 'Magiestab',
    slot: 9, type: 'magic', icon: '✨',
    damage: 60, fireRate: 0.5, range: 90,
    accuracy: 0.98, magSize: 20, reloadTime: 1.8,
    movePenalty: 0.0, spread: 0.01, isMagic: true,
    muzzleColor: 0xaa44ff, flashRadius: 2.5,
    desc: 'Vielseitig · magische Energie',
  },
};

export const WEAPON_KEYS = Object.keys(WEAPON_DATA);

// ─────────────────────────────────────────────────────────────────────────────
// Weapon Mesh Builders
// ─────────────────────────────────────────────────────────────────────────────
function mat(color, metalness = 0.4, roughness = 0.5, emissive = 0x000000, emInt = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness,
    emissive: new THREE.Color(emissive), emissiveIntensity: emInt });
}

export function buildWeaponMesh(type) {
  const g = new THREE.Group();
  g.name = type;

  switch (type) {

    case 'sword': {
      // Blade
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.6, 0.015),
        mat(0xd0e8ff, 0.85, 0.12)
      );
      blade.position.y = 0.85;
      g.add(blade);
      // Guard
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.06, 0.06),
        mat(0xccaa44, 0.9, 0.2)
      );
      guard.position.y = 0.08;
      g.add(guard);
      // Handle
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.48, 8),
        mat(0x5c3316, 0.1, 0.9)
      );
      handle.position.y = -0.22;
      g.add(handle);
      // Pommel
      const pommel = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        mat(0xccaa44, 0.9, 0.2)
      );
      pommel.position.y = -0.48;
      g.add(pommel);
      // Edge glow
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 1.55, 0.008),
        mat(0x88ccff, 0.5, 0.1, 0x4488ff, 0.6)
      );
      glow.position.set(0.025, 0.85, 0);
      g.add(glow);
      break;
    }

    case 'axe': {
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.04, 1.4, 8),
        mat(0x5c3316, 0.1, 0.9)
      );
      g.add(handle);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.52, 0.38),
        mat(0x888899, 0.85, 0.18)
      );
      head.position.set(0.18, 0.55, 0);
      g.add(head);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.52, 0.04),
        mat(0xccccdd, 0.92, 0.05)
      );
      edge.position.set(0.36, 0.55, 0);
      g.add(edge);
      // Rune detail
      const rune = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.12, 0.12),
        mat(0xff6600, 0.3, 0.5, 0xff3300, 0.8)
      );
      rune.position.set(0.12, 0.55, 0);
      g.add(rune);
      break;
    }

    case 'spear': {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.028, 2.2, 8),
        mat(0x6b3f18, 0.1, 0.85)
      );
      g.add(shaft);
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.42, 8),
        mat(0xb0c4de, 0.88, 0.1)
      );
      tip.position.y = 1.31;
      g.add(tip);
      const tipGlow = new THREE.Mesh(
        new THREE.ConeGeometry(0.03, 0.3, 6),
        mat(0x44ffaa, 0.5, 0.1, 0x00ff88, 0.6)
      );
      tipGlow.position.y = 1.28;
      g.add(tipGlow);
      const butt = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.18, 8),
        mat(0x888888, 0.8, 0.2)
      );
      butt.position.y = -1.19;
      butt.rotation.z = Math.PI;
      g.add(butt);
      break;
    }

    case 'pistol': {
      // Frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.32, 0.09),
        mat(0x2a2a2a, 0.3, 0.7)
      );
      g.add(frame);
      // Slide
      const slide = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.14, 0.09),
        mat(0x444444, 0.6, 0.4)
      );
      slide.position.set(0, 0.17, 0);
      g.add(slide);
      // Barrel
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.38, 8),
        mat(0x333333, 0.7, 0.35)
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.24, 0.17, 0);
      g.add(barrel);
      // Grip
      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.26, 0.09),
        mat(0x1a1a1a, 0.1, 0.9)
      );
      grip.position.set(-0.04, -0.22, 0);
      g.add(grip);
      // Trigger
      const trigger = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.1, 0.02),
        mat(0x222222, 0.4, 0.6)
      );
      trigger.position.set(0.04, -0.04, 0);
      trigger.rotation.z = 0.3;
      g.add(trigger);
      break;
    }

    case 'rifle': {
      // Body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.12, 0.1),
        mat(0x1e1e1e, 0.2, 0.8)
      );
      g.add(body);
      // Barrel
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.026, 0.7, 8),
        mat(0x3a3a3a, 0.7, 0.3)
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.42, 0.06, 0);
      g.add(barrel);
      // Mag
      const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.28, 0.08),
        mat(0x111111, 0.1, 0.9)
      );
      mag.position.set(0.04, -0.2, 0);
      g.add(mag);
      // Stock
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.1, 0.1),
        mat(0x3a2a1a, 0.1, 0.8)
      );
      stock.position.set(-0.49, -0.01, 0);
      g.add(stock);
      // Scope
      const scope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.22, 8),
        mat(0x222222, 0.5, 0.5)
      );
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0.08, 0.1, 0);
      g.add(scope);
      // Muzzle brake
      const brake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.032, 0.08, 6),
        mat(0x555555, 0.8, 0.2)
      );
      brake.rotation.z = Math.PI / 2;
      brake.position.set(0.79, 0.06, 0);
      g.add(brake);
      break;
    }

    case 'shotgun': {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.14, 0.13),
        mat(0x3a2a1a, 0.1, 0.8)
      );
      g.add(body);
      const barrel1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 0.6, 8),
        mat(0x444444, 0.7, 0.35)
      );
      barrel1.rotation.z = Math.PI / 2;
      barrel1.position.set(0.32, 0.08, 0.04);
      g.add(barrel1);
      const barrel2 = barrel1.clone();
      barrel2.position.z = -0.04;
      g.add(barrel2);
      const pump = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.08, 0.14),
        mat(0x2a1a0a, 0.05, 0.95)
      );
      pump.position.set(0.14, 0.0, 0);
      g.add(pump);
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.12, 0.12),
        mat(0x2a1a0a, 0.05, 0.95)
      );
      stock.position.set(-0.41, -0.01, 0);
      g.add(stock);
      break;
    }

    case 'sniper': {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.1, 0.09),
        mat(0x1a1a1a, 0.3, 0.75)
      );
      g.add(body);
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.88, 8),
        mat(0x2a2a2a, 0.75, 0.25)
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.5, 0.05, 0);
      g.add(barrel);
      // Big scope
      const scope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 0.42, 12),
        mat(0x111111, 0.5, 0.5)
      );
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0.12, 0.11, 0);
      g.add(scope);
      const scopeLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.036, 12),
        mat(0x44aaff, 0.2, 0.2, 0x2288ff, 0.8)
      );
      scopeLens.rotation.y = Math.PI / 2;
      scopeLens.position.set(0.335, 0.11, 0);
      g.add(scopeLens);
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.09, 0.09),
        mat(0x2a1a0a, 0.05, 0.9)
      );
      stock.position.set(-0.54, -0.005, 0);
      g.add(stock);
      const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.22, 0.07),
        mat(0x111111, 0.1, 0.9)
      );
      mag.position.set(-0.05, -0.16, 0);
      g.add(mag);
      break;
    }

    case 'lasergun': {
      // Futuristic body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.14, 0.1),
        mat(0x0a0a1a, 0.5, 0.4)
      );
      g.add(body);
      // Energy cells
      for (let i = 0; i < 3; i++) {
        const cell = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.09, 0.07),
          mat(0x002244, 0.3, 0.5, 0x0088ff, 0.9)
        );
        cell.position.set(-0.12 + i * 0.12, 0, 0.06);
        g.add(cell);
      }
      // Barrel
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.025, 0.6, 8),
        mat(0x111122, 0.6, 0.3)
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.38, 0.0, 0);
      g.add(barrel);
      // Tip glow
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 8, 6),
        mat(0x00ffff, 0.1, 0.1, 0x00ffff, 2.5)
      );
      tip.position.set(0.69, 0.0, 0);
      g.add(tip);
      // Side fins
      for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.04, 0.02),
          mat(0x003366, 0.4, 0.4, 0x0044aa, 0.5)
        );
        fin.position.set(0.04, s * 0.09, 0);
        g.add(fin);
      }
      break;
    }

    case 'rocketlauncher': {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.88, 12),
        mat(0x2a3a1a, 0.2, 0.7)
      );
      tube.rotation.z = Math.PI / 2;
      g.add(tube);
      // Front bell
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.09, 0.1, 12),
        mat(0x1a2a0a, 0.3, 0.65)
      );
      bell.rotation.z = Math.PI / 2;
      bell.position.set(0.49, 0, 0);
      g.add(bell);
      // Sight
      const sight = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.06),
        mat(0x111111, 0.3, 0.7)
      );
      sight.position.set(0.05, 0.12, 0);
      g.add(sight);
      // Warning stripe
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.092, 0.092, 0.06, 12),
        mat(0xff8800, 0.3, 0.6)
      );
      stripe.rotation.z = Math.PI / 2;
      stripe.position.set(-0.3, 0, 0);
      g.add(stripe);
      // Handle
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.22, 0.07),
        mat(0x222222, 0.2, 0.8)
      );
      handle.position.set(-0.02, -0.17, 0);
      g.add(handle);
      break;
    }

    case 'magicstaff': {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.035, 1.5, 8),
        mat(0x1a0a3a, 0.15, 0.7)
      );
      g.add(shaft);
      // Crystal orb
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.13, 1),
        mat(0x8800ff, 0.1, 0.2, 0xcc44ff, 1.2)
      );
      orb.position.y = 0.85;
      g.add(orb);
      // Crystal spikes
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.025, 0.22, 5),
          mat(0xaa66ff, 0.2, 0.3, 0x8844ff, 0.8)
        );
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(
          Math.cos(angle) * 0.1,
          0.85 + Math.sin(i) * 0.04,
          Math.sin(angle) * 0.1
        );
        spike.rotation.z = angle + Math.PI / 2;
        g.add(spike);
      }
      // Ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.018, 8, 20),
        mat(0xccaaff, 0.7, 0.2, 0x8844ff, 0.5)
      );
      ring.position.y = 0.85;
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      // Rune engravings on shaft
      for (let i = 0; i < 3; i++) {
        const rune = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.06, 0.035),
          mat(0x6600cc, 0.2, 0.4, 0xaa44ff, 1.0)
        );
        rune.position.y = 0.15 + i * 0.32;
        rune.rotation.y = (i / 3) * Math.PI * 2;
        g.add(rune);
      }
      break;
    }
  }

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weapon System
// ─────────────────────────────────────────────────────────────────────────────
export class WeaponSystem {
  constructor(scene) {
    this.scene        = scene;
    this.currentSlot  = 3;           // start with pistol
    this.ammo         = {};
    this.reloading    = {};
    this.reloadTimer  = {};
    this.lastFireTime = {};
    this.currentMesh  = null;
    this.weaponAnchor = new THREE.Group(); // attached to player hand

    // Animation state
    this.recoilOffset = new THREE.Vector3();
    this.recoilRot    = new THREE.Euler();
    this.swayOffset   = new THREE.Vector3();
    this._idleTime    = 0;
    this._isEquipping = false;
    this._equipTimer  = 0;
    this._swingTime   = 0;
    this._isSwinging  = false;

    // Init ammo for all weapons
    for (const key of WEAPON_KEYS) {
      const w = WEAPON_DATA[key];
      this.ammo[key]        = w.magSize;
      this.reloading[key]   = false;
      this.reloadTimer[key] = 0;
      this.lastFireTime[key] = 0;
    }

    this._buildAllMeshes();
    this._equipWeapon(this.currentSlot, true);
  }

  get current() { return WEAPON_DATA[WEAPON_KEYS[this.currentSlot]]; }
  get currentKey() { return WEAPON_KEYS[this.currentSlot]; }

  _buildAllMeshes() {
    this._meshes = {};
    for (const key of WEAPON_KEYS) {
      const mesh = buildWeaponMesh(key);
      mesh.visible = false;
      mesh.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
      this.weaponAnchor.add(mesh);
      this._meshes[key] = mesh;
    }
  }

  _equipWeapon(slot, instant = false) {
    const prevMesh = this.currentMesh;
    this.currentSlot = slot;
    const key  = WEAPON_KEYS[slot];
    const mesh = this._meshes[key];

    if (prevMesh && prevMesh !== mesh) prevMesh.visible = false;
    mesh.visible = true;
    this.currentMesh = mesh;

    if (!instant) {
      this._isEquipping = true;
      this._equipTimer  = 0;
      mesh.position.set(0, -0.8, 0);
      mesh.scale.setScalar(0.5);
    } else {
      mesh.position.set(0, 0, 0);
      mesh.scale.setScalar(1);
    }

    this._updateWeaponHUD();
  }

  switchTo(slot) {
    if (slot === this.currentSlot) return;
    if (slot < 0 || slot >= WEAPON_KEYS.length) return;
    this._equipWeapon(slot);
  }

  switchNext()  { this.switchTo((this.currentSlot + 1) % WEAPON_KEYS.length); }
  switchPrev()  { this.switchTo((this.currentSlot + WEAPON_KEYS.length - 1) % WEAPON_KEYS.length); }

  canFire(now) {
    const key = this.currentKey;
    const w   = this.current;
    if (this.reloading[key]) return false;
    if (this._isEquipping)  return false;
    if (this._isSwinging)   return false;
    if (now - this.lastFireTime[key] < w.fireRate) return false;
    if (w.type === 'ranged' || w.type === 'energy' || w.type === 'explosive' || w.type === 'magic') {
      if (this.ammo[key] <= 0) {
        this.startReload();
        return false;
      }
    }
    return true;
  }

  fire(now) {
    const key = this.currentKey;
    const w   = this.current;
    this.lastFireTime[key] = now;

    if (w.type !== 'melee') {
      this.ammo[key] = Math.max(0, this.ammo[key] - 1);
      if (this.ammo[key] === 0) {
        setTimeout(() => this.startReload(), 80);
      }
    }

    // Recoil animation
    const recoilZ  = -0.12 - Math.random() * 0.08;
    const recoilX  = (Math.random() - 0.5) * 0.06;
    this.recoilOffset.set(recoilX, 0.04, recoilZ);
    this.recoilRot.set(-0.18, (Math.random() - 0.5) * 0.06, 0);

    if (w.type === 'melee') {
      this._isSwinging = true;
      this._swingTime  = 0;
    }

    this._updateWeaponHUD();
    return this._buildFireData(w);
  }

  _buildFireData(w) {
    const data = { weapon: w, key: this.currentKey, rays: [] };
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spread = w.spread || 0;
      data.rays.push({
        spreadX: (Math.random() - 0.5) * spread * 2,
        spreadY: (Math.random() - 0.5) * spread * 2,
      });
    }
    return data;
  }

  startReload() {
    const key = this.currentKey;
    const w   = this.current;
    if (w.type === 'melee') return;
    if (this.reloading[key]) return;
    if (this.ammo[key] >= w.magSize) return;

    this.reloading[key]   = true;
    this.reloadTimer[key] = w.reloadTime;
    this._updateWeaponHUD();
  }

  update(delta, time) {
    const key = this.currentKey;
    const w   = this.current;

    // Reload timer
    if (this.reloading[key]) {
      this.reloadTimer[key] -= delta;
      if (this.reloadTimer[key] <= 0) {
        this.ammo[key]      = w.magSize;
        this.reloading[key] = false;
        this._updateWeaponHUD();
      }
    }

    // Equip animation
    if (this._isEquipping) {
      this._equipTimer += delta * 5;
      const t = Math.min(this._equipTimer, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      this.currentMesh.position.y  = THREE.MathUtils.lerp(-0.8, 0, ease);
      this.currentMesh.scale.setScalar(THREE.MathUtils.lerp(0.5, 1, ease));
      if (t >= 1) this._isEquipping = false;
    }

    // Swing animation (melee)
    if (this._isSwinging) {
      this._swingTime += delta * (w.type === 'melee' ? 8 : 6);
      const t = this._swingTime;
      const swingAngle = Math.sin(t) * w.swingArc * Math.max(0, 1 - t * 0.35);
      if (this.currentMesh) {
        this.currentMesh.rotation.x = swingAngle;
      }
      if (t > Math.PI) {
        this._isSwinging = false;
        this._swingTime  = 0;
        if (this.currentMesh) this.currentMesh.rotation.x = 0;
      }
    }

    // Idle animation (bob + breathe)
    this._idleTime += delta;
    const idleY = Math.sin(this._idleTime * 1.5) * 0.006;
    const idleX = Math.sin(this._idleTime * 0.7) * 0.004;
    this.swayOffset.set(idleX, idleY, 0);

    // Magic staff pulsing
    if (key === 'magicstaff' && this.currentMesh) {
      const pulse = 0.98 + Math.sin(time * 3) * 0.02;
      this.currentMesh.scale.setScalar(pulse);
      this.currentMesh.rotation.y = time * 0.5;
    }

    // Laser tip glow pulse
    if (key === 'lasergun' && this.currentMesh) {
      this.currentMesh.traverse(c => {
        if (c.isMesh && c.material.emissiveIntensity > 1) {
          c.material.emissiveIntensity = 1.8 + Math.sin(time * 8) * 0.7;
        }
      });
    }

    // Recoil decay
    this.recoilOffset.multiplyScalar(0.72);
    this.recoilRot.x *= 0.72;
    this.recoilRot.y *= 0.72;

    // Apply to weapon mesh
    if (this.currentMesh && !this._isSwinging) {
      const total = this.recoilOffset.clone().add(this.swayOffset);
      this.currentMesh.position.lerp(total, 0.25);
      this.currentMesh.rotation.x = THREE.MathUtils.lerp(
        this.currentMesh.rotation.x, this.recoilRot.x, 0.25
      );
    }

    // Reload progress bar
    this._updateReloadBar(key, w);
  }

  _updateWeaponHUD() {
    const key = this.currentKey;
    const w   = this.current;

    const nameEl  = document.getElementById('weapon-name');
    const ammoEl  = document.getElementById('ammo-counter');
    const iconEl  = document.getElementById('weapon-icon');
    const slotsEl = document.getElementById('weapon-slots');

    if (nameEl) nameEl.textContent = w.name;
    if (iconEl) iconEl.textContent = w.icon;
    if (ammoEl) {
      if (w.type === 'melee') {
        ammoEl.textContent = '∞';
      } else {
        const a = this.ammo[key];
        const m = w.magSize;
        ammoEl.textContent = this.reloading[key] ? 'RELOAD…' : `${a} / ${m}`;
        ammoEl.style.color = a === 0 ? '#ff4444' : a <= 3 ? '#ffaa44' : '#ffffff';
      }
    }

    // Slot indicators
    if (slotsEl) {
      slotsEl.innerHTML = '';
      for (let i = 0; i < WEAPON_KEYS.length; i++) {
        const wk = WEAPON_KEYS[i];
        const wd = WEAPON_DATA[wk];
        const el = document.createElement('div');
        el.className = 'weapon-slot' + (i === this.currentSlot ? ' active' : '');
        el.textContent = wd.icon;
        el.title = wd.name;
        slotsEl.appendChild(el);
      }
    }
  }

  _updateReloadBar(key, w) {
    const bar     = document.getElementById('reload-bar');
    const barWrap = document.getElementById('reload-bar-wrap');
    if (!bar || !barWrap) return;

    if (this.reloading[key]) {
      const progress = 1 - (this.reloadTimer[key] / w.reloadTime);
      bar.style.width = (progress * 100) + '%';
      barWrap.style.opacity = '1';
    } else {
      barWrap.style.opacity = '0';
    }
  }
}
