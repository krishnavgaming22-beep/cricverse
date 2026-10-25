export type V3 = {x:number;y:number;z:number};
export const v=(x=0,y=0,z=0):V3=>({x,y,z});
export const add=(a:V3,b:V3)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a:V3,b:V3)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
export const mul=(a:V3,s:number)=>v(a.x*s,a.y*s,a.z*s);
export const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const len=(a:V3)=>Math.hypot(a.x,a.y,a.z);
export const norm=(a:V3)=>mul(a,1/(len(a)||1));
export const mix=(a:V3,b:V3,t:number)=>add(a,mul(sub(b,a),t));
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t)};
/** Minimum distance of two finite segments, including both degenerate cases. */
export function segmentDistance(p:V3,q:V3,a:V3,b:V3):number {
 const d1=sub(q,p),d2=sub(b,a),r=sub(p,a),A=dot(d1,d1),E=dot(d2,d2),F=dot(d2,r);let s=0,t=0;
 if(A<1e-12&&E<1e-12)return len(r);
 if(A<1e-12)t=clamp(F/E,0,1);
 else {const C=dot(d1,r);if(E<1e-12)s=clamp(-C/A,0,1);else {const B=dot(d1,d2),den=A*E-B*B;s=den!==0?clamp((B*F-C*E)/den,0,1):0;t=(B*s+F)/E;if(t<0){t=0;s=clamp(-C/A,0,1)}else if(t>1){t=1;s=clamp((B-C)/A,0,1)}}}
 return len(sub(add(p,mul(d1,s)),add(a,mul(d2,t))));
}
export class Random {constructor(public state=12345){} next(){let a=this.state+=0x6D2B79F5;a=Math.imul(a^a>>>15,a|1);a^=a+Math.imul(a^a>>>7,a|61);return ((a^a>>>14)>>>0)/4294967296} range(a:number,b:number){return a+(b-a)*this.next()} pick<T>(a:readonly T[]):T{return a[Math.floor(this.next()*a.length)]}}
