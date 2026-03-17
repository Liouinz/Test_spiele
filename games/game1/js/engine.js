/**
 * ============================================================
 * ENGINE MODULE  –  engine.js
 * ============================================================
 * Verantwortlich für:
 *   - WebGL-Renderer (ACESFilmic Tone Mapping, Soft Shadows)
 *   - THREE.Scene + Atmosphärischer Nebel
 *   - PerspektivKamera
 *   - Beleuchtung (Sonne / Hemisphäre / Füll-Licht)
 *   - Prozedurale Himmel-Sphere (Gradient via Vertex Colors)
 *   - Canvas-Resize-Handler
 *
 * Warum Three.js?
 *   Stabil, CDN-verfügbar als ES Module, kein Build-Step nötig,
 *   perfekt für iframe-kompatible Browser-Games.
 *
 * Warum ACESFilmic Tone Mapping?
 *   Nähert sich echtem Kamera-Verhalten an: Lichter brennen nicht
 *   aus, dunkle Bereiche behalten Details → natürlicheres Bild.
 * ============================================================
 */

import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';

export { THREE };  // Re-export so alle anderen Module dieselbe Instanz nutzen

// ─── Konstanten ──────────────────────────────────────────────
const SKY_RADIUS   = 160;
const FOG_DENSITY  = 0.011;
const SHADOW_SIZE  = 2048;   // Shadow Map Auflösung (Qualität vs. VRAM)
const SHADOW_RANGE = 80;     // Wie weit die Sonne Schatten wirft

// ─── Engine-Klasse ───────────────────────────────────────────
export class Engine {
  constructor() {
    this.scene    = null;
    this.camera   = null;
    this.renderer = null;
    this.sun      = null;
  }

  /**
   * init(container)
   * Erstellt Renderer, Scene, Camera, Lichter und Himmel.
   * container = DOM-Element, in das der Canvas eingefügt wird.
   */
  init(container) {
    this._buildRenderer(container);
    this._buildScene();
    this._buildCamera();
    this._buildLights();
    this._buildSky();
    this._buildResizeHandler();
    return this;
  }

  // ── Renderer ──────────────────────────────────────────────
  _buildRenderer(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias:              true,
      powerPreference:        'high-performance',
      logarithmicDepthBuffer: false,  // nicht nötig, spart Performance
    });

    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // ACESFilmic: natürlicheres Highlight-Roll-off
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding      = THREE.sRGBEncoding;

    // Schatten: PCFSoft = weiche Kanten ohne zu viel Performance-Kosten
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top      = '0';
    renderer.domElement.style.left     = '0';
    renderer.domElement.style.zIndex   = '0';
    container.appendChild(renderer.domElement);
  }

  // ── Scene + Fog ───────────────────────────────────────────
  _buildScene() {
    this.scene = new THREE.Scene();
    // FogExp2: exponentieller Nebel = realistischer als linearer
    this.scene.fog = new THREE.FogExp2(0x8bb8d4, FOG_DENSITY);
  }

  // ── Kamera ────────────────────────────────────────────────
  _buildCamera() {
    this.camera = new THREE.PerspectiveCamera(
      65,                                           // FOV
      window.innerWidth / window.innerHeight,       // Aspect
      0.1,                                          // Near
      200                                           // Far
    );
    // Startposition – wird vom CameraController übernommen
    this.camera.position.set(0, 10, 15);
  }

  // ── Beleuchtung ───────────────────────────────────────────
  _buildLights() {
    // 1. Hemisphären-Licht: simuliert diffuses Himmels- + Bodenlicht
    //    sky=Hellblau, ground=Dunkelgrün-Braun → weiches Umgebungslicht
    const hemi = new THREE.HemisphereLight(0x9dc8e8, 0x4a7040, 0.60);
    this.scene.add(hemi);

    // 2. Direktionales Sonnenlicht + Schatten
    const sun = new THREE.DirectionalLight(0xfff4d6, 1.25);
    sun.position.set(22, 45, 18);
    sun.castShadow              = true;
    sun.shadow.mapSize.width    = SHADOW_SIZE;
    sun.shadow.mapSize.height   = SHADOW_SIZE;
    sun.shadow.camera.near      = 1;
    sun.shadow.camera.far       = 180;
    sun.shadow.camera.left      = -SHADOW_RANGE;
    sun.shadow.camera.right     =  SHADOW_RANGE;
    sun.shadow.camera.top       =  SHADOW_RANGE;
    sun.shadow.camera.bottom    = -SHADOW_RANGE;
    sun.shadow.bias             = -0.0003;   // verhindert Shadow-Acne
    sun.shadow.normalBias       =  0.02;
    this.scene.add(sun);
    this.scene.add(sun.target); // Target muss in der Szene sein!
    this.sun = sun;

    // 3. Schwaches Füll-Licht aus Gegenrichtung (verhindert harte Schwarzbereiche)
    const fill = new THREE.DirectionalLight(0xb8d4f0, 0.22);
    fill.position.set(-15, 12, -20);
    this.scene.add(fill);
  }

  // ── Prozedurale Himmel-Sphere ──────────────────────────────
  // Vertex Colors erlauben einen echten Farb-Gradienten ohne Shader
  _buildSky() {
    const geo = new THREE.SphereGeometry(SKY_RADIUS, 20, 12);
    const pos = geo.attributes.position;
    const col = [];

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      // t=0 → Horizont (helleres Blau), t=1 → Zenit (tieferes Blau)
      const t = THREE.MathUtils.clamp((y + SKY_RADIUS) / (2 * SKY_RADIUS), 0, 1);
      col.push(
        THREE.MathUtils.lerp(0.72, 0.30, t),  // R
        THREE.MathUtils.lerp(0.86, 0.58, t),  // G
        THREE.MathUtils.lerp(0.95, 0.90, t)   // B
      );
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat  = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  // ── Resize Handler ────────────────────────────────────────
  _buildResizeHandler() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  /**
   * render()
   * Rendert einen Frame. Wird vom Game Loop aufgerufen.
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * followSun(targetPosition)
   * Bewegt Schattenkamera mit Spieler damit Schatten immer sichtbar bleiben.
   */
  followSun(targetPos) {
    this.sun.target.position.copy(targetPos);
    this.sun.target.updateMatrixWorld();
  }
}
