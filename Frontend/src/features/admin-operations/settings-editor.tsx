'use client';
import {useState} from 'react';
import type {StoreInput} from '@/lib/contracts/admin-operations';
import {Field,Section,Confirm} from '@/features/admin-catalog/controls';
import {sameValue} from '@/features/admin-catalog/model';
import {useOperation,useUnsaved} from './use-operation';
import {SETTING_TEXT,SETTING_CONTACT,settingsInput,validateSettings} from './model';
export function SettingsEditor({initial}:{initial:StoreInput}) {
 const op=useOperation(),[draft,setDraft]=useState(initial),[baseline,setBaseline]=useState(initial);useUnsaved(!sameValue(draft,baseline));
 async function save(){const clean=settingsInput(draft);const errors=validateSettings(clean);if(errors.length)throw new Error(errors.join(' '));
 const patch=Object.fromEntries(Object.entries(clean).filter(([key,value])=>!sameValue(value,baseline[key as keyof StoreInput])));
 if(!Object.keys(patch).length){op.setMessage('No hay cambios para guardar.');return;}
 const current=settingsInput(await op.manager.request<StoreInput>('admin/settings'));
 if(Object.keys(patch).some(key=>!sameValue(current[key as keyof StoreInput],baseline[key as keyof StoreInput])))throw new Error('La configuración cambió. Recargá sus datos antes de guardar.');
 const saved=settingsInput(await op.manager.request<StoreInput>('admin/settings',{method:'PATCH',body:patch}));setDraft(saved);setBaseline(saved);op.setMessage('Configuración guardada.');}
 return <><h1>Configuración comercial</h1><p className="muted">Datos visibles de la tienda. Los cambios se aplican al guardar.</p>{op.message&&<p className="notice" role="alert">{op.message}</p>}
 <form method="post" onSubmit={e=>{e.preventDefault();void op.run(save);}}><fieldset className="editor-fields" disabled={op.disabled}>
 <Section title="Tienda y atención">{Object.entries(SETTING_TEXT).map(([key,[label,max]])=><Field key={key} id={'settings-'+key} label={label} value={draft[key as keyof typeof SETTING_TEXT]} hint={'Hasta '+max+' caracteres.'} onChange={value=>setDraft({...draft,[key]:value})} multiline={max>=1000}/>)}</Section>
 <Section title="Contacto y redes">{Object.entries(SETTING_CONTACT).map(([key,label])=><Field key={key} id={'settings-'+key} label={label} value={draft[key as keyof typeof SETTING_CONTACT]??''} onChange={value=>setDraft({...draft,[key]:value.trim()||null})}/>)}<p className="muted">Dejar vacío elimina el dato. El número de WhatsApp se usa en los pedidos nuevos; los pedidos anteriores conservan su destinatario.</p></Section>
 <Section title="Modalidades de entrega">{(['PICKUP','SHIPPING'] as const).map(m=><label className="check-label" key={m}><input type="checkbox" checked={draft.deliveryMethods.includes(m)} onChange={e=>setDraft({...draft,deliveryMethods:e.target.checked?[...draft.deliveryMethods,m]:draft.deliveryMethods.filter(x=>x!==m)})}/>{m==='PICKUP'?'Retiro':'Envío'}</label>)}<p className="muted">Sin modalidades seleccionadas, no se restringe la entrega. La disponibilidad y la fecha se coordinan directamente por WhatsApp.</p></Section>
 <button className="button" type="submit">Guardar configuración</button></fieldset></form>
 <div className="editor-section"><Confirm label="Recargar configuración" question="¿Descartar los cambios locales?" disabled={op.disabled} onConfirm={()=>op.run(async()=>{const current=settingsInput(await op.manager.request<StoreInput>('admin/settings'));setDraft(current);setBaseline(current);})}/></div></>;
}
