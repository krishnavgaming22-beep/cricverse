import {runLab} from './lab';
self.onmessage=e=>{try{self.postMessage({results:runLab(e.data)})}catch(error){self.postMessage({error:String(error)})}};
