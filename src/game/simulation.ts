import {add,clamp,len,mix,mul,norm,Random,sub,v,type V3} from './math';
import {chooseDelivery,RELEASE,releaseVelocity} from './bowling';
import {batContact,batPose,BALL_RADIUS,CONTACT_Z,contactImpulse,integrateBall,predictArrival,STEP,SWING_CONTACT} from './physics';
import {applyResult,boundaryRuns,emptyScore,isBoundary,matchStatus} from './rules';
import {DEFAULT_CONFIG,type Ball,type Config,type Delivery,type Fielder,type Frame,type Phase,type Result,type Score,type Shot,type SimEvent,type Timing,type Wicket} from './types';
const FIELD=[[-8,14],[14,10],[-17,-5],[19,-15],[-33,15],[34,6],[-27,-36],[30,-36],[0,-45]];
export class CricketSim {
 config:Config; rng:Random;score:Score=emptyScore();target=0;phase:Phase='ready';phaseTime=0;time=0;paused=false;
 ball:Ball={p:{...RELEASE},v:v(),live:false,hit:false,bounced:false,bounces:0,groundedAfterHit:false};
 fielders:Fielder[]=FIELD.map(([x,z],id)=>({id,home:v(x,0,z),p:v(x,0,z),state:'idle'}));
 delivery:Delivery;shot:Shot='drive';aim=0;swingAt=-10;swingShot:Shot='drive';swingAim=0;contactQuality=0;timing:Timing='MISSED';arrival={time:0,point:v(0,.5,CONTACT_Z)};flightStart=0;
 runs=0;running=false;runProgress=0;runEnd=0;result:Result|null=null;resultHold=2.6;returnTarget=v(0,.72,10.06);throwStart=v();throwDuration=0;thrower=-1;wicketDown=false;
 replay:Frame[]=[];lastReplay:Frame[]=[];events:SimEvent[]=[];eventId=0;accumulator=0;recording=true;freeHit=false;protectedBall=false;private frameTick=0;private footstep=0;
 constructor(config:Partial<Config>={}){this.config={...DEFAULT_CONFIG,...config};this.rng=new Random(this.config.seed);this.delivery=chooseDelivery(this.config,[],this.rng);this.target=this.config.target??Math.round(this.config.overs*({Rookie:7,Pro:10,Elite:13}[this.config.difficulty])+this.rng.range(0,4));}
 emit(type:SimEvent['type'],extra:Partial<SimEvent>={}){this.events.push({id:++this.eventId,type,...extra});if(this.events.length>40)this.events.shift()}
 setPhase(p:Phase){this.phase=p;this.phaseTime=0}
 start(){if(this.phase==='ready')this.nextDelivery()}
 nextDelivery(){
  if(matchStatus(this.score,this.config,this.target)!=='playing'){this.setPhase('finished');return}
  this.delivery=chooseDelivery(this.config,this.score.history,this.rng);this.ball={p:{...RELEASE},v:releaseVelocity(this.delivery),live:false,hit:false,bounced:false,bounces:0,groundedAfterHit:false};
  this.arrival=predictArrival({...this.ball,live:true},this.delivery);this.swingAt=-10;this.contactQuality=0;this.timing='MISSED';this.runs=0;this.running=false;this.runProgress=0;this.runEnd=0;this.result=null;this.wicketDown=false;this.thrower=-1;this.replay=[];this.footstep=0;
  this.protectedBall=this.freeHit||this.delivery.noBall;
  for(const f of this.fielders){f.p={...f.home};f.state='idle'}this.setPhase('runup');
 }
 swing(){if(this.paused||this.phase!=='flight'||this.swingAt>-1)return false;this.swingAt=this.time;this.swingShot=this.shot;this.swingAim=this.aim;return true}
 run(){if(this.paused||!this.ball.hit||!['inplay','return'].includes(this.phase)||this.running)return false;this.running=true;this.runProgress=0;this.emit('run');return true}
 get swingElapsed(){return this.swingAt>-1?this.time-this.swingAt:-1}
 get bat(){return batPose(this.swingElapsed,this.swingAt>-1?this.swingShot:this.shot,this.arrival.point.x,this.arrival.point.y,this.swingAim)}
 get bowlerZ(){return this.phase==='runup'?-25+14.6*Math.pow(clamp(this.phaseTime/2.65,0,1),.85):this.phase==='flight'?-10.4+Math.min(this.phaseTime,1)*2:-8.4}
 get runFraction(){return this.running?this.runProgress:0}
 get runSafety(){if(!this.ball.hit)return '';const closest=Math.min(...this.fielders.map(f=>len(sub(f.p,this.ball.p))));const remaining=this.phase==='return'?this.throwDuration-this.phaseTime:closest/6.2+len(sub(this.ball.p,this.returnTarget))/25;return remaining>3.25?'SAFE TO RUN':'RISKY RUN'}
 advance(realDt:number){if(this.paused||this.phase==='finished'||this.phase==='ready')return;this.accumulator+=Math.min(realDt,.1);while(this.accumulator>=STEP){this.step(STEP);this.accumulator-=STEP}}
 step(dt=STEP){
  if(this.paused||this.phase==='finished'||this.phase==='ready')return;this.time+=dt;this.phaseTime+=dt;
  if(this.phase==='runup'){
   if(Math.floor(this.phaseTime*4)>this.footstep){this.footstep=Math.floor(this.phaseTime*4);this.emit('footstep')}
   this.ball.p=v(RELEASE.x,RELEASE.y,this.bowlerZ);
   if(this.phaseTime>=2.65){this.ball.p={...RELEASE};this.ball.live=true;this.flightStart=this.time;this.setPhase('flight');this.emit('release')}
  }else if(this.phase==='flight'||this.phase==='inplay'){
   const prev={...this.ball.p};const bounced=integrateBall(this.ball,this.delivery,dt);if(bounced)this.emit('bounce');
   if(this.phase==='flight'){
    if(this.swingElapsed>=0&&this.swingElapsed<.43&&!this.ball.hit){
     const currBat=this.bat,oldBat=batPose(this.swingElapsed-dt,this.swingShot,this.arrival.point.x,this.arrival.point.y,this.swingAim);
     const radius=BALL_RADIUS+(this.config.difficulty==='Rookie'?.055:this.config.difficulty==='Pro'?.018:0);
     if(batContact(prev,this.ball.p,oldBat,currBat,radius)){
      const offset=(this.swingAt+SWING_CONTACT)-(this.flightStart+this.arrival.time);const window={Rookie:.14,Pro:.10,Elite:.075}[this.config.difficulty];
      this.contactQuality=clamp(1-Math.abs(offset)/window,.12,1);this.timing=Math.abs(offset)<.035?'PERFECT':Math.abs(offset)<.075?'GOOD':offset<0?'EARLY':'LATE';
      this.ball.v=contactImpulse(this.ball,this.swingShot,this.swingAim,this.contactQuality,this.ball.p.y,Math.sign(offset));this.ball.hit=true;this.ball.groundedAfterHit=false;this.setPhase('inplay');this.emit('contact',{quality:this.contactQuality});
     }
    }
    if(!this.ball.hit){
     // Sweep each stump at the real wicket plane to prevent tunnelling.
     if(prev.z<=10.06&&this.ball.p.z>=10.06){let t=(10.06-prev.z)/(this.ball.p.z-prev.z),p=mix(prev,this.ball.p,t);if(Math.abs(p.x)<.17&&p.y<.76){this.wicketDown=true;this.resolve(0,this.protectedBall?undefined:'bowled');}}
     if(this.phase==='flight'&&this.ball.p.z>12.1)this.resolve(0);
    }
   }
   if(this.phase==='inplay'){
    if(isBoundary(this.ball.p.x,this.ball.p.z))this.resolve(boundaryRuns(this.ball.groundedAfterHit));
    else this.field(dt);
   }
  }else if(this.phase==='return'){
   const t=clamp(this.phaseTime/this.throwDuration,0,1);this.ball.p=mix(this.throwStart,this.returnTarget,t);this.ball.p.y+=Math.sin(t*Math.PI)*2.2;
   if(t>=1){if(this.running&&this.runProgress+dt/3.05<1){this.wicketDown=true;this.resolve(0,'run out')}else {if(this.running){this.runs++;this.running=false;this.runEnd=1-this.runEnd;}this.resolve(0)}}
  }else if(this.phase==='result'&&this.phaseTime>this.resultHold)this.nextDelivery();
  if(this.running&&['inplay','return'].includes(this.phase)){
   this.runProgress+=dt/3.05;
   if(this.runProgress>=1){this.runs++;this.running=false;this.runProgress=0;this.runEnd=1-this.runEnd;this.emit('run');if(this.config.mode==='match'&&this.score.runs+this.runs+(this.delivery.noBall?1:0)>=this.target)this.resolve(0);}
  }
  if(this.recording&&++this.frameTick%4===0&&this.phase!=='result')this.replay.push(this.snapshot());
 }
 nearestFielder(){return this.fielders.reduce((best,f)=>len(sub(f.p,this.ball.p))<len(sub(best.p,this.ball.p))?f:best)}
 field(dt:number){
  const b=this.ball,closest=this.nearestFielder();
  for(const f of this.fielders){
   const prediction=add(b.p,mul(b.v,clamp(len(sub(f.p,b.p))/16,0,.85)));prediction.y=0;
   const engaged=f===closest||len(sub(f.p,prediction))<13;
   if(engaged&&this.phaseTime>.24){f.state='chase';const dir=sub(prediction,f.p);dir.y=0;const dist=len(dir);if(dist>.1)f.p=add(f.p,mul(norm(dir),Math.min(dist,6.2*dt)));}
   if(Math.hypot(f.p.x-b.p.x,f.p.z-b.p.z)<.88&&b.p.y<2.15&&b.p.y>.15&&!b.groundedAfterHit&&b.v.y<1&&this.phaseTime>.3){f.state='catch';if(!this.protectedBall){this.resolve(0,'caught');return}else{this.beginReturn(f);return}}
   if(Math.hypot(f.p.x-b.p.x,f.p.z-b.p.z)<.85&&b.p.y<.55&&this.phaseTime>.45){this.beginReturn(f);return}
  }
 }
 beginReturn(f:Fielder){this.thrower=f.id;f.state='throw';this.throwStart={...this.ball.p};this.throwStart.y=1.5;this.returnTarget=v(0,.72,this.runEnd===0? -10.06:10.06);this.throwDuration=Math.max(.35,len(sub(this.throwStart,this.returnTarget))/24);this.setPhase('return')}
 resolve(boundary:0|4|6=0,wicket?:Wicket){
  if(this.phase==='result'||this.phase==='finished')return;
  const wide=!this.ball.hit&&Math.abs(this.arrival.point.x)>.95&&!this.delivery.noBall;
  if((wide||this.protectedBall)&&wicket&&wicket!=='run out')wicket=undefined;
  const extras=wide||this.delivery.noBall?1:0,batRuns=wicket==='caught'?0:(boundary||this.runs);
  const r:Result={runs:batRuns+extras,batRuns,extras,legal:!wide&&!this.delivery.noBall,wicket,boundary,timing:this.ball.hit?this.timing:'MISSED',quality:this.contactQuality,delivery:{...this.delivery},shot:this.swingAt>-1?this.swingShot:this.shot,aim:this.swingAim,landing:{...this.ball.p},contact:this.ball.hit};
  this.result=r;this.score=applyResult(this.score,r);this.lastReplay=[...this.replay,this.snapshot()];this.ball.live=false;this.running=false;this.freeHit=this.delivery.noBall?true:(r.legal?false:this.freeHit);this.setPhase('result');this.emit('result',{result:r});
 }
 snapshot():Frame{return {time:this.time,phase:this.phase,phaseTime:this.phaseTime,ball:{...this.ball.p},ballLive:this.ball.live,bowlerZ:this.bowlerZ,swing:this.swingElapsed,shot:this.swingAt>-1?this.swingShot:this.shot,aim:this.aim,batHandle:{...this.bat.handle},batToe:{...this.bat.toe},run:this.runEnd+(this.running?(this.runEnd===0?1:-1)*this.runProgress:0),fielders:this.fielders.map(f=>({...f.p})),fielderStates:this.fielders.map(f=>f.state),running:this.running,runEnd:this.runEnd,wicket:this.wicketDown}}
}
