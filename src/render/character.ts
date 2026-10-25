import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {V3} from '../game/math';
const UP=new THREE.Vector3(0,1,0);
export class Character {
 root:THREE.Object3D;bones:Record<string,THREE.Bone>={};rest:Record<string,THREE.Quaternion>={};mixer:THREE.AnimationMixer;actions:Record<string,THREE.AnimationAction>={};current='';
 constructor(asset:GLTF){this.root=clone(asset.scene);this.root.traverse(o=>{if(o instanceof THREE.Bone){const name=o.name.replace(/(upperarm|forearm|hand|thigh|shin|foot)([LR])$/,'$1.$2');this.bones[name]=o;this.rest[name]=o.quaternion.clone()}if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});this.mixer=new THREE.AnimationMixer(this.root);asset.animations.forEach(c=>{const key=['Idle','Run','Bowl','Defend','Drive','Loft','Pull','Catch'].find(k=>c.name.includes(k));if(key)this.actions[key]=this.mixer.clipAction(c)});}
 reset(){for(const [n,b] of Object.entries(this.bones))b.quaternion.copy(this.rest[n])}
 rotate(name:string,x=0,y=0,z=0){const b=this.bones[name];if(!b)return;b.quaternion.copy(this.rest[name]).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)))}
 sample(name:string,time:number){
  this.mixer.stopAllAction();this.reset();const action=this.actions[name];if(!action)return;
  action.reset().play();action.paused=true;action.time=Math.max(0,time)%Math.max(.01,action.getClip().duration);this.mixer.update(0);
 }
 poseIdle(t:number){this.sample('Idle',t);}

 play(clip:string,dt:number,speed=1){const a=this.actions[clip];if(a){if(this.current!==clip){Object.values(this.actions).forEach(x=>x.fadeOut(.12));a.reset().fadeIn(.12).play();this.current=clip}this.mixer.update(dt*speed)}}
 run(t:number,amp=1){this.sample('Run',t*1.35);this.rotate('chest',.1);this.root.position.y=Math.abs(Math.sin(t*12))*.04*amp;}
 /** Analytic two-bone arm positioning keeps the palms on the actual handle. */
 armIK(side:string,target:THREE.Vector3){
  const upper=this.bones['upperarm.'+side],fore=this.bones['forearm.'+side],hand=this.bones['hand.'+side];if(!upper||!fore||!hand)return;
  this.root.updateMatrixWorld(true);const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=fore.getWorldPosition(new THREE.Vector3()),wrist=hand.getWorldPosition(new THREE.Vector3());
  const l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(wrist),delta=target.clone().sub(shoulder),d=THREE.MathUtils.clamp(delta.length(),.02,l1+l2-.002),dir=delta.normalize();
  const c=THREE.MathUtils.clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1),h=Math.sqrt(Math.max(0,1-c*c))*l1;
  const pole=new THREE.Vector3(side==='L'?-.5:.5,-.6,-.25).applyQuaternion(this.root.quaternion).projectOnPlane(dir).normalize();
  const joint=shoulder.clone().addScaledVector(dir,c*l1).addScaledVector(pole,h);
  this.pointBone(upper,joint);this.root.updateMatrixWorld(true);this.pointBone(fore,target);this.root.updateMatrixWorld(true);
 }
 pointBone(bone:THREE.Bone,target:THREE.Vector3){const pos=bone.getWorldPosition(new THREE.Vector3());const desired=target.clone().sub(pos).normalize();const parentQ=bone.parent!.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(UP,desired)).premultiply(parentQ.invert());}
 bat(handle:V3,toe:V3,t:number,shot='drive'){const clip=({defend:'Defend',drive:'Drive',loft:'Loft',pull:'Pull'} as Record<string,string>)[shot];this.sample(t>=0&&t<.8?clip:'Idle',t>=0?t*1.2:0);this.rotate('thigh.L',-.09,0,-.08);this.rotate('thigh.R',-.10,0,.08);this.rotate('shin.L',.12);this.rotate('shin.R',.12);this.rotate('chest',.07,0,Math.sin(Math.max(0,t)*3)*.06);const h=new THREE.Vector3(handle.x,handle.y,handle.z),axis=new THREE.Vector3(handle.x-toe.x,handle.y-toe.y,handle.z-toe.z).normalize();this.armIK('L',h.clone().addScaledVector(axis,.12));this.armIK('R',h.clone().addScaledVector(axis,.035));}
 bowl(t:number,phase:string,phaseTime:number){if(phase==='runup'&&phaseTime<2.1){this.run(t);return}this.reset();const p=phase==='runup'?THREE.MathUtils.clamp((phaseTime-2.1)/.55,0,1):Math.min(1,phaseTime*2);const angle=phase==='runup'?-p*Math.PI: -Math.PI-p*Math.PI;
 this.rotate('upperarm.R',angle);this.rotate('upperarm.L',-Math.sin(p*Math.PI)*1.7);this.rotate('chest',Math.sin(p*Math.PI)*.22);this.rotate('thigh.L',-.35*Math.sin(p*Math.PI));this.rotate('shin.L',.4*Math.sin(p*Math.PI));}
}
