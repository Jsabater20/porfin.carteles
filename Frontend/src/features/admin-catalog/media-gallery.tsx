'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAdmin } from '@/features/auth/admin-provider';
import { ApiError } from '@/lib/api/errors';
import type { CatalogImage, CatalogShape } from '@/lib/contracts/catalog';
import type { UploadAuthorization } from '@/lib/contracts/admin-catalog';
import { ProductImage } from '@/features/catalog/product-image';
import { Field, Confirm, useEditorReady } from './controls';
import { moved } from './model';
import { validateImage, uploadImage } from './upload';
const IMAGE_SHAPES: Record<CatalogShape, string> = { RECTANGULAR: 'Rectangular', CIRCULAR: 'Circular', XXL: 'XXL' };
export function MediaGallery({productId,name,initialImages}:{productId:string;name:string;initialImages:CatalogImage[]}) {
 const ready=useEditorReady();
 const {manager,loggingOut}=useAdmin();
 const [images,setImages]=useState(initialImages), [pending,setPending]=useState<UploadAuthorization|null>(null);
 const [alt,setAlt]=useState(''),[shape,setShape]=useState<CatalogShape|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false), fileInput=useRef<HTMLInputElement>(null);
 const base='admin/products/'+productId+'/images';
 const refresh=async()=>{setImages(await manager.request<CatalogImage[]>(base));};
 useEffect(()=>{if(!pending) return; const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';}; const leave=(e:MouseEvent)=>{const a=(e.target as HTMLElement).closest('a');if(a&&a.target!=='_blank'&&a.pathname!==location.pathname&&!window.confirm('Hay una carga pendiente. Cancelala o verificala antes de salir. ¿Querés salir igualmente?'))e.preventDefault();};window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};},[pending]);
 async function run(action:()=>Promise<void>) {if(lock.current||loggingOut)return;lock.current=true;setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'No pudimos confirmar la operación. Actualizá la galería antes de repetirla.');}finally{lock.current=false;setBusy(false);}}
 async function complete(auth:UploadAuthorization) {
  const image=await manager.request<CatalogImage>('admin/media/complete',{method:'POST',body:{uploadId:auth.uploadId,altText:alt.trim(),shape}});
  setPending(null);setAlt('');setShape(null);if(fileInput.current)fileInput.current.value='';
  setImages(current=>[...current.filter(i=>i.id!==image.id),image].sort((a,b)=>a.position-b.position));
  setMessage('Imagen confirmada.');await refresh();
 }
 async function upload() {
  const file=fileInput.current?.files?.[0];if(!file){setMessage('Elegí una imagen.');return;}
  const error=validateImage(file);if(error){setMessage(error);return;}if(alt.trim().length>240){setMessage('La descripción debe tener hasta 240 caracteres.');return;}
  await run(async()=>{
   const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('No pudimos abrir esta imagen. Revisá el archivo.');});
   const pixels=bitmap.width*bitmap.height;bitmap.close();if(pixels>40000000)throw new Error('La imagen debe tener hasta 40 millones de píxeles.');
   let auth:UploadAuthorization;
   try{auth=await manager.request<UploadAuthorization>('admin/media/upload-signature',{method:'POST',body:{productId}});}catch(e){if(e instanceof ApiError&&e.status===503)throw new Error('Las cargas de imágenes no están disponibles por el momento.');throw e;}
   setPending(auth);setMessage('Enviando imagen…');
   await uploadImage(auth,file);
   setMessage('Verificando imagen…');await complete(auth);
  });
 }
 return <><header className="editor-heading"><div><p className="eyebrow">{name}</p><h1>Imágenes del producto</h1></div><Link className="text-link" href={'/admin/productos/'+productId}>Volver al producto</Link></header>
 <p className="muted">La primera imagen es la portada. Podés cargar hasta 12 imágenes JPG, PNG o WebP de hasta 5 MiB y 40 millones de píxeles.</p>
 {message&&<p role="status" className="notice">{message}</p>}
 <fieldset className="editor-section editor-fields" disabled={busy||loggingOut||!ready}><legend>Agregar imagen</legend>
 <div className="custom-field"><label htmlFor="image-file">Archivo</label><input id="image-file" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={!!pending||images.length>=12}/></div>
 <Field id="image-alt" label="Descripción de la imagen" value={alt} onChange={setAlt} hint="Describí lo que se ve para quienes usan lectores de pantalla."/>
 <div className="custom-field"><label htmlFor="image-shape">Forma que muestra</label><select id="image-shape" value={shape??''} onChange={event=>setShape(event.target.value?event.target.value as CatalogShape:null)}><option value="">No corresponde</option>{Object.entries(IMAGE_SHAPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small className="muted">En carteles, elegí la forma que aparece en la foto para que los filtros muestren la imagen correcta.</small></div>
 {pending?<div className="notice"><p>Hay una carga pendiente de confirmar. Si se interrumpió el envío, verificá primero si llegó. Si no llegó, cancelala y elegí nuevamente el archivo.</p><div className="actions"><button className="button" type="button" onClick={()=>void run(()=>complete(pending))}>Verificar carga</button><Confirm label="Cancelar carga" question="¿Cancelar la carga pendiente?" onConfirm={()=>run(async()=>{try{await manager.request('admin/media/uploads/'+pending.uploadId,{method:'DELETE',body:{}});}catch(e){if(!(e instanceof ApiError&&e.status===409))throw e;setMessage('La imagen ya estaba confirmada.');}setPending(null);if(fileInput.current)fileInput.current.value='';await refresh();})}/></div></div>
 :<button type="button" className="button" disabled={images.length>=12} onClick={()=>void upload()}>{busy?'Procesando…':'Cargar imagen'}</button>}
 </fieldset>
 <button className="text-button" disabled={busy} onClick={()=>void run(refresh)}>Actualizar galería</button>
 {!images.length&&<p className="notice">Este producto todavía no tiene imágenes.</p>}
 <div className="admin-gallery">{images.map((item,index)=><ImageEditor key={item.id+':'+item.altText} image={item} name={name} index={index} count={images.length} disabled={busy||loggingOut||!ready}
 save={value=>run(async()=>{if(value.altText.trim().length>240)throw new Error('La descripción debe tener hasta 240 caracteres.');await manager.request(base+'/'+item.id,{method:'PATCH',body:{altText:value.altText.trim(),shape:value.shape}});await refresh();setMessage('Datos de la imagen guardados.');})}
 move={delta=>run(async()=>{setImages(await manager.request<CatalogImage[]>(base+'/order',{method:'PATCH',body:{imageIds:moved(images,index,delta).map(i=>i.id)}}));setMessage('Orden guardado.');})}
 remove={()=>run(async()=>{await manager.request(base+'/'+item.id,{method:'DELETE',body:{}});await refresh();setMessage('Imagen eliminada de la galería.');})}/>)}</div></>;
}
function ImageEditor({image,name,index,count,disabled,save,move,remove}:{image:CatalogImage;name:string;index:number;count:number;disabled:boolean;save:(value:{altText:string;shape:CatalogShape|null})=>Promise<void>;move:(delta:number)=>Promise<void>;remove:()=>Promise<void>}) {
 const [alt,setAlt]=useState(image.altText),[shape,setShape]=useState<CatalogShape|null>(image.shape??null);
 return <article className="panel-card"><ProductImage image={image} name={name} sizes="(max-width: 700px) 90vw, 320px"/><h2>{index===0?'Portada':'Imagen '+(index+1)}</h2><fieldset disabled={disabled} className="editor-fields"><Field id={'alt-'+image.id} label="Descripción" value={alt} onChange={setAlt}/><div className="custom-field"><label htmlFor={'shape-'+image.id}>Forma que muestra</label><select id={'shape-'+image.id} value={shape??''} onChange={event=>setShape(event.target.value?event.target.value as CatalogShape:null)}><option value="">No corresponde</option>{Object.entries(IMAGE_SHAPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><button className="text-button" disabled={alt===image.altText&&shape===(image.shape??null)} onClick={()=>void save({altText:alt,shape})}>Guardar datos</button><div className="actions"><button className="text-button" disabled={index===0} onClick={()=>void move(-1)}>Subir</button><button className="text-button" disabled={index===count-1} onClick={()=>void move(1)}>Bajar</button><Confirm label="Eliminar imagen" question="¿Eliminar esta imagen de la galería?" onConfirm={remove}/></div></fieldset></article>;
}
