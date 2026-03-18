// engine.js – Renderer, Scene, Lights, Sky, Post-Processing, Screen Shake
import * as THREE from 'three';
import { Sky }             from 'three/addons/objects/Sky.js';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.6 },
    offset:   { value: 0.88 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = vUv * 2.0 - 1.0;
      float vig = clamp(pow(length(uv) * offset, 2.8), 0.0, 1.0);
      color.rgb = mix(color.rgb, vec3(0.0), vig * darkness);
      gl_FragColor = color;
    }
  `,
};

export class Engine {
  constructor(container) {
    this.container = container;
    this.width     = window.innerWidth;
    this.height    = window.innerHeight;
    this._isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    this.shakeOffset = new THREE.Vector3();
    this._shakeMag   = 0;
    this._shakeTime  = 0;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initSky();
    this._initPostProcessing();
    this._handleResize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this._isMobile,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const dpr = this._isMobile ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.68;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xbcd4e8, 0.011);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(72, this.width / this.height, 0.1, 700);
    this.camera.position.set(0, 8, 16);
  }

  _initLights() {
    this.scene.add(new THREE.HemisphereLight(0xb0d0ff, 0x405530, 0.85));

    this.sun = new THREE.DirectionalLight(0xffe0a8, 1.7);
    this.sun.position.set(60, 100, 40);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.width = s.mapSize.height = this._isMobile ? 1024 : 2048;
    s.camera.near = 1; s.camera.far = 500;
    const sc = 130;
    s.camera.left = -sc; s.camera.right = sc; s.camera.top = sc; s.camera.bottom = -sc;
    s.bias = -0.0003; s.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    const fill = new THREE.DirectionalLight(0x8ab4e8, 0.32);
    fill.position.set(-40, 30, -40);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0x2a3848, 0.45));
  }

  _initSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(500000);
    this.scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u['turbidity'].value = 7; u['rayleigh'].value = 1.4;
    u['mieCoefficient'].value = 0.004; u['mieDirectionalG'].value = 0.84;
    const sunVec = new THREE.Vector3().setFromSphericalCoords(
      1, THREE.MathUtils.degToRad(82), THREE.MathUtils.degToRad(195)
    );
    u['sunPosition'].value.copy(sunVec);
    this.sun.position.copy(sunVec).multiplyScalar(100);
    this.sun.target.position.set(0, 0, 0);
  }

  _initPostProcessing() {
    if (this._isMobile) { this._useComposer = false; return; }
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 0.28, 0.55, 0.82);
      this.composer.addPass(bloom);
      this.composer.addPass(new ShaderPass(VignetteShader));
      this._useComposer = true;
    } catch(e) {
      console.warn('[Engine] Post-processing unavailable:', e.message);
      this._useComposer = false;
    }
  }

  shake(magnitude = 0.3) {
    this._shakeMag = Math.max(this._shakeMag, magnitude);
  }

  _updateShake(delta) {
    if (this._shakeMag < 0.001) { this.shakeOffset.set(0,0,0); return; }
    this._shakeTime += delta * 40;
    const m = this._shakeMag;
    this.shakeOffset.set(
      (Math.sin(this._shakeTime * 1.7) + Math.sin(this._shakeTime * 3.1)) * 0.5 * m,
      (Math.cos(this._shakeTime * 2.3) + Math.cos(this._shakeTime * 1.4)) * 0.5 * m,
      0
    );
    this._shakeMag = Math.max(0, this._shakeMag - 8 * delta);
  }

  _handleResize() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth; this.height = window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
      if (this.composer) this.composer.setSize(this.width, this.height);
    });
  }

  render(delta = 0.016) {
    this._updateShake(delta);
    if (this._useComposer && this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  }
}
