import {CricketSim} from './simulation';
import {Random,clamp} from './math';
import {STEP,SWING_CONTACT} from './physics';
import type {Config,Delivery,Result,Shot} from './types';
export interface LabConfig {count:number;seed:number;skill:number;timing:number;shot:Shot|'auto';aim:number;difficulty:Config['difficulty'];delivery:Partial<Delivery>;}
export const DEFAULT_LAB:LabConfig={count:50,seed:148,skill:.8,timing:0,shot:'auto',aim:0,difficulty:'Pro',delivery:{speed:105,kind:'good',line:.08,swing:.1,seam:.1,bounce:.66,friction:.95}};
/** The autonomous batter observes predicted arrival and executes normal swing/run inputs.
 * No score shortcuts: every delivery runs the live fixed-step physics, CCD, fielding and rules.
 */
export function runLab(config:LabConfig):Result[]{
 const sim=new CricketSim({mode:'lab',seed:config.seed,difficulty:config.difficulty,practiceLength:config.delivery.kind??'good',practiceSpeed:config.delivery.speed??105,overrides:config.delivery});
 sim.recording=false;sim.resultHold=0;sim.start();const rng=new Random(config.seed+999);let last=-1;let swingTime=Infinity;
 const maxTicks=config.count*35/STEP;let ticks=0;
 while(sim.score.history.length<config.count&&ticks++<maxTicks){
  if(sim.phase==='runup'&&last!==sim.score.history.length){
   last=sim.score.history.length;
   sim.shot=config.shot==='auto'?(sim.arrival.point.y>1?'pull':rng.pick(['drive','drive','loft','defend'] as const)):config.shot;
   sim.aim=clamp(config.aim+rng.range(-.22,.22)*(1-config.skill),-1,1);
   swingTime=sim.time+(2.65-sim.phaseTime)+sim.arrival.time-SWING_CONTACT+config.timing+rng.range(-.24,.24)*(1-config.skill);
  }
  if(sim.phase==='flight'&&sim.time>=swingTime&&sim.swingAt<0)sim.swing();
  if(sim.phase==='inplay'&&!sim.running&&sim.runSafety==='SAFE TO RUN')sim.run();
  sim.step();
 }
 return sim.score.history.slice(0,config.count);
}
export function metrics(data:Result[]){const n=data.length||1;return {deliveries:data.length,runRate:data.reduce((s,r)=>s+r.runs,0)/Math.max(1,data.filter(r=>r.legal).length),dots:100*data.filter(r=>r.runs===0&&!r.wicket).length/n,boundaries:100*data.filter(r=>r.boundary).length/n,wickets:100*data.filter(r=>r.wicket).length/n,contacts:100*data.filter(r=>r.contact).length/n,quality:data.filter(r=>r.contact).reduce((s,r)=>s+r.quality,0)/Math.max(1,data.filter(r=>r.contact).length)};}
