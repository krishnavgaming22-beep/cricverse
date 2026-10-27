import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {CricketRig} from '../game/rig';
export class Character extends CricketRig {
 constructor(asset:GLTF){super(clone(asset.scene));this.root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}})}
 poseIdle(t:number){this.idle(t)}
 run(t:number,amp=1){this.running(t,amp)}
 armIK(side:string,target:THREE.Vector3){this.arm(side,target,new THREE.Vector3(0,1,0))}
}
