import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Ejecutar con npm run test:release.');
const checks=['check','build','test:storefront','test:quality-browser','test:cart-browser','test:orders-browser','test:orders-real','test:auth-browser','test:catalog-browser','test:operations-browser'];
for(const name of (process.argv.includes('--built')?checks.slice(2):checks)) {
 console.log('\nVerificación integral: '+name);
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[npm,'run',name],{cwd:root,env:{...process.env,AUDIT_ACCESSIBILITY:'1'},stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',resolve);});
 if(code!==0){process.exitCode=1;console.error('Revisión detenida en '+name);break;}
}
