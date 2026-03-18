// player.js – Player, Movement, Camera, Weapon Attachment
import * as THREE from 'three';

export class Player {
  constructor(scene, camera, getHeight, weaponSystem) {
    this.scene         = scene;
    this.camera        = camera;
    this.getHeight     = getHeight;
    this.weaponSystem  = weaponSystem;

    this.position  = new THREE.Vector3(0, 2, 8);
    this.velocity  = new THREE.Vector3();
    this.onGround  = false;

    this.moveSpeed    = 9.5;
    this.gravity      = -28;

    // Camera orbit
    this.camAngle     = Math.PI;
    this.camPitch     = 0.32;
    this.camDist      = 8.5;
    this.camHeight    = 1.65;
    this._camTarget   = new THREE.Vector3();
    this._lookAtPos   = new THREE.Vector3();
    this._shakeOffset = new THREE.Vector3();  // injected by main loop

    // Animation
    this._walkCycle   = 0;
    this._leanAngle   = 0;
    this._breathTime  = 0;
    this._speedBlend  = 0;  // 0=idle, 1=full run

    // Character parts
    this._group       = null;
    this._headMesh    = null;
    this._bodyMesh    = null;
    this._leftLeg     = null;
    this._rightLeg    = null;
    this._leftArm     = null;
    this._rightArm    = null;
    this._rightHand   = null;  // weapon attachment point

    this._buildMesh();
    this._placeAtSpawn();
  }

  // ─── Character Mesh ──────────────────────────────────────────────────────────
  _buildMesh() {
    const g      = new THREE.Group();
    const bodyM  = new THREE.MeshStandardMaterial({ color:0x1565c0, roughness:0.65, metalness:0.05 });
    const headM  = new THREE.MeshStandardMaterial({ color:0xf5cba7, roughness:0.75, metalness:0 });
    const legM   = new THREE.MeshStandardMaterial({ color:0x0d1b3e, roughness:0.7,  metalness:0 });
    const armM   = new THREE.MeshStandardMaterial({ color:0x1565c0, roughness:0.65, metalness:0.05 });
    const eyeM   = new THREE.MeshStandardMaterial({ color:0x0a0a1a, roughness:0.5 });
    const hairM  = new THREE.MeshStandardMaterial({ color:0x3e1f00, roughness:0.85 });
    const shoeM  = new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.9 });
    const vestM  = new THREE.MeshStandardMaterial({ color:0x1a3a6a, roughness:0.7, metalness:0.1 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74,0.90,0.38), bodyM);
    torso.position.y=1.15; torso.castShadow=true; g.add(torso);
    this._bodyMesh = torso;

    // Vest detail
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.72,0.10), vestM);
    vest.position.set(0,1.18,0.20); g.add(vest);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.60,0.60,0.56), headM);
    head.position.y=1.90; head.castShadow=true; g.add(head);
    this._headMesh = head;

    // Hair
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.20,0.58), hairM);
    hair.position.y=2.14; g.add(hair);

    // Eyes
    const eyeGeo=new THREE.BoxGeometry(0.1,0.1,0.05);
    const eyeL=new THREE.Mesh(eyeGeo,eyeM); eyeL.position.set(0.14,1.90,0.29); g.add(eyeL);
    const eyeR=eyeL.clone(); eyeR.position.set(-0.14,1.90,0.29); g.add(eyeR);

    // Arms
    const armGeo=new THREE.BoxGeometry(0.22,0.72,0.22);
    const leftArm=new THREE.Group();
    const laM=new THREE.Mesh(armGeo,armM); laM.position.y=-0.36; laM.castShadow=true;
    leftArm.add(laM); leftArm.position.set(0.48,1.52,0); g.add(leftArm);
    this._leftArm=leftArm;

    const rightArm=new THREE.Group();
    const raM=new THREE.Mesh(armGeo,armM); raM.position.y=-0.36; raM.castShadow=true;
    rightArm.add(raM); rightArm.position.set(-0.48,1.52,0); g.add(rightArm);
    this._rightArm=rightArm;

    // Weapon hand anchor (at the end of right arm)
    const rightHand=new THREE.Group();
    rightHand.position.set(0,-0.72,0);
    rightArm.add(rightHand);
    this._rightHand=rightHand;

    // Attach weapon system anchor
    if(this.weaponSystem){
      // Scale weapon to fit hand
      const wAnchor=this.weaponSystem.weaponAnchor;
      wAnchor.scale.setScalar(0.34);
      wAnchor.rotation.set(0.2,-0.3,0.1);
      wAnchor.position.set(0,-0.05,0.3);
      rightHand.add(wAnchor);
    }

    // Legs
    const legGeo=new THREE.BoxGeometry(0.28,0.74,0.28);
    const shoeGeo=new THREE.BoxGeometry(0.30,0.12,0.36);

    const leftLeg=new THREE.Group();
    const llM=new THREE.Mesh(legGeo,legM); llM.position.y=-0.37; llM.castShadow=true; leftLeg.add(llM);
    const lShoe=new THREE.Mesh(shoeGeo,shoeM); lShoe.position.set(0,-0.78,0.05); leftLeg.add(lShoe);
    leftLeg.position.set(0.22,0.72,0); g.add(leftLeg);
    this._leftLeg=leftLeg;

    const rightLeg=new THREE.Group();
    const rlM=new THREE.Mesh(legGeo,legM); rlM.position.y=-0.37; rlM.castShadow=true; rightLeg.add(rlM);
    const rShoe=new THREE.Mesh(shoeGeo,shoeM); rShoe.position.set(0,-0.78,0.05); rightLeg.add(rShoe);
    rightLeg.position.set(-0.22,0.72,0); g.add(rightLeg);
    this._rightLeg=rightLeg;

    this.scene.add(g);
    this._group=g;
  }

  _placeAtSpawn() {
    const h=this.getHeight(0,8);
    this.position.set(0,h+0.1,8);
    this._group.position.copy(this.position);
    this._camTarget.copy(this.position).add(new THREE.Vector3(0,this.camHeight,0));
    this.camera.position.set(0,h+5,16);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────
  update(delta, inputState, shakeOffset) {
    this._move(delta, inputState);
    this._animateLimbs(delta);
    this._updateCamera(delta, inputState, shakeOffset);
  }

  _move(delta, inp) {
    const camFwd=new THREE.Vector3(); this.camera.getWorldDirection(camFwd);
    camFwd.y=0; if(camFwd.lengthSq()<0.0001) camFwd.set(0,0,-1); camFwd.normalize();
    const camRight=new THREE.Vector3().crossVectors(camFwd,new THREE.Vector3(0,1,0)).normalize();

    const dir=new THREE.Vector3();
    if(inp.forward)  dir.addScaledVector(camFwd,   1);
    if(inp.backward) dir.addScaledVector(camFwd,  -1);
    if(inp.left)     dir.addScaledVector(camRight,-1);
    if(inp.right)    dir.addScaledVector(camRight, 1);
    if(inp.joystick.active){
      dir.addScaledVector(camFwd,  -inp.joystick.y);
      dir.addScaledVector(camRight, inp.joystick.x);
    }
    if(dir.lengthSq()>1) dir.normalize();

    // Movement penalty from weapon
    const pen = this.weaponSystem ? (this.weaponSystem.current.movePenalty||0) : 0;
    const spd = this.moveSpeed * (1-pen);

    const lerpF=this.onGround?0.16:0.05;
    this.velocity.x=THREE.MathUtils.lerp(this.velocity.x,dir.x*spd,lerpF);
    this.velocity.z=THREE.MathUtils.lerp(this.velocity.z,dir.z*spd,lerpF);

    const terrH=this.getHeight(this.position.x,this.position.z);
    if(this.position.y<=terrH+0.05){ this.velocity.y=0; this.onGround=true; }
    else { this.velocity.y+=this.gravity*delta; this.onGround=false; }

    this.position.x+=this.velocity.x*delta;
    this.position.y+=this.velocity.y*delta;
    this.position.z+=this.velocity.z*delta;

    const newH=this.getHeight(this.position.x,this.position.z);
    if(this.position.y<newH){ this.position.y=newH; this.velocity.y=0; this.onGround=true; }

    const BOUND=98;
    this.position.x=Math.max(-BOUND,Math.min(BOUND,this.position.x));
    this.position.z=Math.max(-BOUND,Math.min(BOUND,this.position.z));

    // Rotate player toward movement
    const sp2d=Math.sqrt(this.velocity.x**2+this.velocity.z**2);
    if(sp2d>0.4){
      const ty=Math.atan2(-this.velocity.x,-this.velocity.z);
      let cur=this._group.rotation.y;
      let diff=ty-cur;
      while(diff>Math.PI) diff-=Math.PI*2;
      while(diff<-Math.PI) diff+=Math.PI*2;
      this._group.rotation.y+=diff*0.16;
    }

    this._group.position.copy(this.position);
    this._speedBlend=THREE.MathUtils.lerp(this._speedBlend, sp2d/this.moveSpeed, 0.12);
  }

  _animateLimbs(delta) {
    const sp2d=Math.sqrt(this.velocity.x**2+this.velocity.z**2);
    const walking=sp2d>0.5;
    if(walking) this._walkCycle+=delta*(7+sp2d*0.5);
    else this._walkCycle*=0.88;

    this._breathTime+=delta;
    const breath=Math.sin(this._breathTime*1.2)*0.012*(1-this._speedBlend);
    const swing=Math.sin(this._walkCycle)*0.55;

    if(this._leftLeg)  this._leftLeg.rotation.x  =  swing;
    if(this._rightLeg) this._rightLeg.rotation.x  = -swing;
    if(this._leftArm)  this._leftArm.rotation.x   = -swing*0.7;
    // Right arm: follow weapon recoil / only swing when no weapon in hand
    if(this._rightArm) {
      this._rightArm.rotation.x = swing*0.7 + (this.weaponSystem ? this.weaponSystem.recoilRot.x*0.4 : 0);
    }

    // Body lean
    const targetLean=this._speedBlend*0.06;
    this._leanAngle=THREE.MathUtils.lerp(this._leanAngle,targetLean,0.08);
    if(this._bodyMesh) this._bodyMesh.rotation.x=this._leanAngle;

    // Head bob
    if(this._headMesh){
      this._headMesh.position.y=1.90+Math.abs(Math.sin(this._walkCycle*2))*(walking?0.04:0)+breath;
    }
  }

  _updateCamera(delta, inp, shakeOffset) {
    if(inp.cameraDelta){
      this.camAngle-=inp.cameraDelta.dx*0.0038;
      this.camPitch=THREE.MathUtils.clamp(this.camPitch+inp.cameraDelta.dy*0.003,0.06,1.05);
    }

    // Zoom out slightly when running
    const targetDist=this.camDist+(this._speedBlend*0.9);
    const currentDist=THREE.MathUtils.lerp(this.camera.position.distanceTo(
      new THREE.Vector3(this.position.x,this.position.y+this.camHeight,this.position.z)
    ), targetDist, 0.08);

    const idealX=this.position.x+Math.sin(this.camAngle)*Math.cos(this.camPitch)*targetDist;
    const idealZ=this.position.z+Math.cos(this.camAngle)*Math.cos(this.camPitch)*targetDist;
    const idealY=this.position.y+this.camHeight+Math.sin(this.camPitch)*targetDist;

    const camTH=this.getHeight(idealX,idealZ);
    const safeY=Math.max(idealY,camTH+1.4);
    this._camTarget.set(idealX,safeY,idealZ);

    // Add shake
    if(shakeOffset){
      this._camTarget.x+=shakeOffset.x;
      this._camTarget.y+=shakeOffset.y;
    }

    this.camera.position.lerp(this._camTarget,0.10);
    this._lookAtPos.set(this.position.x,this.position.y+this.camHeight,this.position.z);
    this.camera.lookAt(this._lookAtPos);
  }

  // ─── Shooting ─────────────────────────────────────────────────────────────────
  buildShootRay(spreadX=0, spreadY=0) {
    const dir=new THREE.Vector3(); this.camera.getWorldDirection(dir);
    dir.x+=spreadX; dir.y+=spreadY;
    dir.normalize();
    return new THREE.Ray(this.camera.position.clone(), dir);
  }
}
