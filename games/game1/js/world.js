// world.js – Terrain, Trees, Fence, Coins, Target Dummies, Rocks
import * as THREE from 'three';

// ─── Perlin Noise ─────────────────────────────────────────────────────────────
class Perlin {
  constructor(seed = 42) {
    const p = Array.from({length:256},(_,i)=>i);
    let s = seed;
    const rng = () => { s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
    for(let i=255;i>0;i--){ const j=Math.floor(rng()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; }
    this.p=[...p,...p];
  }
  _fade(t){return t*t*t*(t*(t*6-15)+10);}
  _lerp(a,b,t){return a+t*(b-a);}
  _grad(h,x,y){h&=3;const u=h<2?x:y,v=h<2?y:x;return((h&1)?-u:u)+((h&2)?-v:v);}
  noise(x,y){
    const X=Math.floor(x)&255,Y=Math.floor(y)&255;
    x-=Math.floor(x); y-=Math.floor(y);
    const u=this._fade(x),v=this._fade(y),p=this.p;
    const a=p[X]+Y,b=p[X+1]+Y;
    return this._lerp(
      this._lerp(this._grad(p[a],x,y),    this._grad(p[b],x-1,y),u),
      this._lerp(this._grad(p[a+1],x,y-1),this._grad(p[b+1],x-1,y-1),u),v
    );
  }
  fbm(x,y,oct=6,pers=0.52,lac=2.1){
    let v=0,a=0.5,f=1,mx=0;
    for(let i=0;i<oct;i++){v+=this.noise(x*f,y*f)*a;mx+=a;a*=pers;f*=lac;}
    return v/mx;
  }
}

// ─── World ────────────────────────────────────────────────────────────────────
export class World {
  constructor(scene) {
    this.scene       = scene;
    this.noise       = new Perlin(1337);
    this.SIZE        = 210;
    this.HALF        = 105;
    this.SEGS        = 130;
    this.coinMeshes  = [];
    this.targets     = [];      // shootable dummies
    this._foliageUni = null;
    this._rocks      = [];
  }

  _heightAt(wx, wz) {
    const nx = wx / this.SIZE, nz = wz / this.SIZE;
    let h = this.noise.fbm(nx*2.8+0.5, nz*2.8+0.5, 6, 0.52, 2.1) * 22;
    h += this.noise.noise(nx*12, nz*12) * 1.2;
    // Spawn clearing
    const d = Math.sqrt(wx*wx + wz*wz);
    if (d < 18) h *= (d/18)*(d/18);
    // Edge mountains
    const ex=Math.abs(wx)/this.HALF, ez=Math.abs(wz)/this.HALF;
    const edge=Math.max(ex,ez);
    if (edge > 0.78) { const t=(edge-0.78)/0.22; h+=t*t*t*40; }
    return Math.max(0, h);
  }

  getHeight(wx, wz) { return this._heightAt(wx, wz); }

  generate() {
    this._buildTerrain();
    this._buildTrees();
    this._buildRocks();
    this._buildFence();
    this._buildCoins();
    this._buildTargets();
    this._buildGroundFog();
  }

  // ─── Terrain ─────────────────────────────────────────────────────────────────
  _buildTerrain() {
    const geo = new THREE.PlaneGeometry(this.SIZE, this.SIZE, this.SEGS, this.SEGS);
    geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position, cnt=pos.count;
    const colors=new Float32Array(cnt*3), col=new THREE.Color();
    for(let i=0;i<cnt;i++){
      const wx=pos.getX(i), wz=pos.getZ(i);
      const h=this._heightAt(wx,wz);
      pos.setY(i,h);
      if(h>24){ col.setRGB(0.90,0.94,0.98); }
      else if(h>17){ const t=(h-17)/7; col.setRGB(THREE.MathUtils.lerp(0.48,0.9,t),THREE.MathUtils.lerp(0.44,0.94,t),THREE.MathUtils.lerp(0.38,0.98,t)); }
      else { const v=this.noise.noise(wx*0.08,wz*0.08)*0.08; col.setRGB(0.30+v,0.54+v,0.20+v); }
      colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this._makeGrassTex(),
      vertexColors: true,
      roughness: 0.92, metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.terrainMesh = mesh;
    this.scene.add(mesh);
  }

  _makeGrassTex() {
    const S=512, cvs=document.createElement('canvas');
    cvs.width=cvs.height=S;
    const ctx=cvs.getContext('2d');
    ctx.fillStyle='#4b7d2c'; ctx.fillRect(0,0,S,S);
    for(let i=0;i<140;i++){
      const x=Math.random()*S,y=Math.random()*S,r=6+Math.random()*30;
      const g=Math.floor(Math.random()*30+50),b=Math.floor(Math.random()*20+8);
      ctx.fillStyle=`rgba(28,${g},${b},0.18)`;
      ctx.beginPath(); ctx.ellipse(x,y,r,r*(0.4+Math.random()*0.5),Math.random()*Math.PI,0,Math.PI*2); ctx.fill();
    }
    for(let i=0;i<1400;i++){
      const x=Math.random()*S,y=Math.random()*S,h=5+Math.random()*14;
      const gn=80+Math.floor(Math.random()*60);
      ctx.strokeStyle=`rgba(14,${gn},4,0.42)`; ctx.lineWidth=0.5+Math.random()*0.9;
      ctx.beginPath(); ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x+(Math.random()-.5)*5,y-h*0.6,x+(Math.random()-.5)*9,y-h);
      ctx.stroke();
    }
    const t=new THREE.CanvasTexture(cvs);
    t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(32,32);
    return t;
  }

  // ─── Trees ────────────────────────────────────────────────────────────────────
  _buildTrees() {
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const COUNT  = mobile ? 260 : 480;
    const trunkMat = new THREE.MeshStandardMaterial({ color:0x4a2e10, roughness:0.95, metalness:0 });

    const foliageMat = new THREE.MeshStandardMaterial({ roughness:0.78, metalness:0 });
    foliageMat.onBeforeCompile = shader => {
      shader.uniforms.uTime = { value: 0 };
      this._foliageUni = shader.uniforms;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float phaseShift = instanceMatrix[3][0]*0.07 + instanceMatrix[3][2]*0.07;
        float sway  = sin(uTime*1.4 + phaseShift) * 0.12;
        float sway2 = cos(uTime*0.98 + phaseShift + 1.2) * 0.06;
        float tip   = max(0.0, position.y/4.0);
        transformed.x += sway*tip; transformed.z += sway2*tip;
      `);
    };

    const trunkGeo=new THREE.CylinderGeometry(0.18,0.32,3.2,7);
    const c1=new THREE.ConeGeometry(2.2,4.2,8);
    const c2=new THREE.ConeGeometry(1.7,3.4,8);
    const c3=new THREE.ConeGeometry(1.1,2.6,8);
    const blobGeo=new THREE.SphereGeometry(1.6,7,5);

    const tIM=new THREE.InstancedMesh(trunkGeo,trunkMat,COUNT);
    const c1IM=new THREE.InstancedMesh(c1,foliageMat,COUNT);
    const c2IM=new THREE.InstancedMesh(c2,foliageMat,COUNT);
    const c3IM=new THREE.InstancedMesh(c3,foliageMat,COUNT);
    const bIM=new THREE.InstancedMesh(blobGeo,foliageMat,COUNT);

    [tIM,c1IM,c2IM,c3IM,bIM].forEach(m=>{ m.castShadow=m.receiveShadow=true; });

    const d=new THREE.Object3D(), col=new THREE.Color();
    let placed=0, tries=0;
    while(placed<COUNT && tries<COUNT*12){
      tries++;
      const wx=(Math.random()-.5)*(this.SIZE-22);
      const wz=(Math.random()-.5)*(this.SIZE-22);
      if(Math.sqrt(wx*wx+wz*wz)<14) continue;
      const wh=this._heightAt(wx,wz);
      if(wh>23||wh<0.3) continue;
      const sc=0.55+Math.random()*0.9, ry=Math.random()*Math.PI*2;
      const isPine=Math.random()>0.28;

      d.position.set(wx,wh+1.6*sc,wz); d.rotation.set(0,ry,0); d.scale.set(sc,sc,sc); d.updateMatrix();
      tIM.setMatrixAt(placed, d.matrix);

      if(isPine){
        d.position.set(wx,wh+3.5*sc,wz); d.scale.set(sc,sc,sc); d.updateMatrix(); c1IM.setMatrixAt(placed,d.matrix);
        col.setHSL(0.32+Math.random()*0.04,0.6+Math.random()*0.15,0.20+Math.random()*0.07); c1IM.setColorAt(placed,col);
        d.position.set(wx,wh+5.8*sc,wz); d.scale.set(sc*.78,sc*.78,sc*.78); d.updateMatrix(); c2IM.setMatrixAt(placed,d.matrix);
        col.setHSL(0.33+Math.random()*0.04,0.6,0.22+Math.random()*0.05); c2IM.setColorAt(placed,col);
        d.position.set(wx,wh+7.7*sc,wz); d.scale.set(sc*.55,sc*.55,sc*.55); d.updateMatrix(); c3IM.setMatrixAt(placed,d.matrix);
        col.setHSL(0.34+Math.random()*0.03,0.55,0.24+Math.random()*0.04); c3IM.setColorAt(placed,col);
        d.scale.set(0,0,0); d.updateMatrix(); bIM.setMatrixAt(placed,d.matrix);
      } else {
        d.position.set(wx,wh+4.5*sc,wz); d.scale.set(sc*1.1,sc*0.9,sc*1.1); d.updateMatrix(); bIM.setMatrixAt(placed,d.matrix);
        col.setHSL(0.30+Math.random()*0.08,0.55+Math.random()*0.15,0.26+Math.random()*0.07); bIM.setColorAt(placed,col);
        d.scale.set(0,0,0); d.updateMatrix();
        c1IM.setMatrixAt(placed,d.matrix); c2IM.setMatrixAt(placed,d.matrix); c3IM.setMatrixAt(placed,d.matrix);
      }
      placed++;
    }

    [tIM,c1IM,c2IM,c3IM,bIM].forEach(m=>{
      m.instanceMatrix.needsUpdate=true;
      if(m.instanceColor) m.instanceColor.needsUpdate=true;
      this.scene.add(m);
    });
    this._foliageMeshes=[c1IM,c2IM,c3IM,bIM];
  }

  // ─── Rocks ────────────────────────────────────────────────────────────────────
  _buildRocks() {
    const rockMat = new THREE.MeshStandardMaterial({ color:0x778899, roughness:0.88, metalness:0.1 });
    const COUNT=60;
    for(let i=0;i<COUNT;i++){
      let wx, wz;
      do{ wx=(Math.random()-.5)*(this.SIZE-30); wz=(Math.random()-.5)*(this.SIZE-30); }
      while(Math.sqrt(wx*wx+wz*wz)<12);
      const wh=this._heightAt(wx,wz);
      if(wh>22||wh<0.2) continue;
      const sc=0.3+Math.random()*1.2;
      const geo=new THREE.DodecahedronGeometry(sc,0);
      const verts=geo.attributes.position;
      for(let j=0;j<verts.count;j++){
        verts.setXYZ(j, verts.getX(j)*(0.8+Math.random()*0.4), verts.getY(j)*(0.7+Math.random()*0.5), verts.getZ(j)*(0.8+Math.random()*0.4));
      }
      geo.computeVertexNormals();
      const rock=new THREE.Mesh(geo,rockMat);
      rock.position.set(wx, wh+sc*0.35, wz);
      rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      rock.castShadow=rock.receiveShadow=true;
      rock.name='rock';
      this.scene.add(rock);
      this._rocks.push(rock);
    }
  }

  // ─── Fence ────────────────────────────────────────────────────────────────────
  _buildFence() {
    const BOUND=this.HALF-3, SPACING=4.2;
    const steps=Math.floor(BOUND*2/SPACING);
    const postMat=new THREE.MeshStandardMaterial({color:0x7a5533,roughness:0.9});
    const railMat=new THREE.MeshStandardMaterial({color:0x8a6540,roughness:0.85});
    const postGeo=new THREE.BoxGeometry(0.32,2.4,0.32);
    const railGeo=new THREE.BoxGeometry(SPACING+0.1,0.14,0.14);
    const addSide=(axis,sign)=>{
      for(let i=0;i<=steps;i++){
        const t=-BOUND+i*SPACING;
        const wx=axis==='x'?sign*BOUND:t, wz=axis==='z'?sign*BOUND:t;
        const wh=this._heightAt(wx,wz);
        const post=new THREE.Mesh(postGeo,postMat);
        post.position.set(wx,wh+1.2,wz); post.castShadow=true;
        this.scene.add(post);
        if(i<steps){
          const nt=t+SPACING;
          const nwx=axis==='x'?sign*BOUND:nt, nwz=axis==='z'?sign*BOUND:nt;
          const nwh=this._heightAt(nwx,nwz), midH=(wh+nwh)/2;
          const r1=new THREE.Mesh(railGeo,railMat);
          r1.position.set((wx+nwx)/2,midH+1.85,(wz+nwz)/2);
          if(axis==='z') r1.rotation.y=Math.PI/2;
          this.scene.add(r1);
          const r2=r1.clone(); r2.position.y=midH+0.95; this.scene.add(r2);
        }
      }
    };
    addSide('x',1); addSide('x',-1); addSide('z',1); addSide('z',-1);
    const wMat=new THREE.MeshBasicMaterial({visible:false});
    const wGeo=new THREE.BoxGeometry(this.SIZE+4,40,1.5);
    [[0,BOUND,0],[0,-BOUND,0],[BOUND,0,Math.PI/2],[-BOUND,0,Math.PI/2]].forEach(([x,z,ry])=>{
      const w=new THREE.Mesh(wGeo,wMat); w.position.set(x,12,z); w.rotation.y=ry; this.scene.add(w);
    });
  }

  // ─── Coins ────────────────────────────────────────────────────────────────────
  _buildCoins() {
    const TOTAL=30;
    const coinGeo=new THREE.TorusGeometry(0.38,0.1,8,18);
    const coinMat=new THREE.MeshStandardMaterial({
      color:0xFFD700, metalness:0.92, roughness:0.06,
      emissive:new THREE.Color(0.6,0.45,0), emissiveIntensity:0.4,
    });
    const innerGeo=new THREE.CircleGeometry(0.22,5);
    const innerMat=new THREE.MeshStandardMaterial({
      color:0xFFA500, metalness:0.8, roughness:0.1,
      emissive:new THREE.Color(0.5,0.25,0), emissiveIntensity:0.6, side:THREE.DoubleSide,
    });
    for(let i=0;i<TOTAL;i++){
      let wx,wz;
      do{ wx=(Math.random()-.5)*(this.SIZE-30); wz=(Math.random()-.5)*(this.SIZE-30); }
      while(Math.sqrt(wx*wx+wz*wz)<12);
      const wh=this._heightAt(wx,wz);
      const group=new THREE.Group();
      const ring=new THREE.Mesh(coinGeo,coinMat); ring.rotation.x=Math.PI/2; group.add(ring);
      const star=new THREE.Mesh(innerGeo,innerMat); star.rotation.x=Math.PI/2; group.add(star);
      const glow=new THREE.PointLight(0xFFD700,0.6,4); group.add(glow);
      group.position.set(wx,wh+1.4,wz);
      group.userData.baseY=wh+1.4; group.userData.coinIndex=i; group.userData.isCoin=true;
      this.scene.add(group);
      this.coinMeshes.push(group);
    }
  }

  // ─── Target Dummies ───────────────────────────────────────────────────────────
  _buildTargets() {
    const COLORS=[0xff3333,0x33aaff,0x33ff66,0xffaa33,0xcc44ff,0xff6699,0x44ffdd,0xffff33];
    const COUNT=10;
    for(let i=0;i<COUNT;i++){
      let wx,wz;
      do{ wx=(Math.random()-.5)*150; wz=(Math.random()-.5)*150; }
      while(Math.sqrt(wx*wx+wz*wz)<20);
      const wh=this._heightAt(wx,wz);
      const color=COLORS[i%COLORS.length];
      const dummy=this._buildDummyMesh(color);
      dummy.position.set(wx,wh,wz);
      dummy.userData={
        isDummy:true, hp:100, maxHp:100, index:i,
        basePos:new THREE.Vector3(wx,wh,wz),
        hitTime:0, dead:false, respawnTimer:0,
      };
      this.scene.add(dummy);
      this.targets.push(dummy);
    }
  }

  _buildDummyMesh(color) {
    const mat  = new THREE.MeshStandardMaterial({ color, roughness:0.7, metalness:0.1 });
    const matG = new THREE.MeshStandardMaterial({ color:0x333333, roughness:0.8 });
    const g    = new THREE.Group();

    // Body
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.36,1.1,10), mat);
    body.position.y=0.85; body.castShadow=true; g.add(body);
    // Head
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,8), mat);
    head.position.y=1.7; head.castShadow=true; g.add(head);
    // Arms
    for(const s of [-1,1]){
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.7,8), mat);
      arm.position.set(s*0.5,1.0,0); arm.rotation.z=s*0.4; arm.castShadow=true; g.add(arm);
    }
    // Base
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.45,0.18,10), matG);
    base.position.y=0.09; base.castShadow=true; g.add(base);

    // HP bar (sprite)
    const hpCanvas=document.createElement('canvas');
    hpCanvas.width=128; hpCanvas.height=24;
    const hpCtx=hpCanvas.getContext('2d');
    hpCtx.fillStyle='#1a1a1a'; hpCtx.fillRect(0,0,128,24);
    hpCtx.fillStyle='#22dd44'; hpCtx.fillRect(2,2,124,20);
    const hpTex=new THREE.CanvasTexture(hpCanvas);
    const hpMat=new THREE.SpriteMaterial({ map:hpTex, depthTest:false, transparent:true });
    const hpSprite=new THREE.Sprite(hpMat);
    hpSprite.scale.set(1.4,0.28,1);
    hpSprite.position.y=2.3;
    g.add(hpSprite);
    g.userData.hpSprite=hpSprite;
    g.userData.hpCanvas=hpCanvas;
    g.userData.hpCtx=hpCtx;
    g.userData.hpTex=hpTex;
    return g;
  }

  updateDummyHPBar(dummy) {
    const { hpCtx, hpCanvas, hpTex, hp, maxHp } = dummy.userData;
    if(!hpCtx) return;
    const pct = Math.max(0, hp/maxHp);
    hpCtx.clearRect(0,0,128,24);
    hpCtx.fillStyle='#1a1a1a'; hpCtx.fillRect(0,0,128,24);
    const col = pct > 0.5 ? '#22dd44' : pct > 0.25 ? '#ffaa22' : '#ff3333';
    hpCtx.fillStyle=col; hpCtx.fillRect(2,2,Math.round(124*pct),20);
    hpTex.needsUpdate=true;
  }

  // ─── Ground fog strips ────────────────────────────────────────────────────────
  _buildGroundFog() {
    const fogMat=new THREE.MeshBasicMaterial({color:0xd0e8f0,transparent:true,opacity:0.10,depthWrite:false,side:THREE.DoubleSide});
    for(let i=0;i<18;i++){
      const geo=new THREE.PlaneGeometry(20+Math.random()*40,4+Math.random()*6);
      const mesh=new THREE.Mesh(geo,fogMat);
      const wx=(Math.random()-.5)*this.SIZE*0.7, wz=(Math.random()-.5)*this.SIZE*0.7;
      const wh=this._heightAt(wx,wz);
      mesh.position.set(wx,wh+0.4+Math.random()*1.5,wz);
      mesh.rotation.x=-Math.PI/2; mesh.rotation.z=Math.random()*Math.PI;
      this.scene.add(mesh);
    }
  }

  // ─── Update ───────────────────────────────────────────────────────────────────
  update(time, delta) {
    if(this._foliageUni) this._foliageUni.uTime.value=time;

    // Coin float + spin
    for(const coin of this.coinMeshes){
      if(!coin.visible) continue;
      coin.rotation.y=time*1.4;
      coin.position.y=coin.userData.baseY+Math.sin(time*2.2+coin.userData.coinIndex*0.8)*0.22;
    }

    // Target dummy respawn + hit flash
    for(const d of this.targets){
      if(d.userData.dead){
        d.userData.respawnTimer-=delta;
        if(d.userData.respawnTimer<=0){
          d.userData.dead=false;
          d.userData.hp=d.userData.maxHp;
          d.visible=true;
          this.updateDummyHPBar(d);
        }
        continue;
      }
      // Hit flash: tween color back to normal
      if(d.userData.hitTime>0){
        d.userData.hitTime=Math.max(0,d.userData.hitTime-delta*4);
        const f=d.userData.hitTime;
        d.traverse(c=>{ if(c.isMesh && c.material.color && !c.material.color.equals(new THREE.Color(0x333333))){
          c.material.emissiveIntensity=f*2.5;
        }});
      }
    }
  }
}
