// systems.js – Input, Shooting, Particles, Hitmarker, UI, Coins
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Input System  (BUG FIX: cameraDelta correctly reset after consumption)
// ─────────────────────────────────────────────────────────────────────────────
export class InputSystem {
  constructor() {
    this.state = {
      forward:false, backward:false, left:false, right:false,
      joystick:{ active:false, x:0, y:0 },
      _cameraDelta:null,
      fire:false, fireJustPressed:false,
      reload:false,
      weaponNext:false, weaponPrev:false,
      weaponSlot:-1,
    };

    this._keys       = {};
    this._joyId      = null;
    this._camId      = null;
    this._fireId     = null;
    this._joyStart   = null;
    this._camLastX   = 0;
    this._camLastY   = 0;
    this._mouseDown  = false;
    this._lastMX     = 0;
    this._lastMY     = 0;
    this._prevFire   = false;

    this._joyBase    = document.getElementById('joystick-base');
    this._joyThumb   = document.getElementById('joystick-thumb');
    this._joyContainer=document.getElementById('joystick-container');

    const isMobile='ontouchstart' in window||navigator.maxTouchPoints>0;
    if(isMobile && this._joyContainer) this._joyContainer.style.display='flex';

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
    this._bindFireButton();
    this._bindWeaponScroll();
  }

  _bindKeyboard(){
    window.addEventListener('keydown',e=>{
      this._keys[e.code]=true;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      // Weapon slots 1-0
      const n=parseInt(e.key);
      if(!isNaN(n)&&n>=1&&n<=9){ this.state.weaponSlot=n-1; }
      if(e.key==='0') this.state.weaponSlot=9;
      if(e.code==='KeyR') this.state.reload=true;
      if(e.code==='KeyQ') this.state.weaponPrev=true;
      if(e.code==='KeyE') this.state.weaponNext=true;
    });
    window.addEventListener('keyup',e=>{ this._keys[e.code]=false; });
  }

  _bindMouse(){
    window.addEventListener('mousedown',e=>{
      if(e.button===0){ this._mouseDown=true; this._lastMX=e.clientX; this._lastMY=e.clientY; this.state.fire=true; }
      if(e.button===2){ this._mouseDown=true; this._lastMX=e.clientX; this._lastMY=e.clientY; }
    });
    window.addEventListener('mousemove',e=>{
      if(!this._mouseDown) return;
      const dx=e.clientX-this._lastMX, dy=e.clientY-this._lastMY;
      if(!this.state._cameraDelta) this.state._cameraDelta={dx:0,dy:0};
      this.state._cameraDelta.dx+=dx; this.state._cameraDelta.dy+=dy;
      this._lastMX=e.clientX; this._lastMY=e.clientY;
    });
    window.addEventListener('mouseup',e=>{
      this._mouseDown=false;
      if(e.button===0) this.state.fire=false;
    });
    window.addEventListener('contextmenu',e=>e.preventDefault());
    // Mouse wheel = weapon switch
    window.addEventListener('wheel',e=>{
      if(e.deltaY>0) this.state.weaponNext=true;
      else this.state.weaponPrev=true;
    },{passive:true});
  }

  _bindTouch(){
    document.addEventListener('touchstart',e=>{
      e.preventDefault();
      for(const t of e.changedTouches){
        if(this._isOnJoystick(t)&&this._joyId===null){
          this._joyId=t.identifier; this._joyStart={x:t.clientX,y:t.clientY};
        } else if(this._isOnFireBtn(t)){
          this._fireId=t.identifier; this.state.fire=true;
        } else if(this._camId===null){
          this._camId=t.identifier; this._camLastX=t.clientX; this._camLastY=t.clientY;
        }
      }
    },{passive:false});

    document.addEventListener('touchmove',e=>{
      e.preventDefault();
      for(const t of e.changedTouches){
        if(t.identifier===this._joyId&&this._joyStart){
          const dx=t.clientX-this._joyStart.x, dy=t.clientY-this._joyStart.y;
          const MAX=54, dist=Math.min(Math.sqrt(dx*dx+dy*dy),MAX), ang=Math.atan2(dy,dx), norm=dist/MAX;
          this.state.joystick={active:true,x:Math.cos(ang)*norm,y:Math.sin(ang)*norm};
          if(this._joyThumb) this._joyThumb.style.transform=`translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist}px)`;
        } else if(t.identifier===this._camId){
          const dx=t.clientX-this._camLastX, dy=t.clientY-this._camLastY;
          if(!this.state._cameraDelta) this.state._cameraDelta={dx:0,dy:0};
          this.state._cameraDelta.dx+=dx; this.state._cameraDelta.dy+=dy;
          this._camLastX=t.clientX; this._camLastY=t.clientY;
        }
      }
    },{passive:false});

    document.addEventListener('touchend',e=>{
      for(const t of e.changedTouches){
        if(t.identifier===this._joyId){
          this._joyId=null; this._joyStart=null;
          this.state.joystick={active:false,x:0,y:0};
          if(this._joyThumb) this._joyThumb.style.transform='translate(0,0)';
        }
        if(t.identifier===this._camId) this._camId=null;
        if(t.identifier===this._fireId){ this._fireId=null; this.state.fire=false; }
      }
    });
  }

  _bindFireButton(){
    const btn=document.getElementById('fire-btn');
    if(!btn) return;
    btn.addEventListener('pointerdown',e=>{ e.preventDefault(); this.state.fire=true; });
    btn.addEventListener('pointerup',  e=>{ e.preventDefault(); this.state.fire=false; });
    btn.addEventListener('pointerleave',e=>{ this.state.fire=false; });
  }

  _bindWeaponScroll(){
    const prev=document.getElementById('prev-weapon');
    const next=document.getElementById('next-weapon');
    if(prev) prev.addEventListener('click',()=>this.state.weaponPrev=true);
    if(next) next.addEventListener('click',()=>this.state.weaponNext=true);
  }

  _isOnJoystick(t){
    if(!this._joyBase) return false;
    const r=this._joyBase.getBoundingClientRect();
    return t.clientX>=r.left-30&&t.clientX<=r.right+30&&t.clientY>=r.top-30&&t.clientY<=r.bottom+30;
  }

  _isOnFireBtn(t){
    const btn=document.getElementById('fire-btn');
    if(!btn) return false;
    const r=btn.getBoundingClientRect();
    return t.clientX>=r.left&&t.clientX<=r.right&&t.clientY>=r.top&&t.clientY<=r.bottom;
  }

  update(){
    const k=this._keys;
    this.state.forward  =!!(k['KeyW']||k['ArrowUp']);
    this.state.backward =!!(k['KeyS']||k['ArrowDown']);
    this.state.left     =!!(k['KeyA']||k['ArrowLeft']);
    this.state.right    =!!(k['KeyD']||k['ArrowRight']);

    // Auto-fire for automatic weapons is handled by ShootingSystem
    // fireJustPressed is set once per press
    this.state.fireJustPressed = this.state.fire && !this._prevFire;
    this._prevFire = this.state.fire;
  }

  consumeCameraDelta(){
    const d=this.state._cameraDelta;
    this.state._cameraDelta=null;  // ← BUG FIX: reset after consumption
    return d;
  }

  consumeOneShots(){
    const out={
      reload:      this.state.reload,
      weaponNext:  this.state.weaponNext,
      weaponPrev:  this.state.weaponPrev,
      weaponSlot:  this.state.weaponSlot,
    };
    this.state.reload=false;
    this.state.weaponNext=false;
    this.state.weaponPrev=false;
    this.state.weaponSlot=-1;
    return out;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shooting System
// ─────────────────────────────────────────────────────────────────────────────
export class ShootingSystem {
  constructor(scene, weaponSystem, engine, hitmarker, particles, world) {
    this.scene         = scene;
    this.weaponSystem  = weaponSystem;
    this.engine        = engine;
    this.hitmarker     = hitmarker;
    this.particles     = particles;
    this.world         = world;

    this._raycaster    = new THREE.Raycaster();
    this._raycaster.far= 400;
    this._muzzleLight  = new THREE.PointLight(0xffcc44, 0, 10);
    this.scene.add(this._muzzleLight);
    this._muzzleLightTimer = 0;

    // Laser beam pool
    this._laserBeams   = [];
    this._laserPool    = [];

    // Impact sprites (canvas)
    this._impactTex    = this._makeImpactTex();
    this._impactPool   = [];

    // Score
    this.score         = 0;
    this.kills         = 0;
  }

  _makeImpactTex(){
    const s=64, c=document.createElement('canvas'); c.width=c.height=s;
    const ctx=c.getContext('2d');
    const grd=ctx.createRadialGradient(s/2,s/2,2,s/2,s/2,s/2);
    grd.addColorStop(0,'rgba(255,200,80,1)'); grd.addColorStop(0.4,'rgba(255,80,0,0.8)');
    grd.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,s,s);
    return new THREE.CanvasTexture(c);
  }

  tryFire(inputState, player, now){
    const ws  = this.weaponSystem;
    const w   = ws.current;
    const auto= w.type==='ranged'||w.type==='energy'||w.type==='explosive'||w.type==='magic';
    const shouldFire = auto ? inputState.fire : inputState.fireJustPressed;
    if(!shouldFire) return;
    if(!ws.canFire(now)) return;

    const fireData = ws.fire(now);
    this._doShoot(fireData, player, w);

    // Screen shake based on weapon
    const shakeMag = {
      sword:0.04, axe:0.12, spear:0.04,
      pistol:0.06, rifle:0.04, shotgun:0.22,
      sniper:0.30, lasergun:0.01, rocketlauncher:0.50, magicstaff:0.08,
    }[fireData.key] || 0.05;
    this.engine.shake(shakeMag);

    // Muzzle flash
    if(w.type!=='melee'){
      const dir=new THREE.Vector3(); player.camera.getWorldDirection(dir);
      this._muzzleLight.position.copy(player.camera.position).addScaledVector(dir,1.5);
      this._muzzleLight.color.setHex(w.muzzleColor||0xffcc44);
      this._muzzleLight.intensity = w.flashRadius||2;
      this._muzzleLight.distance  = (w.flashRadius||2)*4;
      this._muzzleLightTimer = 0.08;

      // Muzzle flash particles
      const fpos=player.camera.position.clone().addScaledVector(dir,1.8);
      this.particles.spawnMuzzle(fpos, w.muzzleColor||0xffcc44, w.type==='energy'?8:4);
    }
  }

  _doShoot(fireData, player, w){
    if(w.type==='melee'){
      // Melee: check close targets
      const camPos=player.camera.position;
      for(const target of this.world.targets){
        if(!target.visible||target.userData.dead) continue;
        const dist=camPos.distanceTo(target.position);
        if(dist<=w.range){
          // Angle check
          const camFwd=new THREE.Vector3(); player.camera.getWorldDirection(camFwd);
          const toTarget=new THREE.Vector3().subVectors(target.position,camPos).normalize();
          if(camFwd.dot(toTarget)>0.5){
            this._hitTarget(target, w.damage, player.camera.position);
          }
        }
      }
      return;
    }

    // Ranged / energy / explosive / magic
    for(const rayData of fireData.rays){
      const ray = player.buildShootRay(rayData.spreadX, rayData.spreadY);

      // Special: laser beam visual
      if(w.isLaser){
        this._spawnLaserBeam(ray, w);
      }

      // Raycast against targets
      this._raycaster.ray.copy(ray);
      // Check target dummies
      const targetMeshes=[];
      for(const t of this.world.targets){
        if(t.visible&&!t.userData.dead) t.traverse(c=>{ if(c.isMesh&&!c.isSprite) targetMeshes.push(c); });
      }
      const hits=this._raycaster.intersectObjects(targetMeshes,false);

      if(hits.length>0){
        const hit=hits[0];
        const dummy=this._findDummy(hit.object);
        if(dummy){
          let dmg=w.damage;
          // Distance falloff for shotgun/pistol
          if(w.range<100){ const falloff=Math.max(0,1-hit.distance/w.range); dmg=Math.ceil(dmg*falloff); }
          this._hitTarget(dummy, dmg, hit.point);
          this.hitmarker.flash(dummy.userData.hp<=0);
          this.particles.spawnImpact(hit.point, 0xff4444);

          // Explosive splash
          if(w.splashRadius){
            for(const t2 of this.world.targets){
              if(t2===dummy||!t2.visible||t2.userData.dead) continue;
              const d2=t2.position.distanceTo(hit.point);
              if(d2<w.splashRadius){
                const sf=1-d2/w.splashRadius;
                this._hitTarget(t2, Math.ceil(w.damage*0.5*sf), t2.position);
              }
            }
            this.particles.spawnExplosion(hit.point);
            this.engine.shake(0.6);
          }
        }
      } else {
        // Impact on terrain / other
        const terrainHits=this.world.terrainMesh
          ? this._raycaster.intersectObject(this.world.terrainMesh,false)
          : [];
        if(terrainHits.length>0){
          this.particles.spawnImpact(terrainHits[0].point, 0x886644);
        }
      }
    }
  }

  _hitTarget(dummy, damage, impactPos){
    if(dummy.userData.dead) return;
    dummy.userData.hp=Math.max(0, dummy.userData.hp-damage);
    dummy.userData.hitTime=1.0;
    this.world.updateDummyHPBar(dummy);

    // Flash red emissive
    dummy.traverse(c=>{
      if(c.isMesh&&c.material&&c.material.color&&!c.material.color.equals(new THREE.Color(0x333333))){
        c.material.emissive=new THREE.Color(1,0,0);
        c.material.emissiveIntensity=1.5;
      }
    });

    this.score+=damage;
    this._updateScoreUI();

    if(dummy.userData.hp<=0){
      this.kills++;
      this._killDummy(dummy);
      this._updateScoreUI();
    }
  }

  _killDummy(dummy){
    dummy.userData.dead=true;
    dummy.visible=false;
    dummy.userData.respawnTimer=5;
    this.particles.spawnExplosion(dummy.position.clone().add(new THREE.Vector3(0,1,0)));
    this.engine.shake(0.25);
  }

  _findDummy(mesh){
    let obj=mesh;
    while(obj){ if(obj.userData&&obj.userData.isDummy) return obj; obj=obj.parent; }
    return null;
  }

  _spawnLaserBeam(ray, w){
    const pts=[ray.origin.clone(), ray.origin.clone().addScaledVector(ray.direction, w.range||150)];
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const mat=new THREE.LineBasicMaterial({ color:w.muzzleColor||0x00ffff, linewidth:2, transparent:true, opacity:0.9 });
    const line=new THREE.Line(geo,mat);
    this.scene.add(line);
    this._laserBeams.push({ line, life:0.12 });
  }

  _updateScoreUI(){
    const el=document.getElementById('score-counter');
    if(el) el.textContent=`💥 ${this.kills} Kills · ${this.score} pts`;
  }

  update(delta, now){
    this._muzzleLightTimer=Math.max(0,this._muzzleLightTimer-delta);
    if(this._muzzleLightTimer<=0) this._muzzleLight.intensity=0;

    // Laser beams decay
    for(let i=this._laserBeams.length-1;i>=0;i--){
      const b=this._laserBeams[i];
      b.life-=delta;
      b.line.material.opacity=Math.max(0,b.life/0.12);
      if(b.life<=0){ this.scene.remove(b.line); this._laserBeams.splice(i,1); }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle System
// ─────────────────────────────────────────────────────────────────────────────
export class ParticleSystem {
  constructor(scene){
    this.scene=scene;
    this.particles=[];
    this._geoS=new THREE.SphereGeometry(0.07,4,4);
    this._mats={
      gold:  new THREE.MeshStandardMaterial({color:0xFFD700,emissive:new THREE.Color(0.7,0.5,0),emissiveIntensity:1,metalness:0.6,roughness:0.1}),
      red:   new THREE.MeshStandardMaterial({color:0xff3322,emissive:new THREE.Color(0.8,0,0),emissiveIntensity:0.8}),
      smoke: new THREE.MeshStandardMaterial({color:0x888888,transparent:true,opacity:0.5,roughness:1}),
      spark: new THREE.MeshStandardMaterial({color:0xffee44,emissive:new THREE.Color(0.9,0.8,0),emissiveIntensity:1.5,metalness:0.3,roughness:0.1}),
      cyan:  new THREE.MeshStandardMaterial({color:0x00ffff,emissive:new THREE.Color(0,0.8,0.8),emissiveIntensity:1.5}),
      muzzle:new THREE.MeshStandardMaterial({color:0xffcc44,emissive:new THREE.Color(0.9,0.7,0),emissiveIntensity:2,transparent:true}),
    };
  }

  _spawn(pos, mat, count=8, speed=5, gravity=18, life=0.8, decay=1.2, sizeScale=1){
    for(let i=0;i<count;i++){
      const m=new THREE.Mesh(this._geoS,mat.clone());
      m.position.copy(pos);
      m.position.x+=(Math.random()-.5)*0.3;
      m.position.y+=(Math.random()-.5)*0.3;
      m.position.z+=(Math.random()-.5)*0.3;
      const ang=Math.random()*Math.PI*2;
      const vel=new THREE.Vector3(Math.cos(ang)*speed*0.7,1.5+Math.random()*speed,Math.sin(ang)*speed*0.7);
      this.scene.add(m);
      this.particles.push({mesh:m,vel,life,decay:decay+Math.random()*0.5,gravity,size:sizeScale*(0.7+Math.random()*0.6),mat});
    }
  }

  spawn(pos,count=16){ this._spawn(pos,this._mats.gold,count,5,20,1,1.1,1); }

  spawnImpact(pos,colorHex){
    const mat=colorHex===0xff4444?this._mats.red:this._mats.spark;
    this._spawn(pos,mat,8,6,22,0.6,1.5,0.7);
  }

  spawnMuzzle(pos,colorHex,count=5){
    const mat=this._mats.muzzle.clone();
    mat.color.setHex(colorHex);
    mat.emissive.setHex(colorHex);
    this._spawn(pos,mat,count,8,30,0.15,6,0.5);
  }

  spawnExplosion(pos){
    this._spawn(pos,this._mats.spark,24,9,20,1.2,1.2,1.2);
    this._spawn(pos,this._mats.smoke,8,3,8,1.5,0.8,2.0);
    this._spawn(pos,this._mats.red,12,7,18,0.9,1.4,0.8);
  }

  update(delta){
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.life-=p.decay*delta;
      if(p.life<=0){ this.scene.remove(p.mesh); this.particles.splice(i,1); continue; }
      p.vel.y-=p.gravity*delta;
      p.mesh.position.addScaledVector(p.vel,delta);
      const s=Math.max(0,p.life*p.size);
      p.mesh.scale.setScalar(s);
      if(p.mesh.material.opacity!==undefined) p.mesh.material.opacity=Math.min(1,p.life*2);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hitmarker
// ─────────────────────────────────────────────────────────────────────────────
export class Hitmarker {
  constructor(){
    this._el=document.getElementById('hitmarker');
    this._timer=0;
  }
  flash(isKill=false){
    if(!this._el) return;
    this._el.style.color=isKill?'#ff4444':'#ffffff';
    this._el.style.transform='scale(1.4)';
    this._el.style.opacity='1';
    this._timer=0.22;
  }
  update(delta){
    if(this._timer<=0) return;
    this._timer=Math.max(0,this._timer-delta);
    const t=this._timer/0.22;
    if(this._el){
      this._el.style.opacity=String(t);
      this._el.style.transform=`scale(${1+t*0.4})`;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI System
// ─────────────────────────────────────────────────────────────────────────────
export class UISystem {
  constructor(totalCoins=30){
    this.total=totalCoins; this.count=0;
    this._el=document.getElementById('coin-counter');
    this._win=document.getElementById('win-screen');
    this._refresh();
  }
  addCoin(){ this.count++; this._refresh(); this._pulse(); if(this.count>=this.total) setTimeout(()=>this._showWin(),500); }
  _refresh(){ if(this._el) this._el.textContent=`🪙 ${this.count} / ${this.total}`; }
  _pulse(){ if(!this._el) return; this._el.classList.add('pulse'); setTimeout(()=>this._el.classList.remove('pulse'),250); }
  _showWin(){ if(this._win){ this._win.style.display='flex'; setTimeout(()=>{ this._win.style.opacity='1'; },50); } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coin System
// ─────────────────────────────────────────────────────────────────────────────
export class CoinSystem {
  constructor(coinMeshes, particles, ui){
    this.coins=coinMeshes; this.particles=particles; this.ui=ui;
    this.RADIUS=2.1; this._collected=new Set();
  }
  check(playerPos){
    for(const coin of this.coins){
      if(!coin.visible) continue;
      const idx=coin.userData.coinIndex;
      if(this._collected.has(idx)) continue;
      const dx=coin.position.x-playerPos.x, dy=coin.position.y-(playerPos.y+1.1), dz=coin.position.z-playerPos.z;
      if(dx*dx+dy*dy+dz*dz<this.RADIUS*this.RADIUS) this._collect(coin,idx);
    }
  }
  _collect(coin,idx){
    this._collected.add(idx);
    this.particles.spawn(coin.position.clone(),18);
    coin.visible=false; this.ui.addCoin();
    const f=document.getElementById('collect-flash');
    if(f){ f.style.opacity='0.5'; setTimeout(()=>{ f.style.opacity='0'; },120); }
  }
}
