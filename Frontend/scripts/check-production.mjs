import {productionConfig} from './production-config.mjs';
try{const config=productionConfig();console.log('Configuración de frontend válida. Indexación: '+(config.indexable?'habilitada':'deshabilitada')+'. No se verificaron proveedores.');}catch(e){console.error(e.message);process.exitCode=1;}
