export function productionConfig(env=process.env) {
 if(env.NODE_ENV!=='production')throw new Error('NODE_ENV debe ser production.');
 for(const name of ['WEB_ORIGIN','BACKEND_API_URL']){
  let url;try{url=new URL(env[name]);}catch{throw new Error(name+' es obligatorio y debe ser una URL válida.');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error(name+' requiere HTTPS público, sin credenciales ni parámetros.');
  if(name==='WEB_ORIGIN'&&url.pathname!=='/')throw new Error('WEB_ORIGIN debe ser solo un origen.');
  if(name==='BACKEND_API_URL'&&url.pathname.replace(/\/$/,'')!=='/api/v1')throw new Error('BACKEND_API_URL debe terminar en /api/v1.');
 }
 const flag=env.SITE_INDEXABLE??'false';if(!['true','false'].includes(flag))throw new Error('SITE_INDEXABLE debe ser true o false.');
 const port=Number(env.PORT??'3000');if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT debe ser un puerto válido.');
 return {port,indexable:flag==='true'};
}
