import type {Quality} from '../render/scene';
export interface Settings {master:number;crowd:number;effects:number;quality:Quality;camera:number;assistance:boolean;tutorial:boolean;}
export const DEFAULT_SETTINGS:Settings={master:.7,crowd:.4,effects:.8,quality:'High',camera:0,assistance:true,tutorial:true};
export function loadSettings():Settings{try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem('cricverse.settings')??'{}')}}catch{return DEFAULT_SETTINGS}}
export function saveSettings(s:Settings){try{localStorage.setItem('cricverse.settings',JSON.stringify(s))}catch{/* Private browsing can deny persistence. */}}
