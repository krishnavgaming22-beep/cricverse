import {add,clamp,dot,len,mix,mul,norm,segmentDistance,sub,v,type V3} from './math';
import type {Ball,Delivery} from './types';
export const STEP=1/240, BALL_RADIUS=.036, CONTACT_Z=8.55, SWING_CONTACT=.18;
export const AIR_DRAG=.0038;
/** One aerodynamic model applies before and after contact, and during returns. */
export function integrateAir(ball:Ball,delivery:Delivery,dt:number){
 const speed=len(ball.v);ball.v.x+=(!ball.hit?delivery.swing:0)*dt;ball.v.y-=9.81*dt;
 const factor=Math.max(0,1-AIR_DRAG*speed*dt);ball.v.x*=factor;ball.v.y*=factor;ball.v.z*=factor;
 ball.p=add(ball.p,mul(ball.v,dt));
}
export function integrateBall(ball:Ball,delivery:Delivery,dt:number):boolean{
 if(!ball.live)return false;integrateAir(ball,delivery,dt);
 let bounce=false;
 if(ball.p.y<BALL_RADIUS){
  ball.p.y=BALL_RADIUS;
  if(ball.v.y<-.5){ball.v.y=-ball.v.y*(ball.hit?.46:delivery.bounce);const retention=ball.hit?.88:.93;ball.v.z*=retention;ball.v.x*=retention;if(!ball.hit)ball.v.x+=delivery.seam;ball.bounces++;bounce=true;}else ball.v.y=0;
  ball.bounced=true;if(ball.hit)ball.groundedAfterHit=true;
  const horizontal=Math.hypot(ball.v.x,ball.v.z),loss=delivery.friction*2.6*dt;
  if(horizontal>0){const scale=Math.max(0,horizontal-loss)/horizontal;ball.v.x*=scale;ball.v.z*=scale;}
 }
 return bounce;
}
export function predictArrival(ball:Ball,d:Delivery):{time:number;point:V3}{
 const b:Ball={...ball,p:{...ball.p},v:{...ball.v}};let t=0;
 while(b.p.z<CONTACT_Z&&t<3){const previous={...b.p};integrateBall(b,d,STEP);t+=STEP;if(b.p.z>=CONTACT_Z){const fraction=(CONTACT_Z-previous.z)/(b.p.z-previous.z);return {time:t-STEP+fraction*STEP,point:mix(previous,b.p,fraction)}}}
 return {time:t,point:{...b.p}};
}

export {batPose} from './rig';
import type {BatPose} from './rig';
export type {BatPose} from './rig';
export interface Contact {point:V3;normal:V3;surfaceVelocity:V3;along:number;across:number;fraction:number;quality:number;outgoing?:V3;}
const surface=(p:BatPose,x:number,y:number,z:number)=>add(p.handle,add(mul(p.width,x),add(mul(p.up,y),mul(p.normal,z))));
/** Swept sphere against the moving oriented blade. Face and edges share the visible mesh basis. */
export function batContact(prev:V3,current:V3,oldBat:BatPose,newBat:BatPose,radius=BALL_RADIUS,dt=STEP):Contact|null{
 const travel=len(sub(current,prev))+len(sub(newBat.toe,oldBat.toe));const samples=Math.max(4,Math.ceil(travel/.018));
 for(let i=0;i<=samples;i++){
  const f=i/samples,h=mix(oldBat.handle,newBat.handle,f),up=norm(mix(oldBat.up,newBat.up,f)),rawNormal=norm(mix(oldBat.normal,newBat.normal,f)),normal=norm(sub(rawNormal,mul(up,dot(rawNormal,up)))),width=norm(v(up.y*normal.z-up.z*normal.y,up.z*normal.x-up.x*normal.z,up.x*normal.y-up.y*normal.x));
  const p=mix(prev,current,f),rel=sub(p,h),x=dot(rel,width),y=dot(rel,up),z=dot(rel,normal),cx=clamp(x,-.055,.055),cy=clamp(y,-.665,-.13),cz=clamp(z,-.023,.023);
  const closest=add(h,add(mul(width,cx),add(mul(up,cy),mul(normal,cz)))),delta=sub(p,closest);
  if(len(delta)<=radius){
   const n=len(delta)>.001?norm(delta):mul(normal,z>=0?1:-1),velocity=mul(sub(surface(newBat,cx,cy,cz),surface(oldBat,cx,cy,cz)),1/dt);
   const quality=clamp(1-Math.abs(cy+.43)/.34-Math.abs(cx)/.12,.08,1);
   return {point:closest,normal:n,surfaceVelocity:velocity,along:cy,across:cx,fraction:f,quality};
  }
 }
 return null;
}
/** Finite-mass collision impulse at the measured moving surface, including tangential friction. */
export function contactImpulse(ball:Ball,contact:Contact,soft=false):V3{
 const relative=sub(ball.v,contact.surfaceVelocity),vn=dot(relative,contact.normal);
 if(vn>=0)return {...ball.v};
 const centered=clamp(contact.quality,0,1),effectiveMass=(soft?.75:.95)*(.65+.35*centered),ballMass=.156,restitution=(soft?.24:.52)*(.65+.35*centered);
 const j=-(1+restitution)*vn/(1/ballMass+1/effectiveMass);
 const tangent=sub(relative,mul(contact.normal,vn)),tangentSpeed=len(tangent),friction=Math.min(tangentSpeed*ballMass,.12*j);
 return add(ball.v,add(mul(contact.normal,j/ballMass),mul(norm(tangent),-friction/ballMass)));
}

/** Three regulation stump cylinders and two bails, swept against the ball centre. */
export function hitsWicket(previous:V3,current:V3,z=10.06){
 for(const x of [-.114,0,.114])if(segmentDistance(previous,current,v(x,0,z),v(x,.711,z))<=BALL_RADIUS+.019)return true;
 return segmentDistance(previous,current,v(-.112,.724,z),v(.112,.724,z))<=BALL_RADIUS+.011;
}
