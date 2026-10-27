import type {BatPose} from './rig';
import type {V3} from './math';
export type Shot='defend'|'drive'|'loft'|'pull';
export type Difficulty='Rookie'|'Pro'|'Elite';
export type Length='good'|'full'|'short'|'yorker'|'slower';
export type Mode='match'|'practice'|'lab';
export type Phase='ready'|'runup'|'flight'|'inplay'|'return'|'result'|'finished';
export type Timing='PERFECT'|'GOOD'|'EARLY'|'LATE'|'MISSED';
export type Wicket='bowled'|'caught'|'run out';
export interface Delivery {kind:Length;speed:number;line:number;swing:number;seam:number;noBall:boolean;bounce:number;friction:number;}
export interface Ball {p:V3;v:V3;live:boolean;hit:boolean;bounced:boolean;bounces:number;groundedAfterHit:boolean;}
export interface Result {runs:number;batRuns:number;extras:number;legal:boolean;wicket?:Wicket;boundary:0|4|6;timing:Timing;quality:number;delivery:Delivery;shot:Shot;aim:number;landing:V3;contact:boolean;}
export interface Score {runs:number;wickets:number;balls:number;extras:number;fours:number;sixes:number;history:Result[];best:number;}
export interface Config {mode:Mode;overs:1|2|5;difficulty:Difficulty;seed:number;target?:number;practiceSpeed:number;practiceLength:Length|'mixed';assistance:boolean;overrides?:Partial<Delivery>;}
export interface Fielder {id:number;home:V3;p:V3;velocity:V3;stateTime:number;state:'idle'|'chase'|'collect'|'catch'|'throw'|'return';}
export interface Frame {time:number;phase:Phase;phaseTime:number;ball:V3;ballLive:boolean;bowlerZ:number;swing:number;shot:Shot;aim:number;batHandle:V3;batToe:V3;batPose:BatPose;batLine:number;batHeight:number;run:number;fielders:V3[];fielderStates:Fielder['state'][];fielderTimes:number[];running:boolean;runEnd:number;wicket:boolean;}
export interface SimEvent {id:number;type:'release'|'bounce'|'contact'|'result'|'run'|'footstep';quality?:number;result?:Result;}
export const SHOTS:Shot[]=['defend','drive','loft','pull'];
export const SHOT_LABELS:Record<Shot,string>={defend:'DEFENSIVE',drive:'GROUND DRIVE',loft:'LOFTED DRIVE',pull:'PULL / CUT'};
export const LENGTH_LABELS:Record<Length,string>={good:'Good length',full:'Full length',short:'Short ball',yorker:'Yorker',slower:'Slower ball'};
export const DEFAULT_CONFIG:Config={mode:'match',overs:2,difficulty:'Rookie',seed:148,practiceSpeed:96,practiceLength:'mixed',assistance:true};
