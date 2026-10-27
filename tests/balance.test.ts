import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {runLab,metrics,DEFAULT_LAB} from '../src/game/lab';
import {currentOver,emptyScore,applyResult} from '../src/game/rules';
import {CricketSim} from '../src/game/simulation';
import {STEP} from '../src/game/physics';
import type {Shot,Length} from '../src/game/types';
it('measures skill/shot outcomes over seeded physics batches',()=>{
 const rows=[];
 for(const shot of ['defend','drive','loft','pull'] as Shot[]){
  for(const skill of [.25,.8,1]){const results=runLab({...DEFAULT_LAB,count:100,shot,skill,aim:.35,delivery:{...DEFAULT_LAB.delivery,kind:shot==='pull'?'short':'good'}});rows.push({shot,skill,...metrics(results),sixes:results.filter(r=>r.boundary===6).length,fours:results.filter(r=>r.boundary===4).length});expect(results).toHaveLength(100);expect(results.every(r=>Number.isFinite(r.landing.x)&&Number.isFinite(r.landing.y)&&Number.isFinite(r.landing.z))).toBe(true);}
 }
 expect(rows.find(x=>x.shot==='drive'&&x.skill===1)!.quality).toBeGreaterThan(rows.find(x=>x.shot==='drive'&&x.skill===.25)!.quality);
 expect(rows.some(x=>x.sixes>0)).toBe(true);expect(rows.filter(x=>x.shot==='loft').some(x=>x.sixes<100)).toBe(true);
 writeFileSync('qa/balance-report.json',JSON.stringify(rows,null,2));
},120000);
it('keeps wides in their over and starts a new over after the seventh legal ball',()=>{
 const data=runLab({...DEFAULT_LAB,count:8});const history=[...data.slice(0,5),{...data[5],legal:false},data[5]];
 expect(currentOver(history)).toHaveLength(7);expect(currentOver([...history,data[6]])).toHaveLength(1);
});
it('runs legal and illegal deliveries through actual flight logic',()=>{
 for(const [line,noBall,legal,extra] of [[1.2,false,false,1],[0,true,false,1],[.4,false,true,0]] as const){const s=new CricketSim({mode:'practice',practiceLength:'yorker',overrides:{line,noBall,swing:0,seam:0}});s.start();for(let i=0;i<12/STEP&&!s.result;i++)s.step();expect(s.result?.legal).toBe(legal);expect(s.result?.extras).toBe(extra);if(noBall)expect(s.result?.wicket).toBeUndefined();}
});
it('records the exact physical ball state for replay',()=>{const s=new CricketSim({mode:'practice'});s.start();for(let i=0;i<20/STEP&&!s.result;i++)s.step();expect(s.lastReplay.length).toBeGreaterThan(100);expect(s.lastReplay.at(-1)?.ball).toEqual(s.ball.p);expect(s.lastReplay.some(f=>f.phase==='flight'&&f.ballLive)).toBe(true)});
it('does not credit completed crossings when the striker is caught',()=>{const s=new CricketSim();s.phase='inplay';s.ball.hit=true;s.runs=2;s.resolve(0,'caught');expect(s.score.runs).toBe(0);expect(s.score.wickets).toBe(1)});
it('ends the chase as soon as the winning run completes',()=>{const s=new CricketSim({target:1});s.phase='inplay';s.ball.hit=true;s.ball.live=true;s.ball.p={x:40,y:.036,z:0};s.fielders.forEach(f=>f.p={x:-50,y:0,z:-40});s.run();for(let i=0;i<4/STEP&&!s.result;i++)s.step();expect(s.result?.runs).toBe(1);expect(s.phase).toBe('result')});
it('starts a fresh over when its first delivery is a wide',()=>{const history=runLab({...DEFAULT_LAB,count:6});expect(currentOver([...history,{...history[0],legal:false}])).toHaveLength(1)});
