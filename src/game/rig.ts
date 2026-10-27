import {Bone,Matrix4,Object3D,Quaternion,Vector3,Euler} from 'three';
import graph from '../assets/rig.json';
import {clamp,smooth,v,type V3} from './math';
import type {Shot} from './types';
export interface BatPose {handle:V3;toe:V3;up:V3;normal:V3;width:V3;grips:{L:V3;R:V3};errors:{L:number;R:number};}
const plain=(p:Vector3)=>v(p.x,p.y,p.z);
const Y=new Vector3(0,1,0);
export const RELEASE_TIME=2.65,CONTACT_TIME=.18;
/** Rest transforms are exported from the same .blend/glTF as the visible skin. */
export class CricketRig {
 root:Object3D;batController=new Object3D();gripNodes={L:new Object3D(),R:new Object3D()};bones:Record<string,Object3D>={};rest:Record<string,Quaternion>={};positions:Record<string,Vector3>={};palms:Record<string,Vector3>={};bindWorld:Record<string,Quaternion>={};lastErrors={L:0,R:0};
 constructor(root?:Object3D){
  if(root)this.root=root;else{
   this.root=new Object3D();const nodes=graph.nodes.map(n=>{const b=new Bone();b.name=n.name??'';if(n.translation)b.position.fromArray(n.translation);if(n.rotation)b.quaternion.fromArray(n.rotation);if(n.scale)b.scale.fromArray(n.scale);return b});
   graph.nodes.forEach((n,i)=>n.children?.forEach(c=>{if(nodes[c].name)nodes[i].add(nodes[c])}));graph.roots.forEach(i=>{if(nodes[i].name)this.root.add(nodes[i])});
  }
  this.root.traverse(b=>{const n=b.name.replace(/(upperarm|forearm|hand|thigh|shin|foot)([LR])$/,'$1.$2');if(n&&b!==this.root&&(b as any).isBone){this.bones[n]=b;this.rest[n]=b.quaternion.clone();this.positions[n]=b.position.clone()}});
  this.root.updateMatrixWorld(true);
  for(const [n,b] of Object.entries(this.bones))this.bindWorld[n]=b.getWorldQuaternion(new Quaternion());
  for(const s of ['L','R']){const h=this.bones['hand.'+s],p=h.getWorldPosition(new Vector3()).add(new Vector3(0,-.035,.058));this.palms[s]=h.worldToLocal(p)}
  this.batController.name='Bat_Controller';this.root.add(this.batController);for(const side of ['L','R'] as const){const grip=this.gripNodes[side];grip.name=side==='L'?'Grip_Left':'Grip_Right';grip.position.y=side==='L'?.16:.065;this.batController.add(grip)}
 }
 reset(){for(const [n,b] of Object.entries(this.bones)){b.quaternion.copy(this.rest[n]);b.position.copy(this.positions[n])}}
 rotate(n:string,x=0,y=0,z=0){const b=this.bones[n];if(b)b.quaternion.copy(this.rest[n]).multiply(new Quaternion().setFromEuler(new Euler(x,y,z)))}
 position(n:string){this.root.updateMatrixWorld(true);return this.bones[n].getWorldPosition(new Vector3())}
 point(n:string,child:string,target:Vector3){const b=this.bones[n],c=this.bones[child];this.root.updateMatrixWorld(true);const dir=target.clone().sub(b.getWorldPosition(new Vector3())).normalize().applyQuaternion(b.parent!.getWorldQuaternion(new Quaternion()).invert());const axis=c.position.clone().applyQuaternion(this.rest[n]).normalize();b.quaternion.copy(new Quaternion().setFromUnitVectors(axis,dir).multiply(this.rest[n]));this.root.updateMatrixWorld(true)}
 chain(a:string,b:string,c:string,target:Vector3,pole:Vector3){
  const p=this.position(a),j=this.position(b),end=this.position(c),l1=p.distanceTo(j),l2=j.distanceTo(end),delta=target.clone().sub(p),d=clamp(delta.length(),Math.abs(l1-l2)+.004,l1+l2-.003),dir=delta.normalize();
  const reach=p.clone().addScaledVector(dir,d),co=clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1),bend=pole.clone().projectOnPlane(dir).normalize();
  const elbow=p.clone().addScaledVector(dir,l1*co).addScaledVector(bend,l1*Math.sqrt(1-co*co));this.point(a,b,elbow);this.point(b,c,reach);return target.distanceTo(reach);
 }
 wristTarget(side:string,grip:Vector3,batUp:Vector3){
  const shoulder=this.position('upperarm.'+side);const approach=grip.clone().sub(shoulder).normalize();let x=batUp.clone().cross(approach).normalize();if(x.length()<.1)x.set(1,0,0);const z=x.clone().cross(approach).normalize();
  const q=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,approach,z));const wrist=grip.clone().sub(this.palms[side].clone().applyQuaternion(q));
  return {wrist,q};
 }
 arm(side:string,grip:Vector3,batUp:Vector3){const {wrist,q}=this.wristTarget(side,grip,batUp);
  this.chain('upperarm.'+side,'forearm.'+side,'hand.'+side,wrist,new Vector3(side==='L'?-.1:.1,-1,side==='L'?-.2:.4));const hand=this.bones['hand.'+side];hand.quaternion.copy(hand.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(q));this.root.updateMatrixWorld(true);
  return this.palm(side).distanceTo(grip);
 }
 palm(side:string){this.root.updateMatrixWorld(true);return this.bones['hand.'+side].localToWorld(this.palms[side].clone())}
 leg(side:string,target:Vector3){this.chain('thigh.'+side,'shin.'+side,'foot.'+side,target,new Vector3(0,0,-1));const foot=this.bones['foot.'+side];const q=this.root.quaternion.clone().multiply(this.bindWorld['foot.'+side]);foot.quaternion.copy(foot.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(q));}
 batting(t:number,shot:Shot,line:number,height:number,aim:number):BatPose{
  this.reset();const active=t>=0&&t<.82,phase=active?t:0,weight=active?Math.sin(Math.PI*clamp(phase/.74,0,1)):0,contact=active?smooth(phase/.16)*(1-smooth((phase-.48)/.30)):0;
  const pull=shot==='pull',loft=shot==='loft',defend=shot==='defend';const x=clamp(line,-.55,.55)-.28;
  this.root.position.set(x,-.10-contact*(height<.4?.16:.07),9.02+(pull?.10:defend?-.07:-.16)*contact);this.root.rotation.set(0,2.05,0);
  this.rotate('pelvis',0,(pull?-.46:loft?-.24:defend?-.04:-.12)*weight,0);this.rotate('spine',.12+contact*(pull?.02:defend?.12:.22),0,0);this.rotate('chest',.04,(pull?-.55:loft?-.3:defend?-.04:-.12)*weight,0);this.rotate('head',-.12-contact*.10,.75+aim*.12,0);
  // Planted ankles with a front-foot stride for drives, back-foot transfer for the pull.
  const stepLift=active&&phase<.16?Math.sin(Math.PI*smooth(phase/.16))*.055:0;this.leg('L',new Vector3(x-.09,.075+(pull?0:stepLift),8.91-(pull?0:(defend?.12:loft?.36:.32)*contact)));this.leg('R',new Vector3(x+.09,.075+(pull?stepLift*.7:0),9.14+(pull?.11*contact:0)));
  let h=new Vector3(x+.28,.91,8.87),up=new Vector3(-.10,.98,-.12).normalize(),normal=new Vector3(0,0,-1);
  if(active){
   const restingUp=up.clone();
   const heightReach=clamp(height,pull?.65:.10,pull?1.35:.92),angle=clamp(aim,-1,1)*(pull?.65:1.05)+(pull?.28:0),pitch=loft?.48:defend?-.12:pull?.025:-.025;
   normal.set(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),-Math.cos(angle)*Math.cos(pitch));up.copy(Y).addScaledVector(normal,-Y.dot(normal)).normalize();
   if(pull)up.set(-Math.cos(angle),0,-Math.sin(angle));
   const bladeOffset=pull?.43:clamp(Math.max(.43,.665-(heightReach-.04)/Math.max(.15,up.y)),.43,.64);const contactH=new Vector3(clamp(line,-.62,.62),heightReach,pull?8.88:8.55).addScaledVector(up,bladeOffset);
   const back=pull?contactH.clone().add(new Vector3(-.13,.08,.65)):new Vector3(x+.08,loft?1.27:1.15,loft?9.20:9.01),follow=new Vector3(x+(pull?.32:.04),defend?.92:loft?1.46:1.30,defend?8.71:8.65);
   // Independent hand paths and blade rotations, not one speed-scaled generic stroke.
   const keys=defend?[[0,h,restingUp],[.08,contactH.clone().add(new Vector3(0,.04,.13)),up],[.18,contactH,up],[.29,contactH.clone().add(new Vector3(0,.035,-.055)),up],[.52,follow,new Vector3(-.1,1,-.1)]]:
    pull?[[0,h,restingUp],[.10,back,up],[.18,contactH,up],[.29,follow,new Vector3(.7,.25,.65)],[.52,new Vector3(x+.12,1.18,8.94),new Vector3(.3,.9,-.3)]]:
    [[0,h,restingUp],[loft?.14:.115,back,new Vector3(.1,.48,-.87)],[.18,contactH,up],[.30,follow,new Vector3(loft?.40:.2,loft?-.45:.05,.9)],[.52,follow,new Vector3(.2,-.7,.65)]];
   let i=0;while(i<keys.length-2&&phase>(keys[i+1][0] as number))i++;const a=keys[i],b=keys[i+1],u=clamp((phase-(a[0] as number))/((b[0] as number)-(a[0] as number)),0,1);
   const duration=(b[0] as number)-(a[0] as number);
   const tangent=(index:number,component:number)=>{if(index===0||index===keys.length-1)return new Vector3();const current=keys[index],previous=keys[index-1],next=keys[index+1];const incoming=(current[component] as Vector3).clone().sub(previous[component] as Vector3).multiplyScalar(1/((current[0] as number)-(previous[0] as number))),outgoing=(next[component] as Vector3).clone().sub(current[component] as Vector3).multiplyScalar(1/((next[0] as number)-(current[0] as number)));return index===2?incoming:incoming.add(outgoing).multiplyScalar(.5)};
   const cubic=(component:number)=>{const u2=u*u,u3=u2*u;return (a[component] as Vector3).clone().multiplyScalar(2*u3-3*u2+1).addScaledVector(tangent(i,component),duration*(u3-2*u2+u)).addScaledVector(b[component] as Vector3,-2*u3+3*u2).addScaledVector(tangent(i+1,component),duration*(u3-u2))};
   h=cubic(1);up=cubic(2).normalize();normal.lerp(new Vector3(0,0,-1),1-smooth(phase/.08)).addScaledVector(up,-normal.dot(up)).normalize();
   if(phase>.52){const r=smooth((phase-.52)/.3);h.lerp(new Vector3(x+.28,.91,8.87),r);up.lerp(new Vector3(-.1,.98,-.12).normalize(),r).normalize();normal.lerp(new Vector3(0,0,-1),r).addScaledVector(up,-normal.dot(up)).normalize();}
  }
  // Constrain the grip controller before producing the collider. Both wrists must be reachable.
  for(let k=0;k<16;k++){let corrected=0;const floor=.025+.665*Math.max(0,up.y);if(h.y<floor){corrected+=floor-h.y;h.y=floor;}for(const side of ['L','R']){const grip=h.clone().addScaledVector(up,side==='L'?.16:.065),shoulder=this.position('upperarm.'+side),{wrist}=this.wristTarget(side,grip,up),elbow=this.position('forearm.'+side),hand=this.position('hand.'+side),reach=shoulder.distanceTo(elbow)+elbow.distanceTo(hand)-.006,delta=wrist.clone().sub(shoulder),distance=delta.length(),correction=distance>reach?reach-distance:distance<.18?.18-distance:0;if(Math.abs(correction)>.000001){h.addScaledVector(delta.normalize(),correction);corrected+=Math.abs(correction)}}if(corrected<.000001)break;}

  normal.addScaledVector(up,-normal.dot(up)).normalize();const width=up.clone().cross(normal).normalize();
  this.root.updateMatrixWorld(true);const world=new Matrix4().makeBasis(width,up,normal).setPosition(h),local=this.root.matrixWorld.clone().invert().multiply(world);local.decompose(this.batController.position,this.batController.quaternion,this.batController.scale);this.root.updateMatrixWorld(true);
  const L=this.gripNodes.L.getWorldPosition(new Vector3()),R=this.gripNodes.R.getWorldPosition(new Vector3());this.lastErrors={L:this.arm('L',L,up),R:this.arm('R',R,up)};
  return {handle:plain(this.batController.getWorldPosition(new Vector3())),toe:plain(this.batController.localToWorld(new Vector3(0,-.665,0))),up:plain(up),normal:plain(normal),width:plain(width),grips:{L:plain(L),R:plain(R)},errors:{...this.lastErrors}};
 }
 bowling(t:number):Vector3{
  this.reset();const approach=clamp(t/2.13,0,1),stride=clamp((t-2.13)/.52,0,1),after=Math.max(0,t-RELEASE_TIME);this.root.position.set(.04,0,t<=2.13?-25+12.8*approach*approach:-12.2+1.8*stride+Math.min(after,1)*2);this.root.rotation.set(0,0,0);
  if(t<2.13){this.running(t,Math.min(1,approach+.2),false);return this.palm('R')}
  const plant=Math.sin(stride*Math.PI);this.root.position.y=.10*plant;this.rotate('spine',-.12+.25*stride+.25*Math.min(after,.5));this.rotate('chest',0,-.35+.65*stride,0);
  this.leg('L',new Vector3(-.16,.075,-10.72+Math.min(after,1)));this.leg('R',new Vector3(.23,.075,-11.46+stride*.48+Math.min(after,1)*2));
  const shoulder=this.position('upperarm.R'),a=-1.6+stride*1.70+after*5.6,dir=new Vector3(.15,Math.cos(a),Math.sin(a)).normalize(),elbow=shoulder.clone().addScaledVector(dir,.267),wrist=elbow.clone().addScaledVector(dir,.28);
  this.point('upperarm.R','forearm.R',elbow);this.point('forearm.R','hand.R',wrist);const hand=this.bones['hand.R'],q=new Quaternion().setFromUnitVectors(this.palms.R.clone().normalize(),dir);hand.quaternion.copy(hand.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(q));
  this.arm('L',this.position('upperarm.L').add(new Vector3(.10,-.30,.25)),Y);return this.palm('R');
 }
 running(t:number,amp=1,setRoot=true){this.reset();const cycle=t*11;for(const [s,k] of [['L',1],['R',-1]] as const){const hip=this.position('thigh.'+s),z=Math.sin(cycle)*.34*k*amp,foot=hip.clone().setY(.075+Math.max(0,Math.cos(cycle)*k)*.13*amp).add(new Vector3(0,0,z).applyQuaternion(this.root.quaternion));this.chain('thigh.'+s,'shin.'+s,'foot.'+s,foot,new Vector3(0,0,1).applyQuaternion(this.root.quaternion));const footBone=this.bones['foot.'+s];footBone.quaternion.copy(footBone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(this.root.quaternion.clone().multiply(this.bindWorld['foot.'+s])));const shoulder=this.position('upperarm.'+s);this.arm(s,shoulder.add(new Vector3(0,-.33,-z*.8+.12).applyQuaternion(this.root.quaternion)),Y)}this.rotate('spine',.12);if(setRoot)this.root.position.y=Math.abs(Math.sin(cycle))*.025*amp;}
 fielding(state:string,t:number,ball:Vector3){this.reset();const crouch=state==='collect'?1-smooth(t/.62):0;this.root.position.y=-.48*crouch;this.rotate('spine',.12+.55*crouch);const base=this.root.position.clone();for(const side of ['L','R']){const offset=new Vector3(side==='L'?.15:-.15,0,0).applyQuaternion(this.root.quaternion),ankle=base.clone().add(offset).setY(.075);this.leg(side,ankle)}if(state==='collect'||state==='throw'){this.arm('R',ball,Y);this.arm('L',this.position('upperarm.L').add(new Vector3(0,-.38,.10)),Y)}else if(state==='catch'){this.arm('L',ball.clone().add(new Vector3(-.035,0,0)),Y);this.arm('R',ball.clone().add(new Vector3(.035,0,0)),Y)}}
 idle(t:number){this.reset();this.rotate('spine',.055+Math.sin(t*1.8)*.012);for(const s of ['L','R']){const sh=this.position('upperarm.'+s);this.arm(s,sh.add(new Vector3(0,-.49,.07)),Y)}}
}
let batRig:CricketRig|undefined,bowlRig:CricketRig|undefined;
const poseCache=new Map<string,BatPose>();
export function batPose(t:number,shot:Shot,line:number,height:number,aim:number){const key=[Math.round((t<0?-1:t>.82?-1:t)*1e8),shot,line,height,aim].join('/');let pose=poseCache.get(key);if(!pose){pose=(batRig??=new CricketRig()).batting(t,shot,line,height,aim);if(poseCache.size>24)poseCache.delete(poseCache.keys().next().value!);poseCache.set(key,pose)}return pose}
export function bowlingHand(time:number){return plain((bowlRig??=new CricketRig()).bowling(time))}
