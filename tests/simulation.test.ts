import {describe,it,expect} from 'vitest';
import {CricketSim} from '../src/game/simulation';
import {applyResult,emptyScore,oversLabel,boundaryRuns,matchStatus} from '../src/game/rules';
import {STEP,SWING_CONTACT,integrateBall,batContact,batPose} from '../src/game/physics';
import {DEFAULT_CONFIG,type Result} from '../src/game/types';
import {runLab,DEFAULT_LAB} from '../src/game/lab';
import {bowlingHand,RELEASE_TIME} from '../src/game/rig';
import {v} from '../src/game/math';
const result=(patch:Partial<Result>={}):Result=>({runs:0,batRuns:0,extras:0,legal:true,boundary:0,timing:'MISSED',quality:0,delivery:{kind:'good',speed:100,line:0,swing:0,seam:0,bounce:.66,friction:.95,noBall:false},shot:'drive',aim:0,landing:v(),contact:false,...patch});
function until(s:CricketSim,p:()=>boolean,max=35){for(let i=0;i<max/STEP&&!p();i++)s.step();expect(p()).toBe(true)}
function hit(shot:'drive'|'loft'|'pull'|'defend',timing=0,line=.05){let s=new CricketSim({mode:'practice',seed:2,practiceSpeed:96,practiceLength:shot==='pull'?'short':'good',overrides:{line,swing:0,seam:0}});s.shot=shot;s.aim=.3;s.start();until(s,()=>s.phase==='flight');let at=s.flightStart+s.arrival.time-SWING_CONTACT+timing;until(s,()=>s.time>=at);s.swing();until(s,()=>s.score.history.length===1);return s;}
describe('cricket rules',()=>{
 it('counts six legal balls as an over',()=>{let s=emptyScore();for(let i=0;i<5;i++)s=applyResult(s,result());expect(oversLabel(s.balls)).toBe('0.5');s=applyResult(s,result());expect(oversLabel(s.balls)).toBe('1.0')});
 it('does not consume wides or no-balls',()=>{let s=applyResult(emptyScore(),result({legal:false,runs:1,extras:1}));s=applyResult(s,result({legal:false,runs:5,batRuns:4,extras:1,boundary:4}));expect(s.balls).toBe(0);expect(s.runs).toBe(6);expect(s.extras).toBe(2)});
 it('distinguishes a grounded four from a six on the full',()=>{expect(boundaryRuns(true)).toBe(4);expect(boundaryRuns(false)).toBe(6)});
 it('ends on target, overs or three wickets; practice remains open',()=>{expect(matchStatus({...emptyScore(),runs:12},DEFAULT_CONFIG,12)).toBe('won');expect(matchStatus({...emptyScore(),balls:12},DEFAULT_CONFIG,12)).toBe('lost');expect(matchStatus({...emptyScore(),wickets:3},DEFAULT_CONFIG,12)).toBe('lost');expect(matchStatus({...emptyScore(),balls:200,wickets:99},{...DEFAULT_CONFIG,mode:'practice'},12)).toBe('playing')});
});
describe('shared real-time simulation',()=>{
 it('launches and releases from the bowler hand position',()=>{const s=new CricketSim();s.start();until(s,()=>s.phase==='flight');expect(s.ball.p).toEqual(bowlingHand(RELEASE_TIME));expect(s.ball.p.y).toBeGreaterThan(1.95)});
 it('physically misses into the wicket',()=>{const s=new CricketSim({mode:'practice',practiceLength:'yorker',overrides:{line:0,swing:0,seam:0}});s.start();until(s,()=>!!s.result);expect(s.result?.wicket).toBe('bowled');expect(s.wicketDown).toBe(true)});
 it('makes actual contact with distinct trajectories and timing outcomes',()=>{const drive=hit('drive'),loft=hit('loft'),early=hit('drive',-.16);expect(drive.result?.contact).toBe(true);expect(loft.result?.contact).toBe(true);expect(drive.result?.quality).toBeGreaterThan(.6);expect(drive.lastContact?.along).toBeLessThan(-.25);expect(early.result?.quality).toBeLessThan(drive.result!.quality);expect(loft.result?.landing).not.toEqual(drive.result?.landing)});
 it('collides with a swept fast-moving ball',()=>{const b=batPose(.18,'drive',0,.4,0);expect(batContact(v(0,.4,7.8),v(0,.4,9.2),b,b,.036)).toBeTruthy()});
 it('applies gravity and ground bounce without penetrating the pitch',()=>{const s=new CricketSim();s.ball={p:v(0,.05,0),v:v(0,-12,10),live:true,hit:false,bounced:false,bounces:0,groundedAfterHit:false};integrateBall(s.ball,s.delivery,.02);expect(s.ball.p.y).toBe(.036);expect(s.ball.v.y).toBeGreaterThan(0)});
 it('resolves physical crossings for four and six',()=>{for(const ground of [true,false]){const s=new CricketSim();s.phase='inplay';s.ball={p:v(64.79,ground?.036:5,0),v:v(10,0,0),live:true,hit:true,bounced:ground,bounces:0,groundedAfterHit:ground};s.step();expect(s.result?.boundary).toBe(ground?4:6)}});
 it('awards a completed run and detects an unsafe run-out',()=>{const s=new CricketSim();s.phase='inplay';s.ball.hit=true;s.ball.live=true;s.ball.p=v(40,.036,0);s.ball.v=v();s.fielders.forEach(f=>f.p=v(-50,0,-40));expect(s.run()).toBe(true);until(s,()=>s.runs===1,4);expect(s.runs).toBe(1);s.run();s.fielders[0].p={...s.ball.p,y:0};s.beginReturn(s.fielders[0]);until(s,()=>!!s.result,4);expect(s.result?.wicket).toBe('run out');expect(s.score.runs).toBe(1)});
 it('registers a reachable catch, but not on a no-ball',()=>{for(const free of [false,true]){const s=new CricketSim();s.phase='inplay';s.phaseTime=.5;s.protectedBall=free;s.ball={p:v(-8,1.3,14),v:v(0,-1,0),live:true,hit:true,bounced:true,bounces:1,groundedAfterHit:false};s.field(0);expect(s.result?.wicket).toBe(free?undefined:'caught')}});
 it('pauses all simulation and restarts cleanly',()=>{const s=new CricketSim();s.start();s.paused=true;s.advance(.1);expect(s.time).toBe(0);expect(s.phaseTime).toBe(0);const restarted=new CricketSim(s.config);expect(restarted.score).toEqual(emptyScore());expect(restarted.phase).toBe('ready')});
 it('keeps score equal to its delivery ledger',()=>{const data=runLab({...DEFAULT_LAB,count:20});let score=emptyScore();data.forEach(r=>score=applyResult(score,r));expect(score.runs).toBe(data.reduce((s,r)=>s+r.runs,0));expect(score.balls).toBe(data.filter(r=>r.legal).length)});
 it('runs reproducible batches through the same engine',()=>{const a=runLab({...DEFAULT_LAB,count:10}),b=runLab({...DEFAULT_LAB,count:10});expect(a).toHaveLength(10);expect(a).toEqual(b);expect(a.some(r=>r.contact)).toBe(true);expect(a.some(r=>r.boundary!==6)).toBe(true)});
});
