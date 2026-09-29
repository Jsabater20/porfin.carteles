'use client';
import { useRef,useState,useEffect } from 'react';
import { useAdmin } from '@/features/auth/admin-provider';
import { useEditorReady } from '@/features/admin-catalog/controls';
export function useOperation() {
 const {manager,loggingOut,session}=useAdmin(),ready=useEditorReady();
 const lock=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action:()=>Promise<void>){if(lock.current||loggingOut||!ready)return;lock.current=true;setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'No pudimos confirmar la operación. Revisá los datos antes de repetirla.');}finally{lock.current=false;setBusy(false);}}
 return {manager,session,run,busy,disabled:busy||loggingOut||!ready,message,setMessage};
}
export function useUnsaved(dirty:boolean) {
 useEffect(()=>{if(!dirty)return;const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};const leave=(e:MouseEvent)=>{const a=(e.target as HTMLElement).closest('a');if(a&&a.target!=='_blank'&&a.href!==location.href&&!window.confirm('Hay cambios sin guardar. ¿Querés salir?'))e.preventDefault();};window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};},[dirty]);
}
