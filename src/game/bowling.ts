import {Random,clamp,v,type V3} from './math';
import type {Config,Delivery,Result} from './types';
export function chooseDelivery(c:Config,history:Result[],rng:Random):Delivery {
 const recent=history.slice(-6),lofts=recent.filter(r=>r.shot==='loft').length,early=recent.filter(r=>r.timing==='EARLY').length;
 let kind=c.mode!=='match'&&c.practiceLength!=='mixed'?c.practiceLength:rng.pick(['good','good','full','short','yorker','slower'] as const);
 if(c.mode==='match'&&recent.length>2){if(lofts>=3&&rng.next()<.62)kind='short';if(early>=2&&rng.next()<.6)kind='slower';if(recent.reduce((s,r)=>s+r.batRuns,0)>16&&rng.next()<.5)kind=rng.pick(['yorker','short']);}
 let speed=c.mode==='match'?({Rookie:86,Pro:112,Elite:132}[c.difficulty]+rng.range(-6,6)):c.practiceSpeed;
 if(kind==='slower')speed*=.78;
 let line=rng.range(-.27,.35),noBall=false;
 if(c.mode==='match'&&rng.next()<.025)line=rng.pick([-1.2,1.2]);
 if(c.mode==='match'&&rng.next()<.018)noBall=true;
 return {kind,speed,line,swing:rng.range(-.5,.5)*(c.difficulty==='Elite'?1.3:.65),seam:rng.range(-.3,.3),noBall,bounce:.66,friction:.95,...c.overrides};
}
export const RELEASE=v(.35,2.22,-10.4);
export function releaseVelocity(d:Delivery):V3{
 const bounceZ={full:6.0,good:3.5,short:-.2,yorker:8.0,slower:3.5}[d.kind];
 const speed=d.speed/3.6;const t=(bounceZ-RELEASE.z)/speed;
 const vy=(.036-RELEASE.y+4.905*t*t)/t;
 const fullFlight=(8.55-RELEASE.z)/speed;
 return v((d.line-RELEASE.x)/fullFlight-d.swing*fullFlight*.5,vy,speed);
}
export const bowlingStrategy=(history:Result[])=>{const r=history.slice(-6);if(r.filter(x=>x.shot==='loft').length>=3)return 'Testing the short ball after repeated lofted strokes';if(r.filter(x=>x.timing==='EARLY').length>=2)return 'Changing pace after early swings';if(r.reduce((a,b)=>a+b.batRuns,0)>16)return 'Protecting the boundary with yorkers and shorter lengths';return 'Mixing line, length and pace'};
