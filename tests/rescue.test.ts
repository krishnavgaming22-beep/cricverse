import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {CricketRig,batPose,bowlingHand,RELEASE_TIME} from '../src/game/rig';
import {CricketSim} from '../src/game/simulation';
import {STEP,SWING_CONTACT} from '../src/game/physics';
import type {Shot} from '../src/game/types';
it('audits every frame of all strokes and release continuity',()=>{
 const rows=[];let maximum=0;for(const shot of ['defend','drive','loft','pull'] as Shot[])for(const aim of [-.8,0,.8])for(let t=-.01;t<.83;t+=1/120){const p=batPose(t,shot,.05,shot==='pull'?1.1:.45,aim);maximum=Math.max(maximum,p.errors.L,p.errors.R);rows.push({shot,aim,t,handle:p.handle,grips:p.grips,errors:p.errors})}
 writeFileSync('qa/rescue/grip-audit.json',JSON.stringify({maximum,rows},null,2));expect(maximum).toBeLessThan(.012);
 const s=new CricketSim({mode:'practice'});s.start();while(s.phase==='runup')s.step();expect(s.releasePoint).toEqual(bowlingHand(RELEASE_TIME));
});
it('records deterministic physical contacts for each stroke',()=>{
 const rows=[];for(const shot of ['defend','drive','loft','pull'] as Shot[])for(const aim of [-.5,0,.5]){
  const s=new CricketSim({mode:'practice',practiceLength:shot==='pull'?'short':'good',practiceSpeed:96,overrides:{line:.05,seam:0,swing:0},seed:148});s.recording=false;s.shot=shot;s.aim=aim;s.start();while(s.phase==='runup')s.step();const at=s.flightStart+s.arrival.time-SWING_CONTACT;
  while(s.time<at)s.step();s.swing();for(let i=0;i<40/STEP&&!s.result;i++)s.step();rows.push({shot,aim,arrival:s.arrival,contact:s.lastContact,result:s.result,phase:s.phase,ball:s.ball});
 }
 writeFileSync('qa/rescue/contacts.json',JSON.stringify(rows,null,2));expect(rows.filter(r=>r.result?.contact).length).toBeGreaterThanOrEqual(8);
});
