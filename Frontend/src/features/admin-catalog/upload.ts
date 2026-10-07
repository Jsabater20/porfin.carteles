import type { UploadAuthorization } from '../../lib/contracts/admin-catalog';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function validateImage(file: Pick<File,'size'|'type'>) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Elegí una imagen JPG, PNG o WebP.';
 if(file.size < 1 || file.size > MAX_IMAGE_BYTES) return 'La imagen debe pesar entre 1 byte y 5 MiB.';
 return '';
}
export async function checkImageFile(file: File) {
 const invalid=validateImage(file); if(invalid) throw new Error(invalid);
 const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('No pudimos abrir esta imagen. Revisá el archivo.');});
 const pixels=bitmap.width*bitmap.height; bitmap.close();
 if(pixels>40000000) throw new Error('La imagen debe tener hasta 40 millones de píxeles.');
}
export function uploadDestination(value: string) {
 const url=new URL(value);
 if(url.protocol!=='https:' || url.hostname!=='api.cloudinary.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/v1_1\/[a-zA-Z0-9_-]+\/image\/upload$/.test(url.pathname)) throw new Error('Destino de carga no permitido.');
 return url.toString();
}
export async function uploadImage(auth: UploadAuthorization, file: File, transport: typeof fetch = fetch) {
 const destination=uploadDestination(auth.uploadUrl);
 const invalid=validateImage(file); if(invalid) throw new Error(invalid);
 if(!Number.isFinite(Date.parse(auth.expiresAt)) || Date.parse(auth.expiresAt)<=Date.now()) throw new Error('La autorización venció. Cancelá esta carga antes de iniciar otra.');
 const data=new FormData();
 for(const key of ['timestamp','public_id','upload_preset','overwrite','allowed_formats']) {
  const value=auth.params[key]; if(value===undefined) throw new Error('Autorización de carga incompleta.');
  data.append(key,String(value));
 }
 data.append('api_key',auth.apiKey); data.append('signature',auth.signature); data.append('file',file);
 const response=await transport(destination,{method:'POST',body:data,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(90000)});
 if(!response.ok) throw new Error('No pudimos confirmar el envío de la imagen. Verificá la carga antes de volver a enviarla.');
 // Solo NestJS verifica y confirma el recurso; no se confía en la URL del proveedor.
}
