import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {Character} from './character';
import {Random,clamp,v} from '../game/math';
import {CricketSim} from '../game/simulation';
import type {Frame} from '../game/types';
export type Quality='Low'|'Medium'|'High';
export interface RenderSettings {quality:Quality;camera:number;assistance:boolean}
export class CricketRenderer {
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.08,700);assets:Record<string,GLTF>={};
 batter!:Character;bowler!:Character;keeper!:Character;nonStriker!:Character;fielders:Character[]=[];bat!:THREE.Object3D;nonBat!:THREE.Object3D;ball!:THREE.Object3D;wickets:THREE.Object3D[]=[];
 shadow!:THREE.Mesh;aimLine!:THREE.Line;trail!:THREE.Line;trailPts:THREE.Vector3[]=[];crowd!:THREE.InstancedMesh;crowdOrigins:THREE.Matrix4[]=[];scoreDisplay!:THREE.CanvasTexture;scoreCanvas!:HTMLCanvasElement;lastScore='';
 settings:RenderSettings={quality:'High',camera:0,assistance:true};loaded=false;view='menu';replayTime=0;replaying=false;frames:Frame[]=[];fps=60;frameCount=0;fpsTime=0;time=0;resizeObserver:ResizeObserver;disposed=false;drawcalls=0;triangles=0;private envRT:THREE.WebGLRenderTarget;private sun:THREE.DirectionalLight;
 constructor(public host:HTMLElement){
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.setClearColor('#becbc1');host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Live 3D cricket stadium');
  const pmrem=new THREE.PMREMGenerator(this.renderer);this.envRT=pmrem.fromScene(new RoomEnvironment(),.04);this.scene.environment=this.envRT.texture;this.scene.environmentIntensity=.25;pmrem.dispose();
  this.scene.fog=new THREE.Fog('#b4bbb0',115,350);
  const sky=new Sky();sky.scale.setScalar(450);sky.material.uniforms.turbidity.value=7;sky.material.uniforms.rayleigh.value=1.4;sky.material.uniforms.mieCoefficient.value=.005;sky.material.uniforms.mieDirectionalG.value=.8;sky.material.uniforms.sunPosition.value.set(-130,18,-170);this.scene.add(sky);
  this.scene.add(new THREE.HemisphereLight('#d3e4f5','#4a5832',1.35));
  this.sun=new THREE.DirectionalLight('#ffdb9b',2.6);this.sun.position.set(-34,19,-48);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-25,right:25,top:30,bottom:-30,near:.5,far:140});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.018;this.sun.target.position.set(0,0,0);this.scene.add(this.sun,this.sun.target);
  for(const [x,z] of [[70,55],[-70,55],[70,-55],[-70,-55]]){const l=new THREE.SpotLight('#e2f6ff',85,150,.65,.8,1);l.position.set(x,32,z);l.target.position.set(0,0,0);this.scene.add(l,l.target)}
  this.camera.position.set(7,3.5,15);this.camera.lookAt(-2,1,5);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
 }
 async load(progress:(n:number,label:string)=>void){
  const names=['stadium','batsman','bowler','keeper','bat','ball','wicket','crowd'];const loader=new GLTFLoader();let completed=0;
  await Promise.all(names.map(async name=>{const asset=await loader.loadAsync('/assets/'+name+'.glb');if(this.disposed)return;this.assets[name]=asset;progress(++completed/names.length,name)}));
  if(this.disposed)return;
  const stadium=this.assets.stadium.scene;stadium.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=!o.name.includes('turf')&&!o.name.includes('clay');o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=.25;if(m.name.includes('canopy'))m.side=THREE.DoubleSide;}}}});this.scene.add(stadium);
  this.batter=new Character(this.assets.batsman);this.bowler=new Character(this.assets.bowler);this.keeper=new Character(this.assets.keeper);this.nonStriker=new Character(this.assets.batsman);[this.batter,this.bowler,this.keeper,this.nonStriker].forEach(c=>this.scene.add(c.root));
  this.batter.root.position.set(-.59,0,8.85);this.bowler.root.rotation.y=0;this.keeper.root.position.set(-.05,0,13.2);this.keeper.root.rotation.y=Math.PI;this.nonStriker.root.position.set(-1.8,0,-8.85);this.nonStriker.root.rotation.y=0;
  for(let i=0;i<9;i++){const f=new Character(this.assets.bowler);this.fielders.push(f);this.scene.add(f.root)}
  this.bat=this.assets.bat.scene;this.nonBat=this.bat.clone(true);this.scene.add(this.bat,this.nonBat);this.bat.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true});this.ball=this.assets.ball.scene;this.scene.add(this.ball);
  for(const z of [-10.06,10.06]){const w=this.assets.wicket.scene.clone(true);w.position.set(0,0,z);w.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;if(o.name.startsWith('LIVE_Bail')){o.userData.restPosition=o.position.clone();o.userData.restQuaternion=o.quaternion.clone()}});this.wickets.push(w);this.scene.add(w)}
  this.createCrowd();this.createSigns();
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.13,20),new THREE.MeshBasicMaterial({color:'#111d12',transparent:true,opacity:.30,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
  this.aimLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#d7e99f',transparent:true,opacity:.55,dashSize:.6,gapSize:.5}));this.scene.add(this.aimLine);
  this.trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#fff2cc',transparent:true,opacity:.38,depthWrite:false}));this.scene.add(this.trail);
  this.loaded=true;this.updateSettings(this.settings);
 }
 createCrowd(){
  let source:THREE.BufferGeometry|undefined;this.assets.crowd.scene.traverse(o=>{if(o instanceof THREE.Mesh)source=o.geometry});if(!source)return;
  const count=4500;this.crowd=new THREE.InstancedMesh(source,new THREE.MeshLambertMaterial({color:'white'}),count);this.crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.crowd.frustumCulled=false;const rng=new Random(75),dummy=new THREE.Object3D(),palette=['#9aa49b','#c0b78c','#284e5a','#725c50','#c7bbaa','#ca7754','#32756f','#162e39'];
  for(let i=0;i<count;i++){const a=rng.next()*Math.PI*2,row=Math.floor(rng.next()*22),upper=row>11,r=upper?84+(row-12)*.68:74+row*.7,y=upper?9.1+(row-12)*.46:2+row*.44;dummy.position.set(Math.cos(a)*r,y+.25,-Math.sin(a)*r*.91);dummy.rotation.y=-a-Math.PI/2;dummy.scale.set(.75,.63+rng.next()*.15,.8);dummy.updateMatrix();this.crowd.setMatrixAt(i,dummy.matrix);this.crowdOrigins.push(dummy.matrix.clone());this.crowd.setColorAt(i,new THREE.Color(rng.pick(palette)));}this.scene.add(this.crowd);
 }
 label(text:string,w:number,h:number,bg='#122626',color='#d5dec4'){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle=bg;c.fillRect(0,0,1024,256);c.fillStyle=color;c.font='bold 66px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,512,128);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));}
 createSigns(){
  const brands=['CRICVERSE','THE FIRST INNINGS','KŌRA SPORT','NORTHSTAR','SUNDIAL STUDIO','PLAY THE MOMENT'];
  for(let i=0;i<48;i++){const a=i*Math.PI*2/48;const sign=this.label(brands[i%brands.length],6.7,.80,i%4===0?'#d3df9a':'#142c2b',i%4===0?'#1a332d':'#dbe7d9');sign.position.set(66.82*Math.cos(a),.69,-66.82*.91*Math.sin(a));sign.lookAt(0,.69,0);this.scene.add(sign)}
  for(const [x,z,rot] of [[0,-74,0],[0,74,Math.PI]]){const sign=this.label('S U N D I A L   O V A L',24,1.7,'#192e2c','#e6dec0');sign.position.set(x,9,z);sign.rotation.y=rot;this.scene.add(sign)}
  this.scoreCanvas=document.createElement('canvas');this.scoreCanvas.width=1024;this.scoreCanvas.height=384;this.scoreDisplay=new THREE.CanvasTexture(this.scoreCanvas);this.scoreDisplay.colorSpace=THREE.SRGBColorSpace;const board=new THREE.Mesh(new THREE.PlaneGeometry(19.8,6.4),new THREE.MeshBasicMaterial({map:this.scoreDisplay}));board.position.set(0,15,82.48);board.rotation.y=Math.PI;this.scene.add(board);
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,this.settings.quality==='High'?1.7:this.settings.quality==='Medium'?1.25:1));}
 updateSettings(s:RenderSettings){this.settings=s;this.renderer.shadowMap.enabled=s.quality!=='Low';this.sun.shadow.mapSize.set(s.quality==='High'?2048:1024,s.quality==='High'?2048:1024);if(this.crowd)this.crowd.count=s.quality==='Low'?1000:s.quality==='Medium'?2600:4500;this.resize()}
 startReplay(frames:Frame[]){if(frames.length<2)return;this.frames=frames;this.replayTime=0;this.replaying=true;this.trailPts=[]}
 stopReplay(){this.replaying=false;this.trailPts=[]}
 render(dt:number,sim:CricketSim,view:string){
  this.time+=dt;this.view=view;if(!this.loaded){this.renderer.render(this.scene,this.camera);return}
  let f=sim.snapshot();
  if(this.replaying){this.replayTime+=dt*.55;const start=this.frames[0].time;f=this.frames[Math.min(this.frames.length-1,Math.floor(this.replayTime*60))];if(this.replayTime>this.frames.at(-1)!.time-start+.2){this.replayTime=this.frames.at(-1)!.time-start;} }
  const menu=view==='menu'||view==='setup';this.keeper.root.visible=menu||this.replaying||['inplay','return','result'].includes(f.phase);
  this.bowler.root.position.set(.04,0,menu?-13:f.bowlerZ);this.bowler.bowl(f.time,f.phase,f.phaseTime);
  if(f.phase==='runup'&&f.phaseTime>2.1){const stride=clamp((f.phaseTime-2.1)/.55,0,1);this.bowler.root.position.y=.17*Math.sin(stride*Math.PI/2);this.bowler.armIK('R',new THREE.Vector3(.35,1.25+stride*.97,f.bowlerZ));}
  if(f.phase==='flight'&&f.phaseTime<.2){this.bowler.root.position.y=.17*(1-f.phaseTime/.2);this.bowler.armIK('R',new THREE.Vector3(.35,2.22-f.phaseTime*5,-10.4+f.phaseTime*1.7));}
  if(menu){this.bowler.poseIdle(this.time);this.bowler.root.position.y=0;}

  const running=f.running;
  this.batter.root.position.set(-.59,0,8.85-f.run*17.7);this.nonStriker.root.position.set(-1.65,0,-8.85+f.run*17.7);
  if(running){this.batter.root.rotation.y=f.runEnd===0?Math.PI:0;this.nonStriker.root.rotation.y=f.runEnd===0?0:Math.PI;this.batter.run(f.time);this.nonStriker.run(f.time);this.bat.visible=true;this.batter.root.updateMatrixWorld(true);const hand=this.batter.bones['hand.R'];if(hand){this.bat.position.copy(hand.getWorldPosition(new THREE.Vector3()));this.bat.rotation.set(.5,0,.2);}}
  else {this.batter.root.rotation.y=Math.PI;const offset=f.run>=.99?-17.7:0;const handle={...f.batHandle,z:f.batHandle.z+offset},toe={...f.batToe,z:f.batToe.z+offset};this.batter.bat(handle,toe,f.swing,f.shot);this.nonStriker.poseIdle(f.time);this.bat.visible=true;this.bat.position.set(handle.x,handle.y,handle.z);const direction=new THREE.Vector3(f.batHandle.x-f.batToe.x,f.batHandle.y-f.batToe.y,f.batHandle.z-f.batToe.z).normalize();this.bat.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);}
  this.nonStriker.root.updateMatrixWorld(true);const nonHand=this.nonStriker.bones['hand.R'];if(nonHand){this.nonBat.position.copy(nonHand.getWorldPosition(new THREE.Vector3()));this.nonBat.rotation.set(.1,0,.1);}
  this.keeper.poseIdle(f.time);this.keeper.rotate('thigh.L',-.38);this.keeper.rotate('thigh.R',-.38);this.keeper.rotate('shin.L',.55);this.keeper.rotate('shin.R',.55);this.keeper.rotate('chest',.2);this.keeper.root.position.y=-.45;
  this.fielders.forEach((c,i)=>{const p=f.fielders[i],old=c.root.position.clone();c.root.position.set(p.x,0,p.z);const dx=p.x-old.x,dz=p.z-old.z;if(Math.hypot(dx,dz)>.002){c.root.rotation.y=Math.atan2(dx,dz);c.run(f.time)}else c.poseIdle(f.time);if(f.fielderStates[i]==='catch'){c.rotate('upperarm.L',-1.5);c.rotate('upperarm.R',-1.5)}if(f.fielderStates[i]==='throw'){c.rotate('upperarm.R',-Math.PI+Math.min(1,f.phaseTime)*2.3);c.rotate('forearm.R',-.4);}});
  const bp=f.ball;this.ball.position.set(bp.x,bp.y,bp.z);this.ball.visible=!menu&&(f.ballLive||f.phase==='runup');if(f.phase==='runup'){this.bowler.root.updateMatrixWorld(true);const hand=this.bowler.bones['hand.R'];if(hand)this.ball.position.copy(hand.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0,.035,0));}this.ball.rotation.x+=dt*18;this.ball.rotation.z+=dt*9;
  // Preserve regulation radius; optional luminous outline makes the real ball legible at distance.
  this.ball.scale.setScalar(this.settings.assistance?1.25:1);
  this.shadow.visible=this.ball.visible;this.shadow.position.set(bp.x,.048,bp.z);this.shadow.scale.setScalar(1+Math.min(8,bp.y)*.15);
  this.wickets.forEach((w,i)=>w.traverse(o=>{if(o.name.startsWith('LIVE_Bail')){o.position.copy(o.userData.restPosition);o.quaternion.copy(o.userData.restQuaternion);if(f.wicket&&i===1){const t=Math.min(sim.phaseTime,.65);o.position.y+=Math.max(-.65,t*2.4-4.9*t*t);o.position.z+=t*.8;o.rotateX(t*7);}}}));
  this.aimLine.visible=this.settings.assistance&&!menu&&!this.replaying&&['runup','flight'].includes(f.phase);
  if(this.aimLine.visible){const angle=sim.aim*1.12+(sim.shot==='pull'?.66:0);this.aimLine.geometry.dispose();this.aimLine.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.065,8.55),new THREE.Vector3(Math.sin(angle)*11,.065,8.55-Math.cos(angle)*11)]);this.aimLine.computeLineDistances()}
  this.trail.visible=!menu&&(sim.ball.hit||this.replaying)&&this.settings.assistance;
  if(this.trail.visible&&f.ballLive){this.trailPts.push(new THREE.Vector3(bp.x,bp.y,bp.z));if(this.trailPts.length>28)this.trailPts.shift();this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry().setFromPoints(this.trailPts)}else if(!sim.ball.hit)this.trailPts=[];
  // Small crowd motion, amplified by genuine boundaries and wickets.
  if(this.frameCount%5===0&&this.settings.quality!=='Low'){const reaction=sim.result&&(sim.result.boundary||sim.result.wicket)&&sim.phaseTime<2;for(let i=0;i<this.crowd.count;i+=5){const m=this.crowdOrigins[i].clone();m.elements[13]+=Math.max(0,Math.sin(this.time*(reaction?8:1.7)+i))*(reaction?.35:.025);this.crowd.setMatrixAt(i,m)}this.crowd.instanceMatrix.needsUpdate=true;}
  const desired=new THREE.Vector3(),target=new THREE.Vector3();let fov=48;
  if(menu){desired.set(3.5+Math.sin(this.time*.06)*.45,2.1,13);target.set(-2.8,1.15,7.7);fov=46;}
  else if(this.replaying){desired.set(bp.x+8,Math.max(3.5,bp.y+3),bp.z+10);target.set(bp.x,bp.y,bp.z);fov=50}
  else if((f.phase==='inplay'||f.phase==='return'||(f.phase==='result'&&sim.result?.boundary))&&sim.ball.hit){const d=Math.hypot(bp.x,bp.z-8.5);desired.set(bp.x*.72+4,Math.max(4.7,bp.y*.65+3.8),bp.z*.72+11);target.set(bp.x,bp.y*.65,bp.z);fov=d>20?53:49;}
  else if(f.phase==='runup'&&f.phaseTime<.75&&this.settings.camera===2){desired.set(9,4,-15);target.set(0,1,-6);fov=47;}
  else {if(this.settings.camera===1){desired.set(0,5.6,20);target.set(0,.8,-3);fov=43}else {desired.set(.8,3.2,16.3);target.set(0,1.0,-4.0);fov=48}}
  const blend=1-Math.exp(-dt*(menu?1.5:5));this.camera.position.lerp(desired,blend);const current=new THREE.Vector3();this.camera.getWorldDirection(current);current.multiplyScalar(20).add(this.camera.position);current.lerp(target,blend);this.camera.lookAt(current);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov,blend);this.camera.updateProjectionMatrix();
  const key=sim.score.runs+'/'+sim.score.wickets+'/'+sim.score.balls;if(this.lastScore!==key){this.lastScore=key;const c=this.scoreCanvas.getContext('2d')!;c.fillStyle='#0b2527';c.fillRect(0,0,1024,384);c.textAlign='center';c.fillStyle='#cddd92';c.font='bold 40px Arial';c.fillText('CRICVERSE  /  SUNDIAL OVAL',512,70);c.font='bold 145px Arial';c.fillStyle='#f0f0df';c.fillText(sim.score.runs+' / '+sim.score.wickets,512,225);c.font='32px Arial';c.fillText('THE FIRST INNINGS     •     TARGET '+sim.target,512,315);this.scoreDisplay.needsUpdate=true;}
  this.renderer.render(this.scene,this.camera);this.frameCount++;this.fpsTime+=dt;if(this.fpsTime>=1){this.fps=this.frameCount/this.fpsTime;this.frameCount=0;this.fpsTime=0;this.drawcalls=this.renderer.info.render.calls;this.triangles=this.renderer.info.render.triangles;}
 }
 dispose(){this.disposed=true;this.resizeObserver.disconnect();this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});this.envRT.dispose();this.renderer.dispose();this.renderer.domElement.remove()}
}
