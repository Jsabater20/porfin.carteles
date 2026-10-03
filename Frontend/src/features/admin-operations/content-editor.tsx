'use client';
import Link from 'next/link';
import {useState,useEffect} from 'react';
import type {ContentInput,ContentIndex} from '@/lib/contracts/admin-operations';
import type {AdminProduct} from '@/lib/contracts/admin-catalog';
import type {PublicPage} from '@/lib/contracts/catalog';
import {Field,Section,RowTools,Confirm} from '@/features/admin-catalog/controls';
import {moved,sameValue} from '@/features/admin-catalog/model';
import {useOperation,useUnsaved} from './use-operation';
import {validateContent} from './model';
export function editablePage(index:ContentIndex,page:ContentInput['page']):ContentInput {
 const p=index.pages.find(p=>p.page===page);
 return {page,title:p?.title??'',subtitle:p?.subtitle??'',body:p?.body??'',sections:p?.sections??[],faqItems:p?.faqItems??[],published:p?.published??false,...(page==='home'?{featuredProductIds:index.featuredProductIds}:{})};
}
export function ContentEditor({initial}:{initial:ContentInput}) {
 const op=useOperation(),[draft,setDraft]=useState(initial),[baseline,setBaseline]=useState(initial);
 useUnsaved(!sameValue(draft,baseline));
 const adopt=(data:ContentInput)=>{setDraft(data);setBaseline(data);};
 async function reload(){adopt(editablePage(await op.manager.request<ContentIndex>('admin/content'),'home'));}
 async function save(){
 const next={...draft,page:'home' as const,published:true};const errors=validateContent(next);if(errors.length)throw new Error(errors.join(' '));
 const patch=Object.fromEntries(Object.entries(next).filter(([key,value])=>key!=='page'&&!sameValue(value,baseline[key as keyof ContentInput])));
 if(!Object.keys(patch).length){op.setMessage('No hay cambios para guardar.');return;}
 const current=editablePage(await op.manager.request<ContentIndex>('admin/content'),'home');
 if(Object.keys(patch).some(key=>!sameValue(current[key as keyof ContentInput],baseline[key as keyof ContentInput])))throw new Error('La página cambió desde que la abriste. Recargá sus datos antes de guardar.');
 const saved=await op.manager.request<ContentInput>('admin/content',{method:'PATCH',body:{page:'home',...patch}});
 adopt(editablePage({pages:[saved],availablePages:['home'],featuredProductIds:saved.featuredProductIds??[]},'home'));op.setMessage('Inicio actualizado.');
 }
 return <><header className="editor-heading"><div><p className="eyebrow">Página principal</p><h1>Editar inicio</h1><p className="muted">Cambiá lo que ven las personas cuando entran a la tienda.</p></div><Link className="text-link" target="_blank" href="/">Ver inicio ↗</Link></header>
 {op.message&&<p className="notice" role="alert">{op.message}</p>}
 <form method="post" onSubmit={e=>{e.preventDefault();void op.run(save);}}><fieldset className="editor-fields" disabled={op.disabled}>
 <Section title="Portada"><Field id="content-title" label="Título principal" hint="Es el texto grande que aparece al abrir la página." value={draft.title} onChange={title=>setDraft({...draft,title})}/><Field id="content-subtitle" label="Texto debajo del título" hint="Una frase corta para explicar qué ofrece el emprendimiento." value={draft.subtitle} onChange={subtitle=>setDraft({...draft,subtitle})}/></Section>
 <Section title="Aviso o promoción"><p className="muted">Es opcional. Podés usarlo para contar una promoción, una novedad o una fecha especial. Si queda vacío, no aparece.</p><Field id="content-body" label="Mensaje" value={draft.body} onChange={body=>setDraft({...draft,body})} multiline/></Section>
 <FeaturedEditor value={draft.featuredProductIds??[]} onChange={featuredProductIds=>setDraft({...draft,featuredProductIds})}/>
 <div className="editor-save"><button className="button" type="submit">Guardar cambios en el inicio</button><Confirm label="Descartar cambios" question="¿Descartar los cambios y volver a cargar el inicio?" disabled={op.disabled} onConfirm={()=>op.run(reload)}/></div></fieldset></form></>;
}
function FeaturedEditor({value,onChange}:{value:string[];onChange:(ids:string[])=>void}) {
 const {manager}=useOperation(),[q,setQ]=useState(''),[items,setItems]=useState<AdminProduct[]>([]),[names,setNames]=useState<Record<string,string>>({}),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void Promise.all(value.map(async id=>{try{const p=await manager.request<AdminProduct>('admin/products/'+id);return [id,p.name+(p.status!=='PUBLISHED'?' (no publicado)':'')] as const;}catch{return [id,'Producto no disponible'] as const;}})).then(entries=>{if(alive)setNames(Object.fromEntries(entries));});return()=>{alive=false;};},[value,manager]);
 useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>{void manager.request<PublicPage<AdminProduct>>('admin/products',{query:new URLSearchParams({status:'PUBLISHED',q:q.slice(0,120),limit:'12'}),signal:c.signal}).then(r=>{if(!c.signal.aborted){setItems(r.items.filter(p=>p.variants.some(v=>v.active)));setError('');}}).catch(()=>{if(!c.signal.aborted)setError('No pudimos buscar productos.');});},300);return()=>{clearTimeout(timer);c.abort();};},[q,manager]);
 return <Section title="Productos destacados"><p className="muted">Elegí los productos que querés mostrar en la página principal. Podés cambiar su orden o quitarlos cuando quieras.</p>{!value.length&&<p className="notice">Todavía no elegiste productos destacados.</p>}{value.map((id,i)=><div className="collection-row" key={id}><strong>{names[id]??'Cargando producto…'}</strong><RowTools index={i} count={value.length} name={'destacado '+(i+1)} move={delta=>onChange(moved(value,i,delta))} remove={()=>onChange(value.filter(x=>x!==id))}/></div>)}
 <Field id="featured-search" label="Buscar un producto para agregar" hint="Escribí parte del nombre del producto." value={q} onChange={setQ}/>{error&&<p role="alert" className="field-error">{error}</p>}<div className="reference-results">{items.filter(p=>!value.includes(p.id)).map(p=><button key={p.id} type="button" className="text-button" disabled={value.length>=12} onClick={()=>onChange([...value,p.id])}>Agregar {p.name}</button>)}</div></Section>;
}
