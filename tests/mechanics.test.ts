import {it,expect} from 'vitest';
import {CricketRig,batPose,bowlingHand,RELEASE_TIME} from '../src/game/rig';
import {STEP,batContact,contactImpulse,integrateBall,hitsWicket} from '../src/game/physics';
import {CricketSim} from '../src/game/simulation';
import {len,sub,v} from '../src/game/math';
import {writeFileSync} from 'node:fs';
import type {Shot,Length,Ball} from '../src/game/types';
it('keeps two-handed grips and blade above the pitch across reachable delivery heights',()=>{
 let worst=0,lowest=1;
 for(const shot of ['defend','drive','loft','pull'] as Shot[])for(const line of [-.3,.3])for(const height of [.1,.4,.8,1.2])for(const aim of [-.8,0,.8])for(let i=0;i<=50;i++){
  const p=batPose(i*.82/50,shot,line,height,aim);worst=Math.max(worst,p.errors.L,p.errors.R);lowest=Math.min(lowest,p.toe.y);expect(Number.isFinite(p.normal.x)).toBe(true);
 }
 writeFileSync('qa/rescue/reach-envelope.json',JSON.stringify({worstGripErrorMetres:worst,minimumToeHeightMetres:lowest,samples:4*2*4*3*51},null,2));expect(worst).toBeLessThan(.012);expect(lowest).toBeGreaterThan(.015);
});
it('has continuous start and contact motion, including the horizontal pull',()=>{
 for(const shot of ['defend','drive','loft','pull'] as Shot[]){const rest=batPose(-.001,shot,0,.7,0),start=batPose(0,shot,0,.7,0);expect(len(sub(rest.toe,start.toe))).toBeLessThan(.001);
  const before=batPose(.18-.0001,shot,0,.7,0),at=batPose(.18,shot,0,.7,0),after=batPose(.18+.0001,shot,0,.7,0);const incoming=sub(at.toe,before.toe),outgoing=sub(after.toe,at.toe);expect(len(sub(incoming,outgoing))/.0001).toBeLessThan(2);
 }
});
it('uses actual moving-surface impulses and leaves misses untouched',()=>{
 const ball:Ball={p:v(0,.5,8.55),v:v(0,0,30),live:true,hit:false,bounced:false,bounces:0,groundedAfterHit:false};const pose=batPose(.18,'drive',0,.5,0);const contact=batContact(v(0,.5,8),v(0,.5,9),pose,pose)!;expect(contact).toBeTruthy();const outgoing=contactImpulse(ball,contact);expect(outgoing.z).toBeLessThan(0);expect(len(outgoing)).toBeLessThan(len(ball.v));expect(batContact(v(2,.5,8),v(2,.5,9),pose,pose)).toBeNull();
 const faster=contactImpulse(ball,{...contact,surfaceVelocity:v(0,0,-10)});expect(faster.z).toBeLessThan(outgoing.z);
});
it('keeps ground response symmetric and wickets at their physical cylinders',()=>{
 const s=new CricketSim(),a:Ball={...s.ball,p:v(0,.04,0),v:v(8,-4,12),live:true,hit:true},b:Ball={...a,p:v(0,.04,0),v:v(12,-4,8)};integrateBall(a,s.delivery,STEP);integrateBall(b,s.delivery,STEP);expect(a.v.x).toBeCloseTo(b.v.z,8);expect(a.v.z).toBeCloseTo(b.v.x,8);expect(hitsWicket(v(0,.4,9.8),v(0,.4,10.3))).toBe(true);expect(hitsWicket(v(.3,.4,9.8),v(.3,.4,10.3))).toBe(false);
});
it('solves different real bounce zones and releases at the hand',()=>{
 const rows=[];for(const kind of ['yorker','full','good','short','slower'] as Length[]){const s=new CricketSim({mode:'practice',practiceLength:kind,practiceSpeed:100,overrides:{swing:0,seam:0,line:0}});s.recording=false;s.start();while(s.phase==='runup')s.step();expect(s.ball.p).toEqual(bowlingHand(RELEASE_TIME));while(!s.ball.bounced&&s.phase==='flight')s.step();rows.push({kind,bounceZ:s.ball.p.z});}
 writeFileSync('qa/rescue/delivery-lengths.json',JSON.stringify(rows,null,2));expect(rows[0].bounceZ).toBeGreaterThan(rows[1].bounceZ+1.5);expect(rows[1].bounceZ).toBeGreaterThan(rows[2].bounceZ+1.5);expect(rows[2].bounceZ).toBeGreaterThan(rows[3].bounceZ+2);
});
it('keeps character placement through idle and running resets',()=>{const r=new CricketRig();r.root.position.set(20,0,-30);r.idle(1);expect(r.root.position.x).toBe(20);r.running(2);expect(r.root.position.z).toBe(-30)});
