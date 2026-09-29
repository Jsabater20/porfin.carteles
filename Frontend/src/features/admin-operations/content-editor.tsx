'use client';
import Link from 'next/link';
import {useState,useEffect} from 'react';
import type {ContentInput,ContentIndex} from '@/lib/contracts/admin-operations';
import type {AdminProduct} from '@/lib/contracts/admin-catalog';
import type {PublicPage} from '@/lib/contracts/catalog';
import {Field,Section,RowTools,Confirm} from '@/features/admin-catalog/controls';
import {moved,newKey,sameValue} from '@/features/admin-catalog/model';
import {useOperation,useUnsaved} from './use-operation';
import {PAGE_LABELS,validateContent} from './model';
export function editablePage(index:ContentIndex,page:ContentInput['page']):ContentInput {
 const p=index.pages.find(p=>p.page===page);
 return {page,title:p?.title??'',subtitle:p?.subtitle??'',body:p?.body??'',sections:p?.sections??[],faqItems:p?.faqItems??[],published:p?.published??false,...(page==='home'?{featuredProductIds:index.featuredProductIds}:{})};
}
export function ContentEditor({initial}:{initial:ContentInput}) {
 const op=useOperation(),[draft,setDraft]=useState(initial),[baseline,setBaseline]=useState(initial);
 useUnsaved(!sameValue(draft,baseline));
 const adopt=(data:ContentInput)=>{setDraft(data);setBaseline(data);};
 async function reload(){adopt(editablePage(await op.manager.request<ContentIndex>('admin/content'),draft.page));}
 async function save(){
 const errors=validateContent(draft);if(errors.length)throw new Error(errors.join(' '));
 const patch=Object.fromEntries(Object.entries(draft).filter(([key,value])=>key!=='page'&&!sameValue(value,baseline[key as keyof ContentInput])));
 if(!Object.keys(patch).length){op.setMessage('No hay cambios para guardar.');return;}
 const current=editablePage(await op.manager.request<ContentIndex>('admin/content'),draft.page);
 if(Object.keys(patch).some(key=>!sameValue(current[key as keyof ContentInput],baseline[key as keyof ContentInput])))throw new Error('La página cambió desde que la abriste. Recargá sus datos antes de guardar.');
 const saved=await op.manager.request<ContentInput>('admin/content',{method:'PATCH',body:{page:draft.page,...patch}});
 adopt(editablePage({pages:[saved],availablePages:[draft.page],featuredProductIds:saved.featuredProductIds??[]},draft.page));op.setMessage('Contenido guardado.');
 }
 return <><header className="editor-heading"><h1>Contenido · {PAGE_LABELS[draft.page]}</h1></header><nav className="actions" aria-label="Páginas editables">{Object.entries(PAGE_LABELS).map(([key,label])=><Link key={key} className="text-link" aria-current={key===draft.page?'page':undefined} href={'/admin/contenido?page='+key}>{label}</Link>)}</nav>
 {op.message&&<p className="notice" role="alert">{op.message}</p>}
 <form method="post" onSubmit={e=>{e.preventDefault();void op.run(save);}}><fieldset className="editor-fields" disabled={op.disabled}>
 <Section title="Texto y publicación"><p className="muted">Se publica como texto plano. No se interpreta HTML.</p><Field id="content-title" label="Título" value={draft.title} onChange={title=>setDraft({...draft,title})}/><Field id="content-subtitle" label="Subtítulo" value={draft.subtitle} onChange={subtitle=>setDraft({...draft,subtitle})}/><Field id="content-body" label="Texto principal" value={draft.body} onChange={body=>setDraft({...draft,body})} multiline/><label className="check-label"><input id="content-published" type="checkbox" checked={draft.published} onChange={e=>setDraft({...draft,published:e.target.checked})}/>Página publicada</label><p className="muted">Los cambios se aplican al guardar. Desmarcar retira el contenido de la tienda.</p></Section>
 <Section title="Secciones">{draft.sections.map((s,i)=><fieldset className="collection-row" key={s.key}><legend>Sección {i+1}</legend><Field id={'section-heading-'+i} label="Título de sección" value={s.heading} onChange={heading=>setDraft({...draft,sections:draft.sections.map((x,n)=>n===i?{...x,heading}:x)})}/><Field id={'section-text-'+i} label="Texto" value={s.text} onChange={text=>setDraft({...draft,sections:draft.sections.map((x,n)=>n===i?{...x,text}:x)})} multiline/><RowTools index={i} count={draft.sections.length} name={'sección '+(i+1)} move={delta=>setDraft({...draft,sections:moved(draft.sections,i,delta)})} remove={()=>setDraft({...draft,sections:draft.sections.filter((_,n)=>n!==i)})}/></fieldset>)}<button type="button" className="text-button" disabled={draft.sections.length>=20} onClick={()=>setDraft({...draft,sections:[...draft.sections,{key:newKey(),heading:'',text:''}]})}>Agregar sección</button></Section>
 <Section title="Preguntas y respuestas">{draft.faqItems.map((f,i)=><fieldset className="collection-row" key={f.key}><legend>Pregunta {i+1}</legend><Field id={'faq-question-'+i} label="Pregunta" value={f.question} onChange={question=>setDraft({...draft,faqItems:draft.faqItems.map((x,n)=>n===i?{...x,question}:x)})}/><Field id={'faq-answer-'+i} label="Respuesta" value={f.answer} onChange={answer=>setDraft({...draft,faqItems:draft.faqItems.map((x,n)=>n===i?{...x,answer}:x)})} multiline/><RowTools index={i} count={draft.faqItems.length} name={'pregunta '+(i+1)} move={delta=>setDraft({...draft,faqItems:moved(draft.faqItems,i,delta)})} remove={()=>setDraft({...draft,faqItems:draft.faqItems.filter((_,n)=>n!==i)})}/></fieldset>)}<button type="button" className="text-button" disabled={draft.faqItems.length>=30} onClick={()=>setDraft({...draft,faqItems:[...draft.faqItems,{key:newKey(),question:'',answer:''}]})}>Agregar pregunta</button></Section>
 {draft.page==='home'&&<FeaturedEditor value={draft.featuredProductIds??[]} onChange={featuredProductIds=>setDraft({...draft,featuredProductIds})}/>}
 <button className="button" type="submit">Guardar contenido</button></fieldset></form>
 <div className="editor-section actions"><Confirm label="Recargar contenido" question="¿Descartar los cambios locales y cargar el contenido actual?" disabled={op.disabled} onConfirm={()=>op.run(reload)}/><Link className="text-link" target="_blank" href={{home:'/',about:'/nosotros',contact:'/contacto',faq:'/preguntas-frecuentes'}[draft.page]}>Ver página pública</Link></div></>;
}
function FeaturedEditor({value,onChange}:{value:string[];onChange:(ids:string[])=>void}) {
 const {manager}=useOperation(),[q,setQ]=useState(''),[items,setItems]=useState<AdminProduct[]>([]),[names,setNames]=useState<Record<string,string>>({}),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void Promise.all(value.map(async id=>{try{const p=await manager.request<AdminProduct>('admin/products/'+id);return [id,p.name+(p.status!=='PUBLISHED'?' (no publicado)':'')] as const;}catch{return [id,'Producto no disponible'] as const;}})).then(entries=>{if(alive)setNames(Object.fromEntries(entries));});return()=>{alive=false;};},[value,manager]);
 useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>{void manager.request<PublicPage<AdminProduct>>('admin/products',{query:new URLSearchParams({status:'PUBLISHED',q:q.slice(0,120),limit:'12'}),signal:c.signal}).then(r=>{if(!c.signal.aborted){setItems(r.items.filter(p=>p.variants.some(v=>v.active)));setError('');}}).catch(()=>{if(!c.signal.aborted)setError('No pudimos buscar productos.');});},300);return()=>{clearTimeout(timer);c.abort();};},[q,manager]);
 return <Section title="Productos destacados"><p>Hasta 12 productos publicados con variantes activas. El orden se respeta en el inicio.</p>{value.map((id,i)=><div className="collection-row" key={id}><strong>{names[id]??'Cargando producto…'}</strong><RowTools index={i} count={value.length} name={'destacado '+(i+1)} move={delta=>onChange(moved(value,i,delta))} remove={()=>onChange(value.filter(x=>x!==id))}/></div>)}
 <Field id="featured-search" label="Buscar producto publicado" value={q} onChange={setQ}/>{error&&<p role="alert">{error}</p>}<ul>{items.filter(p=>!value.includes(p.id)).map(p=><li key={p.id}><button type="button" className="text-button" disabled={value.length>=12} onClick={()=>onChange([...value,p.id])}>Destacar {p.name}</button></li>)}</ul></Section>;
}
