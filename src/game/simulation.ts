import {add,clamp,len,mix,mul,norm,Random,smooth,sub,v,type V3} from './math';
import {bowlingHand,RELEASE_TIME} from './rig';
import {chooseDelivery,RELEASE,releaseVelocity} from './bowling';
import {batContact,batPose,BALL_RADIUS,CONTACT_Z,contactImpulse,hitsWicket,integrateBall,predictArrival,STEP,SWING_CONTACT} from './physics';
import {applyResult,boundaryRuns,emptyScore,isBoundary,matchStatus} from './rules';
import {DEFAULT_CONFIG,type Ball,type Config,type Delivery,type Fielder,type Frame,type Phase,type Result,type Score,type Shot,type SimEvent,type Timing,type Wicket} from './types';
const FIELD=[[-8,14],[14,10],[-17,-5],[19,-15],[-33,15],[34,6],[-27,-36],[30,-36],[0,-45]];
export class CricketSim {
 config:Config; rng:Random;score:Score=emptyScore();target=0;phase:Phase='ready';phaseTime=0;time=0;paused=false;
 ball:Ball={p:{...RELEASE},v:v(),live:false,hit:false,bounced:false,bounces:0,groundedAfterHit:false};
 fielders:Fielder[]=FIELD.map(([x,z],id)=>({id,home:v(x,0,z),p:v(x,0,z),velocity:v(),stateTime:0,state:'idle'}));
 delivery:Delivery;shot:Shot='drive';aim=0;swingAt=-10;swingShot:Shot='drive';swingAim=0;contactQuality=0;timing:Timing='MISSED';arrival={time:0,point:v(0,.5,CONTACT_Z)};flightStart=0;
 runs=0;running=false;runProgress=0;runEnd=0;result:Result|null=null;resultHold=2.6;returnTarget=v(0,.72,10.06);throwStart=v();throwDuration=0;thrower=-1;wicketDown=false;
 replay:Frame[]=[];lastReplay:Frame[]=[];events:SimEvent[]=[];eventId=0;accumulator=0;recording=true;freeHit=false;protectedBall=false;private frameTick=0;private footstep=0;primary=-1;intercept=v();predictionClock=0;releasePoint=v();lastContact:import('./physics').Contact|null=null;throwReleased=false;
 constructor(config:Partial<Config>={}){this.config={...DEFAULT_CONFIG,...config};this.rng=new Random(this.config.seed);this.delivery=chooseDelivery(this.config,[],this.rng);this.target=this.config.target??Math.round(this.config.overs*({Rookie:7,Pro:10,Elite:13}[this.config.difficulty])+this.rng.range(0,4));}
 emit(type:SimEvent['type'],extra:Partial<SimEvent>={}){this.events.push({id:++this.eventId,type,...extra});if(this.events.length>40)this.events.shift()}
 setPhase(p:Phase){this.phase=p;this.phaseTime=0}
 start(){if(this.phase==='ready')this.nextDelivery()}
 nextDelivery(){
  if(matchStatus(this.score,this.config,this.target)!=='playing'){this.setPhase('finished');return}
  this.delivery=chooseDelivery(this.config,this.score.history,this.rng);this.ball={p:{...RELEASE},v:releaseVelocity(this.delivery),live:false,hit:false,bounced:false,bounces:0,groundedAfterHit:false};
  this.arrival=predictArrival({...this.ball,live:true},this.delivery);this.swingAt=-10;this.contactQuality=0;this.timing='MISSED';this.runs=0;this.running=false;this.runProgress=0;this.runEnd=0;this.result=null;this.wicketDown=false;this.thrower=-1;this.replay=[];this.footstep=0;
  this.protectedBall=this.freeHit||this.delivery.noBall;
  this.primary=-1;this.predictionClock=0;this.lastContact=null;this.throwReleased=false;for(const f of this.fielders){f.state='return';f.stateTime=0;}this.setPhase('runup');
 }
 swing(){if(this.paused||this.phase!=='flight'||this.swingAt>-1)return false;this.swingAt=this.time;this.swingShot=this.shot;this.swingAim=this.aim;return true}
 run(){if(this.paused||!this.ball.hit||!['inplay','return'].includes(this.phase)||this.running)return false;this.running=true;this.runProgress=0;this.emit('run');return true}
 get swingElapsed(){return this.swingAt>-1?this.time-this.swingAt:-1}
 get bat(){return batPose(this.swingElapsed,this.swingAt>-1?this.swingShot:this.shot,this.arrival.point.x,this.arrival.point.y,this.swingAt>-1?this.swingAim:this.aim)}
 get bowlerZ(){return this.phase==='runup'?-25+14.6*Math.pow(clamp(this.phaseTime/2.65,0,1),.85):this.phase==='flight'?-10.4+Math.min(this.phaseTime,1)*2:-8.4}
 get runFraction(){return this.running?this.runProgress:0}
 get runSafety(){if(!this.ball.hit)return '';const closest=Math.min(...this.fielders.map(f=>len(sub(f.p,this.ball.p))));const remaining=this.phase==='return'?this.throwDuration-this.phaseTime:closest/6.2+len(sub(this.ball.p,this.returnTarget))/25;return remaining>3.25?'SAFE TO RUN':'RISKY RUN'}
 advance(realDt:number){if(this.paused||this.phase==='finished'||this.phase==='ready')return;this.accumulator+=Math.min(realDt,.1);while(this.accumulator>=STEP){this.step(STEP);this.accumulator-=STEP}}
 step(dt=STEP){
  if(this.paused||this.phase==='finished'||this.phase==='ready')return;this.time+=dt;this.phaseTime+=dt;
  if(this.phase==='runup'){
   if(Math.floor(this.phaseTime*4)>this.footstep){this.footstep=Math.floor(this.phaseTime*4);this.emit('footstep')}
   this.ball.p=bowlingHand(Math.min(this.phaseTime,RELEASE_TIME));this.returnFielders(dt);
   if(this.phaseTime>=RELEASE_TIME){this.releasePoint={...this.ball.p};this.ball.v=releaseVelocity(this.delivery,this.releasePoint);this.ball.live=true;this.arrival=predictArrival(this.ball,this.delivery);this.flightStart=this.time;this.setPhase('flight');this.emit('release')}
  }else if(this.phase==='flight'||this.phase==='inplay'){
   const prev={...this.ball.p};const bounced=integrateBall(this.ball,this.delivery,dt);if(bounced)this.emit('bounce');
   if(this.phase==='flight'){
    if(this.swingElapsed>=0&&this.swingElapsed<.43&&!this.ball.hit){
     const currBat=this.bat,oldBat=batPose(this.swingElapsed-dt,this.swingShot,this.arrival.point.x,this.arrival.point.y,this.swingAim);
     const contact=batContact(prev,this.ball.p,oldBat,currBat,BALL_RADIUS,dt);
     if(contact){
      const offset=this.swingElapsed-SWING_CONTACT;this.contactQuality=contact.quality*clamp(1-Math.abs(offset)/.18,.15,1);
      this.timing=this.contactQuality>.86&&Math.abs(offset)<.045?'PERFECT':this.contactQuality>.62?'GOOD':offset<0?'LATE':'EARLY';
      const outgoing=contactImpulse(this.ball,contact,this.swingShot==='defend');
      if(len(sub(outgoing,this.ball.v))>.2){contact.outgoing={...outgoing};this.lastContact=contact;this.ball.v=outgoing;this.ball.p=add(contact.point,mul(contact.normal,BALL_RADIUS+.002));this.ball.hit=true;this.ball.groundedAfterHit=false;this.setPhase('inplay');this.emit('contact',{quality:this.contactQuality});}
     }
    }
    if(!this.ball.hit){
     // Sweep each stump at the real wicket plane to prevent tunnelling.
     if(hitsWicket(prev,this.ball.p)){this.wicketDown=true;this.resolve(0,this.protectedBall?undefined:'bowled');}
     if(this.phase==='flight'&&this.ball.p.z>12.1)this.resolve(0);
    }
   }
   if(this.phase==='inplay'){
    if(hitsWicket(prev,this.ball.p)&&!this.protectedBall){this.wicketDown=true;this.resolve(0,'bowled')}
    else if(isBoundary(this.ball.p.x,this.ball.p.z))this.resolve(boundaryRuns(this.ball.groundedAfterHit));
    else this.field(dt);
   }
  }else if(this.phase==='return'){
   const f=this.fielders[this.thrower];f.stateTime+=dt;
   const release=add(f.p,v(.16,1.62,0));
   if(this.phaseTime<.62){
    f.state=this.phaseTime<.35?'collect':'throw';this.ball.p=mix(this.throwStart,release,smooth(this.phaseTime/.62));
   }else{
    if(!this.throwReleased){this.throwReleased=true;f.state='throw';this.ball.p=release;this.ball.v=this.solveThrow(release,this.returnTarget,this.throwDuration);this.ball.live=true;}
    integrateBall(this.ball,this.delivery,dt);
    if(this.phaseTime>=this.throwDuration+.62){
     if(len(sub(this.ball.p,this.returnTarget))>.5){this.setPhase('inplay');return;}
     if(this.running&&this.runProgress+dt/3.05<1){this.wicketDown=true;this.resolve(0,'run out')}else{if(this.running){this.runs++;this.running=false;this.runEnd=1-this.runEnd;}this.resolve(0)}
    }
   }
  }else if(this.phase==='result'){if(this.phaseTime>.65)this.returnFielders(dt);if(this.phaseTime>this.resultHold)this.nextDelivery();}
  if(this.running&&['inplay','return'].includes(this.phase)){
   this.runProgress+=dt/3.05;
   if(this.runProgress>=1){this.runs++;this.running=false;this.runProgress=0;this.runEnd=1-this.runEnd;this.emit('run');if(this.config.mode==='match'&&this.score.runs+this.runs+(this.delivery.noBall?1:0)>=this.target)this.resolve(0);}
  }
  if(this.recording&&++this.frameTick%4===0&&this.phase!=='result')this.replay.push(this.snapshot());
 }
 nearestFielder(){return this.fielders.reduce((best,f)=>len(sub(f.p,this.ball.p))<len(sub(best.p,this.ball.p))?f:best)}
 moveFielder(f:Fielder,target:V3,dt:number,maxSpeed=6.4){
  const delta=sub(target,f.p);delta.y=0;const distance=len(delta),speed=Math.min(maxSpeed,Math.sqrt(2*9*distance)),desired=mul(norm(delta),speed),change=sub(desired,f.velocity),amount=Math.min(1,9*dt/(len(change)||1));
  f.velocity=add(f.velocity,mul(change,amount));f.p=add(f.p,mul(f.velocity,dt));f.stateTime+=dt;
 }
 returnFielders(dt:number){for(const f of this.fielders){if(len(sub(f.home,f.p))>.12){f.state='return';this.moveFielder(f,f.home,dt,3.3)}else {f.state='idle';f.velocity=v();f.stateTime+=dt;}}}
 field(dt:number){
  const b=this.ball,reaction={Rookie:.36,Pro:.23,Elite:.13}[this.config.difficulty];this.predictionClock-=dt;
  if(this.predictionClock<=0){
   this.predictionClock=.18;const probe:Ball={...b,p:{...b.p},v:{...b.v}},candidates:{f:Fielder;p:V3;t:number;cost:number}[]=[];
   for(let t=.1;t<=3.5;t+=.1){for(let k=0;k<24;k++)integrateBall(probe,this.delivery,STEP);if(isBoundary(probe.p.x,probe.p.z))break;
    if(probe.p.y<1.9)for(const f of this.fielders){const dist=Math.hypot(f.p.x-probe.p.x,f.p.z-probe.p.z);const travel=dist/6.4+.34+Math.max(0,reaction-this.phaseTime);candidates.push({f,p:{...probe.p,y:0},t,cost:travel<=t?t:20+travel-t});}
   }
   candidates.sort((a,b)=>a.cost-b.cost);if(candidates.length){this.primary=candidates[0].f.id;this.intercept=candidates[0].p;}else {this.primary=this.nearestFielder().id;this.intercept={...b.p,y:0};}
  }
  for(const f of this.fielders){
   const close=Math.hypot(f.p.x-b.p.x,f.p.z-b.p.z);if(this.phaseTime>reaction&&(f.id===this.primary||close<9)){
    f.state='chase';const target=f.id===this.primary?this.intercept:{...b.p,y:0};this.moveFielder(f,target,dt);
   }else f.stateTime+=dt;
   if(close<.65&&b.p.y<1.95&&b.p.y>.2&&!b.groundedAfterHit&&b.v.y<.4&&this.phaseTime>.2){f.state='catch';f.stateTime=0;f.velocity=v();if(!this.protectedBall){this.resolve(0,'caught');return}else {this.beginReturn(f);return}}
   if(close<.62&&b.p.y<.36&&this.phaseTime>.3){this.beginReturn(f);return}
  }
 }
 solveThrow(start:V3,target:V3,duration:number){
  let velocity=mul(sub(target,start),1/duration);velocity.y+=4.905*duration;
  for(let n=0;n<4;n++){const probe:Ball={...this.ball,p:{...start},v:{...velocity},live:true};for(let t=0;t<duration-STEP/2;t+=STEP)integrateBall(probe,this.delivery,STEP);velocity=add(velocity,mul(sub(target,probe.p),1/duration));}
  return velocity;
 }
 beginReturn(f:Fielder){this.thrower=f.id;f.state='collect';f.stateTime=0;f.velocity=v();this.throwStart={...this.ball.p};this.returnTarget=v(0,.72,this.runEnd===0?-10.06:10.06);this.throwDuration=Math.max(.35,len(sub(add(f.p,v(.16,1.62,0)),this.returnTarget))/24);this.throwReleased=false;this.setPhase('return')}
 resolve(boundary:0|4|6=0,wicket?:Wicket){
  if(this.phase==='result'||this.phase==='finished')return;
  const wide=!this.ball.hit&&Math.abs(this.arrival.point.x)>.95&&!this.delivery.noBall;
  if((wide||this.protectedBall)&&wicket&&wicket!=='run out')wicket=undefined;
  const extras=wide||this.delivery.noBall?1:0,batRuns=wicket==='caught'?0:(boundary||this.runs);
  const r:Result={runs:batRuns+extras,batRuns,extras,legal:!wide&&!this.delivery.noBall,wicket,boundary,timing:this.ball.hit?this.timing:'MISSED',quality:this.contactQuality,delivery:{...this.delivery},shot:this.swingAt>-1?this.swingShot:this.shot,aim:this.swingAim,landing:{...this.ball.p},contact:this.ball.hit};
  this.result=r;this.score=applyResult(this.score,r);this.lastReplay=[...this.replay,this.snapshot()];this.ball.live=false;this.running=false;this.freeHit=this.delivery.noBall?true:(r.legal?false:this.freeHit);this.setPhase('result');this.emit('result',{result:r});
 }
 snapshot():Frame{return {time:this.time,phase:this.phase,phaseTime:this.phaseTime,ball:{...this.ball.p},ballLive:this.ball.live,bowlerZ:this.bowlerZ,swing:this.swingElapsed,shot:this.swingAt>-1?this.swingShot:this.shot,aim:this.swingAt>-1?this.swingAim:this.aim,batPose:this.bat,batLine:this.arrival.point.x,batHeight:this.arrival.point.y,batHandle:{...this.bat.handle},batToe:{...this.bat.toe},run:this.runEnd+(this.running?(this.runEnd===0?1:-1)*this.runProgress:0),fielders:this.fielders.map(f=>({...f.p})),fielderStates:this.fielders.map(f=>f.state),fielderTimes:this.fielders.map(f=>f.stateTime),running:this.running,runEnd:this.runEnd,wicket:this.wicketDown}}
}
