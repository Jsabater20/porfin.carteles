import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {productionConfig} from './production-config.mjs';
process.env.NODE_ENV='production';
try {
 const {port}=productionConfig();
 const root=fileURLToPath(new URL('../',import.meta.url));
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',String(port)],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 child.on('error',()=>{console.error('No se pudo iniciar Next.js.');process.exitCode=1;});
 child.on('exit',(code,signal)=>{process.exitCode=code??(signal==='SIGTERM'||signal==='SIGINT'?0:1);});
} catch(e){console.error(e.message);process.exitCode=1;}
