import type {Config,Result,Score} from './types';
export const oversLabel=(balls:number)=>`${Math.floor(balls/6)}.${balls%6}`;
export const emptyScore=():Score=>({runs:0,wickets:0,balls:0,extras:0,fours:0,sixes:0,history:[],best:0});
export function applyResult(score:Score,result:Result):Score {
 return {...score,runs:score.runs+result.runs,wickets:score.wickets+(result.wicket?1:0),balls:score.balls+(result.legal?1:0),extras:score.extras+result.extras,fours:score.fours+(result.boundary===4?1:0),sixes:score.sixes+(result.boundary===6?1:0),best:Math.max(score.best,result.batRuns),history:[...score.history,result]};
}
export function matchStatus(s:Score,c:Config,target:number):'won'|'lost'|'playing'{
 if(c.mode!=='match')return 'playing';if(s.runs>=target)return 'won';if(s.balls>=c.overs*6||s.wickets>=3)return 'lost';return 'playing';
}
export function resultLabel(r:Result){return r.wicket?'W':!r.legal?(r.delivery.noBall?`${r.runs}nb`:`${r.runs}wd`):`${r.runs}`}
/** The rope follows the same 64.8 × 58.97 m ellipse authored in Blender. */
export const isBoundary=(x:number,z:number)=>(x*x/(64.8**2)+z*z/((64.8*.91)**2))>=1;
export const boundaryRuns=(grounded:boolean):4|6=>grounded?4:6;

/** Retain illegal deliveries in the displayed over without advancing its six-ball index. */
export function currentOver(history:Result[]):Result[]{
 const legal=history.filter(r=>r.legal).length;
 const completed=legal>0&&legal%6===0&&history.at(-1)?.legal;
 const start=Math.floor(legal/6)*6-(completed?6:0);
 let seen=0;return history.filter(r=>{const include=seen>=start;if(r.legal)seen++;return include});
}
