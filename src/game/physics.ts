import {clamp,len,mix,mul,norm,segmentDistance,v,type V3} from './math';
import type {Ball,Delivery,Shot} from './types';
export const STEP=1/240, BALL_RADIUS=.036, CONTACT_Z=8.55, SWING_CONTACT=.18;
export function integrateBall(ball:Ball,delivery:Delivery,dt:number):boolean{
 if(!ball.live)return false;
 const speed=len(ball.v),drag=ball.hit?.0038:.0013;
 ball.v.x+=(!ball.hit?delivery.swing:0)*dt;ball.v.y-=9.81*dt;
 const factor=Math.max(0,1-drag*speed*dt);ball.v.x*=factor;ball.v.y*=factor;ball.v.z*=factor;
 ball.p.x+=ball.v.x*dt;ball.p.y+=ball.v.y*dt;ball.p.z+=ball.v.z*dt;
 let bounce=false;
 if(ball.p.y<BALL_RADIUS){
  ball.p.y=BALL_RADIUS;
  if(ball.v.y<-.5){ball.v.y=-ball.v.y*(ball.hit?.46:delivery.bounce);ball.v.z*=ball.hit?.86:.93;ball.v.x*=.9;if(!ball.hit)ball.v.x+=delivery.seam;ball.bounces++;bounce=true;}else ball.v.y=0;
  ball.bounced=true;if(ball.hit)ball.groundedAfterHit=true;
  const horizontal=Math.hypot(ball.v.x,ball.v.z),loss=delivery.friction*2.6*dt;
  if(horizontal>0){const scale=Math.max(0,horizontal-loss)/horizontal;ball.v.x*=scale;ball.v.z*=scale;}
 }
 return bounce;
}
export function predictArrival(ball:Ball,d:Delivery):{time:number;point:V3}{
 const b:Ball={...ball,p:{...ball.p},v:{...ball.v}};let t=0;
 while(b.p.z<CONTACT_Z&&t<3){integrateBall(b,d,STEP);t+=STEP}
 return {time:t,point:{...b.p}};
}
export interface BatPose {handle:V3;toe:V3;}
const exactBlade=(handle:V3,toe:V3):BatPose=>({handle,toe:{x:handle.x+(toe.x-handle.x)*(.665/len({x:toe.x-handle.x,y:toe.y-handle.y,z:toe.z-handle.z})),y:handle.y+(toe.y-handle.y)*(.665/len({x:toe.x-handle.x,y:toe.y-handle.y,z:toe.z-handle.z})),z:handle.z+(toe.z-handle.z)*(.665/len({x:toe.x-handle.x,y:toe.y-handle.y,z:toe.z-handle.z}))}});
/** Shared authored blade endpoints used by the renderer and swept collider. */
export function batPose(elapsed:number,shot:Shot,line:number,height:number,aim:number):BatPose{
 if(elapsed<0||elapsed>.8)return exactBlade(v(-.35,1.07,8.88),v(-.55,.39,9.01));
 const t=clamp(elapsed/.36,0,1),a=(t-.5)*Math.PI*1.35;
 const reach=clamp(line,-.65,.65),h=clamp(height,shot==='pull'?.85:.12,shot==='pull'?1.48:.92);
 const lift=shot==='loft'?.9:shot==='defend'?.18:shot==='pull'?.12:.55;
 const z=CONTACT_Z-Math.sin(a)*.82;
 const x=reach+Math.sin(a)*(.18+Math.abs(aim)*.1);
 let handle=v(x,h+.49+Math.max(0,Math.sin(a))*lift,z+.10),toe=v(x-.03,h-.16+Math.max(0,Math.sin(a))*lift,z-.04);
 if(shot==='pull'){handle=v(x-.38,h+.12,z+.10);toe=v(x+.29,h-.03,z-.04);}
 if(elapsed>.36){const k=clamp((elapsed-.36)/.44,0,1);handle=mix(handle,v(-.35,1.07,8.88),k);toe=mix(toe,v(-.55,.39,9.01),k)}
 return exactBlade(handle,toe);
}
export function batContact(prev:V3,current:V3,oldBat:BatPose,newBat:BatPose,radius:number):boolean{
 // Sample the moving blade across each fixed step, and sweep the ball segment.
 for(let i=0;i<=3;i++){let t=i/3;const h=mix(oldBat.handle,newBat.handle,t),toe=mix(oldBat.toe,newBat.toe,t);const shoulder=mix(h,toe,.20);if(segmentDistance(prev,current,shoulder,toe)<radius+.055)return true;}
 return false;
}
export function contactImpulse(ball:Ball,shot:Shot,aim:number,quality:number,height:number,late:number):V3{
 const suitability=shot==='pull'?(height>.78?1:.5):shot==='loft'?(height<.3?.78:height<.8?1:height<1.05?.86:.58):shot==='drive'?(height<.95?1:.65):1;
 const incoming=len(ball.v),power={defend:5.6,drive:31.5,loft:29.5,pull:32.5}[shot];
 const speed=(power+incoming*.13)*(.42+quality*.58)*suitability;
 const spread=late*(1-quality)*.75;
 const angle=aim*1.12+spread+(shot==='pull'?.66:0);
 const elev=shot==='loft'?.67+(1-quality)*.18:shot==='pull'?.16+(1-quality)*.55:shot==='drive'?.022+(1-quality)*.26:.12;
 return v(Math.sin(angle)*Math.cos(elev)*speed,Math.sin(elev)*speed,-Math.cos(angle)*Math.cos(elev)*speed);
}
