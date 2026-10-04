'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ManualOrderInput, OrderListItem, OrderStatus } from '@/lib/contracts/admin-operations';
import { ORDER_LABELS, ORDER_NEXT } from './model';
import { useOperation } from './use-operation';
import { argentinaDate } from '@/features/orders/validation';

const WEEKDAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const iso=(date:Date)=>date.toISOString().slice(0,10);
const emptyManual=(date:string):ManualOrderInput=>({customerName:'',customerEmail:'',customerPhone:'',scheduledDate:date,description:'',deliveryMethod:'TO_CONFIRM',status:'PENDING_CONFIRMATION',notes:''});

export function OrdersCalendar({initialItems,from,to,monthLabel,previousMonth,nextMonth}:{initialItems:OrderListItem[];from:string;to:string;monthLabel:string;previousMonth:string;nextMonth:string}) {
 const router=useRouter(),op=useOperation(),[items,setItems]=useState(initialItems),[selectedId,setSelectedId]=useState<string|null>(null),[manualOpen,setManualOpen]=useState(false),[manual,setManual]=useState(()=>emptyManual(from));
 const [scheduledDate,setScheduledDate]=useState(''),[nextStatus,setNextStatus]=useState<OrderStatus|''>(''),[reason,setReason]=useState('');
 const selected=items.find(item=>item.id===selectedId)??null;
 const today=argentinaDate(),todayMonth=today.slice(0,7);
 const days=useMemo(()=>{
   const start=new Date(from+'T00:00:00Z'),leading=(start.getUTCDay()+6)%7,gridStart=new Date(start),result:{date:string;currentMonth:boolean}[]=[];
   gridStart.setUTCDate(gridStart.getUTCDate()-leading);
   for(let i=0;i<42;i++){const date=new Date(gridStart);date.setUTCDate(gridStart.getUTCDate()+i);const value=iso(date);result.push({date:value,currentMonth:value>=from&&value<=to});}
   return result;
 },[from,to]);
 const byDay=useMemo(()=>{const grouped=new Map<string,OrderListItem[]>();for(const item of items){const key=item.scheduledDate.slice(0,10),day=grouped.get(key)??[];day.push(item);grouped.set(key,day);}return grouped;},[items]);
 const choose=(item:OrderListItem)=>{setSelectedId(item.id);setScheduledDate(item.scheduledDate.slice(0,10));setNextStatus('');setReason('');};
 const openManual=(date:string)=>{setManual(current=>({...current,scheduledDate:date}));setManualOpen(true);setSelectedId(null);requestAnimationFrame(()=>document.querySelector('.manual-order-form')?.scrollIntoView({behavior:'smooth',block:'start'}));};
 const reschedule=()=>op.run(async()=>{if(!selected||!scheduledDate)throw new Error('Elegí una fecha de entrega.');await op.manager.request('admin/orders/'+selected.id+'/schedule',{method:'PATCH',body:{scheduledDate}});setItems(current=>current.map(item=>item.id===selected.id?{...item,scheduledDate}:item).filter(item=>item.scheduledDate.slice(0,10)>=from&&item.scheduledDate.slice(0,10)<=to));op.setMessage('Fecha de entrega actualizada.');router.refresh();});
 const changeStatus=()=>op.run(async()=>{if(!selected||!nextStatus)throw new Error('Elegí el nuevo estado.');if(nextStatus==='CANCELLED'&&!reason.trim())throw new Error('Indicá el motivo de cancelación.');await op.manager.request('admin/orders/'+selected.id+'/status',{method:'PATCH',body:{status:nextStatus,reason:reason.trim()}});setItems(current=>current.map(item=>item.id===selected.id?{...item,status:nextStatus}:item));setNextStatus('');setReason('');op.setMessage('Estado actualizado.');router.refresh();});
 const createManual=()=>op.run(async()=>{
   if(!manual.customerName.trim()||!manual.description.trim()||!manual.scheduledDate)throw new Error('Completá cliente, pedido y fecha de entrega.');
   await op.manager.request('admin/orders/manual',{method:'POST',body:{...manual,customerName:manual.customerName.trim(),description:manual.description.trim(),...(manual.customerEmail?.trim()?{customerEmail:manual.customerEmail.trim()}:{customerEmail:undefined}),...(manual.customerPhone?.trim()?{customerPhone:manual.customerPhone.trim()}:{customerPhone:undefined}),...(manual.notes?.trim()?{notes:manual.notes.trim()}:{notes:undefined})}});
   setManual(emptyManual(from));setManualOpen(false);op.setMessage('Pedido agregado a la agenda.');router.refresh();
 });
 const setManualField=<K extends keyof ManualOrderInput>(key:K,value:ManualOrderInput[K])=>setManual(current=>({...current,[key]:value}));
 return <>
   <header className="orders-heading"><div><p className="eyebrow">Agenda de entregas</p><h1>Pedidos</h1><p className="muted">Cada pedido aparece en el día previsto y muestra si está confirmado y en qué etapa se encuentra.</p></div><button className="button" onClick={()=>setManualOpen(value=>!value)}>{manualOpen?'Cerrar formulario':'Agregar pedido'}</button></header>
   {manualOpen&&<section className="manual-order-form" aria-labelledby="manual-order-title"><h2 id="manual-order-title">Nuevo pedido recibido por otro medio</h2><p className="muted">Usalo para encargos que llegaron por WhatsApp, Instagram, teléfono o en persona.</p><fieldset className="editor-fields" disabled={op.disabled}>
     <div className="editor-grid"><label>Cliente *<input value={manual.customerName} maxLength={120} onChange={event=>setManualField('customerName',event.target.value)}/></label><label>Fecha de entrega *<input type="date" value={manual.scheduledDate} onChange={event=>setManualField('scheduledDate',event.target.value)}/></label><label>Mail<input type="email" value={manual.customerEmail??''} onChange={event=>setManualField('customerEmail',event.target.value)}/></label><label>Teléfono<input type="tel" value={manual.customerPhone??''} onChange={event=>setManualField('customerPhone',event.target.value)}/></label><label>Confirmación<select value={manual.status} onChange={event=>setManualField('status',event.target.value as ManualOrderInput['status'])}><option value="PENDING_CONFIRMATION">A espera de confirmación</option><option value="CONFIRMED">Confirmado</option></select></label><label>Entrega<select value={manual.deliveryMethod} onChange={event=>setManualField('deliveryMethod',event.target.value as ManualOrderInput['deliveryMethod'])}><option value="TO_CONFIRM">Sin definir</option><option value="PICKUP">A coordinar (Santa Fe Capital)</option><option value="SHIPPING">Envío por correo</option></select></label></div>
     <label>¿Qué pidió? *<textarea rows={3} maxLength={500} value={manual.description} onChange={event=>setManualField('description',event.target.value)} placeholder="Ej.: cartel de recibida para Medicina, diseño azul..."/></label><label>Notas internas<textarea rows={3} maxLength={1000} value={manual.notes??''} onChange={event=>setManualField('notes',event.target.value)}/></label><button className="button" type="button" onClick={()=>void createManual()}>Guardar en la agenda</button>
   </fieldset></section>}
   {op.message&&<p className="notice" role="alert">{op.message}</p>}
   <nav className="calendar-navigation" aria-label="Cambiar mes"><div className="calendar-navigation-actions"><Link className="calendar-today" href={'/admin/pedidos?mes='+todayMonth}>Hoy</Link><Link className="calendar-arrow" aria-label="Mes anterior" title="Mes anterior" href={'/admin/pedidos?mes='+previousMonth}>‹</Link><Link className="calendar-arrow" aria-label="Mes siguiente" title="Mes siguiente" href={'/admin/pedidos?mes='+nextMonth}>›</Link></div><h2>{monthLabel}</h2><div className="calendar-legend" aria-label="Referencias"><span><i data-status="PENDING_CONFIRMATION"/>Por confirmar</span><span><i data-status="CONFIRMED"/>Confirmados</span><span><i data-status="IN_PRODUCTION"/>En proceso</span></div></nav>
   <div className="calendar-frame"><div className="order-calendar" role="grid" aria-label={'Pedidos de '+monthLabel}>
     {WEEKDAYS.map(day=><div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
     {days.map(day=><div className={'calendar-day'+(!day.currentMonth?' outside':'')+(day.date===today?' today':'')} role="gridcell" key={day.date}><button className="calendar-day-number" type="button" onClick={()=>openManual(day.date)} aria-label={'Agregar pedido para el '+day.date}>{Number(day.date.slice(-2))}<span aria-hidden="true">+</span></button><div className="calendar-events">{(byDay.get(day.date)??[]).map(item=><button className="calendar-order" data-status={item.status} key={item.id} type="button" onClick={()=>choose(item)} aria-label={`${item.customerName}: ${ORDER_LABELS[item.status]}`}><strong>{item.customerName}</strong><span>{ORDER_LABELS[item.status]}</span><small>{item.source==='MANUAL'?'Carga manual':item.reference}</small></button>)}</div></div>)}
   </div></div>
   {selected&&<aside className="calendar-order-editor" aria-label={'Editar '+selected.customerName}><div><p className="eyebrow">{selected.reference}</p><h2>{selected.customerName}</h2><p><span className="order-status-badge" data-status={selected.status}>{ORDER_LABELS[selected.status]}</span> · {selected.source==='MANUAL'?'Pedido cargado manualmente':'Pedido de la página'}</p></div><button className="text-button" onClick={()=>setSelectedId(null)}>Cerrar</button>
     <div className="calendar-editor-grid"><div><label>Fecha de entrega<input type="date" value={scheduledDate} onChange={event=>setScheduledDate(event.target.value)}/></label><button className="button button-secondary" disabled={op.disabled||scheduledDate===selected.scheduledDate.slice(0,10)} onClick={()=>void reschedule()}>Cambiar fecha</button></div><div><label>Nuevo estado<select value={nextStatus} onChange={event=>setNextStatus(event.target.value as OrderStatus|'')}><option value="">Elegir estado</option>{ORDER_NEXT[selected.status].map(status=><option value={status} key={status}>{ORDER_LABELS[status]}</option>)}</select></label>{nextStatus==='CANCELLED'&&<label>Motivo<input maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label>}<button className="button button-secondary" disabled={op.disabled||!nextStatus} onClick={()=>void changeStatus()}>Guardar estado</button></div></div>
     <Link className="text-link" href={'/admin/pedidos/'+selected.id}>Abrir pedido completo</Link>
   </aside>}
 </>;
}
