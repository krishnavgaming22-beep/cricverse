import type {SimEvent} from './types';
export interface AudioSettings {master:number;crowd:number;effects:number}
/** Original procedural Foley, generated locally; no audio or network assets. */
export class CricketAudio {
 ctx:AudioContext|null=null;settings:AudioSettings={master:.7,crowd:.4,effects:.8};crowdGain:GainNode|null=null;last=0;
 unlock(){if(!this.ctx||this.ctx.state==='closed'){this.ctx=new AudioContext();const ctx=this.ctx,buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);let b=0;for(let i=0;i<data.length;i++){b=(b+(Math.random()*2-1)*.025)/1.025;data[i]=b;}const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1200;this.crowdGain=ctx.createGain();source.connect(filter);filter.connect(this.crowdGain);this.crowdGain.connect(ctx.destination);source.start();this.update(this.settings)}void this.ctx.resume();}
 update(s:AudioSettings){this.settings=s;if(this.crowdGain&&this.ctx)this.crowdGain.gain.setTargetAtTime(s.master*s.crowd*.6,this.ctx.currentTime,.2)}
 tone(freq:number,duration:number,gain:number,type:OscillatorType='sine',end=freq){if(!this.ctx)return;const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),c.currentTime+duration);g.gain.setValueAtTime(gain*this.settings.master*this.settings.effects,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration)}
 noise(duration:number,volume:number,freq:number){if(!this.ctx)return;const c=this.ctx,b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/d.length*7);const s=c.createBufferSource();s.buffer=b;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;const g=c.createGain();g.gain.value=volume*this.settings.master*this.settings.effects;s.connect(f);f.connect(g);g.connect(c.destination);s.start()}
 click(){this.unlock();this.tone(550,.07,.09,'sine',850)}
 pause(){this.tone(440,.12,.07,'sine',220)}
 event(e:SimEvent){if(e.id<=this.last)return;this.last=e.id;
 if(e.type==='contact'){this.noise(.11,.8,2200);this.tone(180+(e.quality??0)*180,.1,.4,'triangle',70)}
 if(e.type==='bounce'){this.noise(.07,.25,600);this.tone(90,.07,.1)}
 if(e.type==='footstep')this.noise(.06,.08,380);
 if(e.type==='release')this.noise(.13,.15,1700);
 if(e.type==='result'&&e.result){const r=e.result;if(r.wicket){this.noise(.24,.5,1800);this.tone(160,.5,.13,'triangle',60)}else if(r.boundary){[0,.12,.24].forEach((delay,i)=>setTimeout(()=>this.tone([440,554,660][i],.5,.1),delay*1000));}
 if((r.wicket||r.boundary)&&this.crowdGain&&this.ctx){this.crowdGain.gain.setTargetAtTime(this.settings.master*this.settings.crowd*2.7,this.ctx.currentTime,.15);this.crowdGain.gain.setTargetAtTime(this.settings.master*this.settings.crowd*.6,this.ctx.currentTime+1.5,.8)}}
 }
 dispose(){const ctx=this.ctx;this.ctx=null;this.crowdGain=null;if(ctx&&ctx.state!=='closed')void ctx.close()}
}
