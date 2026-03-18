// main.js – Entry Point, Game Loop
import { Engine }       from './engine.js';
import { World }        from './world.js';
import { Player }       from './player.js';
import { WeaponSystem } from './weapons.js';
import {
  InputSystem, ShootingSystem, ParticleSystem,
  Hitmarker, UISystem, CoinSystem
} from './systems.js';

let engine, world, player, weaponSystem, input, particles, hitmarker, ui, coins, shooter;
let lastTimestamp=0;

function animBar(pct,dur=350){
  const b=document.getElementById('loading-bar');
  if(b){ b.style.transition=`width ${dur}ms ease`; b.style.width=pct+'%'; }
}

async function init(){
  const container=document.getElementById('canvas-container');
  animBar(10);

  engine       = new Engine(container);               animBar(22);
  world        = new World(engine.scene);
  world.generate();                                    animBar(52);
  weaponSystem = new WeaponSystem(engine.scene);       animBar(62);

  player = new Player(
    engine.scene, engine.camera,
    (x,z)=>world.getHeight(x,z),
    weaponSystem
  );                                                   animBar(72);

  input     = new InputSystem();
  particles = new ParticleSystem(engine.scene);
  hitmarker = new Hitmarker();
  ui        = new UISystem(world.coinMeshes.length);
  coins     = new CoinSystem(world.coinMeshes, particles, ui);
  shooter   = new ShootingSystem(engine.scene, weaponSystem, engine, hitmarker, particles, world);
                                                       animBar(92);

  // Stamp weapon HUD initial state
  weaponSystem._updateWeaponHUD();

  animBar(100);
  await delay(300);
  const ls=document.getElementById('loading-screen');
  if(ls){ ls.style.opacity='0'; await delay(500); ls.style.display='none'; }

  requestAnimationFrame(loop);
}

function loop(timestamp){
  requestAnimationFrame(loop);
  const raw=timestamp-lastTimestamp; lastTimestamp=timestamp;
  const delta=Math.min(raw/1000,0.05);
  const time=timestamp/1000;

  // Input
  input.update();
  const ones=input.consumeOneShots();
  const camDelta=input.consumeCameraDelta();

  const inputState={
    forward:  input.state.forward,
    backward: input.state.backward,
    left:     input.state.left,
    right:    input.state.right,
    joystick: input.state.joystick,
    cameraDelta: camDelta,
    fire:     input.state.fire,
    fireJustPressed: input.state.fireJustPressed,
  };

  // Weapon switching
  if(ones.weaponNext) weaponSystem.switchNext();
  if(ones.weaponPrev) weaponSystem.switchPrev();
  if(ones.weaponSlot>=0) weaponSystem.switchTo(ones.weaponSlot);
  if(ones.reload) weaponSystem.startReload();

  // Player
  player.update(delta, inputState, engine.shakeOffset);

  // Shooting
  shooter.tryFire(inputState, player, time);
  shooter.update(delta, time);

  // Weapon animations
  weaponSystem.update(delta, time);

  // World
  world.update(time, delta);

  // Coin collection
  coins.check(player.position);

  // Particles + Hitmarker
  particles.update(delta);
  hitmarker.update(delta);

  // Sun follows player for consistent shadow coverage
  engine.sun.target.position.copy(player.position);
  engine.sun.target.updateMatrixWorld();

  engine.render(delta);
}

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

init().catch(err=>{
  console.error('[ForestExplorer] Init error:', err);
  const ls=document.getElementById('loading-screen');
  if(ls) ls.innerHTML=`<p style="color:#ff6b6b;font-size:1.1rem;padding:2rem;">⚠️ Fehler:<br><code>${err.message}</code></p>`;
});
