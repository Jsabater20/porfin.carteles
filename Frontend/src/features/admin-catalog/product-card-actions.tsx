'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Confirm } from './controls';
import type { ProductStatus } from '@/lib/contracts/admin-catalog';
import { useOperation } from '@/features/admin-operations/use-operation';

export function ProductCardActions({id,status}:{id:string;status:ProductStatus}) {
 const router=useRouter(),op=useOperation();
 const setStatus=(next:ProductStatus)=>op.run(async()=>{await op.manager.request('admin/products/'+id,{method:'PATCH',body:{status:next}});op.setMessage(next==='PUBLISHED'?'Producto publicado.':'Producto oculto.');router.refresh();});
 const remove=()=>op.run(async()=>{
   let hidden=status==='HIDDEN';
   try {
     if(!hidden){await op.manager.request('admin/products/'+id,{method:'PATCH',body:{status:'HIDDEN'}});hidden=true;}
     await op.manager.request('admin/products/'+id,{method:'DELETE',body:{}});
     router.refresh();
   } catch(error) {
     if(hidden&&status!=='HIDDEN'){try{await op.manager.request('admin/products/'+id,{method:'PATCH',body:{status}});}catch{} }
     throw error;
   }
 });
 return <div className="admin-product-card-controls">
   <div className="admin-product-card-actions">
     <Link href={'/admin/productos/'+id}>Editar ficha <span aria-hidden="true">→</span></Link>
     <Link href={'/admin/productos/'+id+'/imagenes'}>Imágenes <span aria-hidden="true">→</span></Link>
   </div>
   <div className="admin-product-visibility">
     {status==='PUBLISHED'?<button className="text-button" disabled={op.disabled} onClick={()=>void setStatus('HIDDEN')}>Ocultar</button>:<button className="text-button" disabled={op.disabled} onClick={()=>void setStatus('PUBLISHED')}>Publicar</button>}
     <Confirm label="Eliminar" disabled={op.disabled} question="¿Eliminar este producto definitivamente? Sus imágenes también se quitarán." onConfirm={remove}/>
   </div>
   {op.message&&<p className="admin-card-message" role="alert">{op.message}</p>}
 </div>;
}
