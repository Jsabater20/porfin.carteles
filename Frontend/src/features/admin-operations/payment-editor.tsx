'use client';
import { useState } from 'react';
import type { AdminOrder,PaymentSummary,PaymentInput } from '@/lib/contracts/admin-operations';
import { Field,Section,useEditorReady } from '@/features/admin-catalog/controls';
import { moneyToCents } from '@/features/admin-catalog/model';
import { ApiError } from '@/lib/api/errors';
import { money,timestamp,validText } from './model';
import { useOperation } from './use-operation';
import { readAttempt,prepareAttempt,attemptStorageKey,type PaymentAttempt } from './payment-attempt';
export function PaymentEditor(props:{order:AdminOrder;summary:PaymentSummary;refresh:()=>Promise<void>}) {
 const ready=useEditorReady();
 return ready?<LoadedPaymentEditor {...props}/>:<Section title="Cobros y devoluciones"><p role="status">Verificando registros pendientes…</p></Section>;
}
function LoadedPaymentEditor({order,summary,refresh}:{order:AdminOrder;summary:PaymentSummary;refresh:()=>Promise<void>}) {
 const op=useOperation(),[type,setType]=useState<'CHARGE'|'REFUND'>('CHARGE'),[amount,setAmount]=useState(''),[method,setMethod]=useState('TRANSFER'),[reference,setReference]=useState('');
 const key=attemptStorageKey(op.session!.admin.id,order.id),active=order.quotes.filter(q=>q.status==='ACCEPTED').sort((a,b)=>b.version-a.version)[0];
 const [journal]=useState(()=>{try{return {pending:readAttempt(sessionStorage,key),error:''};}catch(e){return {pending:null,error:e instanceof Error?e.message:'El almacenamiento no está disponible.'};}});
 const [pending,setPending]=useState<PaymentAttempt|null>(journal.pending),[storageError,setStorageError]=useState(journal.error),[review,setReview]=useState<PaymentInput|null>(null);
 const disabled=op.disabled||!!storageError;
 async function record(input:PaymentInput) {
  let attempt:PaymentAttempt;
  try{attempt=await prepareAttempt(sessionStorage,key,input);}catch(e){throw new Error(e instanceof Error?e.message:'No se pudo conservar la referencia del intento.');}
  setPending(attempt);
  try{await op.manager.request('admin/payments',{method:'POST',body:input,idempotencyKey:attempt.key});}
  catch(e){if(e instanceof ApiError&&([400,404,422].includes(e.status)||(e.status===409&&!e.message.toLowerCase().includes('idempotencia')))){sessionStorage.removeItem(key);setPending(null);setReview(null);}throw e;}
  // Limpiar solo tras respuesta confirmada; un fallo de lectura posterior no repite el pago.
  try{sessionStorage.removeItem(key);}catch{setStorageError('Movimiento registrado. No se pudo limpiar su referencia local; no vuelvas a registrarlo.');}
  setPending(null);setReview(null);setAmount('');setReference('');op.setMessage('Movimiento registrado.');await refresh();
 }
 return <Section title="Cobros y devoluciones"><p>Registro manual de movimientos ya realizados. Esta pantalla no transfiere dinero ni ejecuta devoluciones bancarias.</p>
 <dl className="operation-facts"><div><dt>Total acordado</dt><dd>{money(summary.quoteTotalCents)}</dd></div><div><dt>Cobrado</dt><dd>{money(summary.chargedCents)}</dd></div><div><dt>Devuelto</dt><dd>{money(summary.refundedCents)}</dd></div><div><dt>Saldo cobrado</dt><dd>{money(summary.balanceCents)}</dd></div><div><dt>Pendiente de cobro</dt><dd>{money(summary.outstandingCents)}</dd></div><div><dt>Estado de pago</dt><dd>{{PENDING:'Pendiente',PARTIAL:'Parcial',PAID:'Pagado'}[summary.paymentStatus]}</dd></div></dl>
 {op.message&&<p role="alert" className="notice">{op.message}</p>}{storageError&&<p role="alert" className="notice">{storageError}</p>}
 {pending&&<p className="notice">Hay un registro pendiente de confirmar en esta pestaña. Conservamos su clave. Reingresá los mismos datos para verificarlo; no lo registres desde otra pestaña.</p>}
 {!active&&!pending?<p className="notice">Aceptá un presupuesto antes de registrar movimientos.</p>:review?<div className="notice"><p>{review.type==='CHARGE'?'Cobro':'Devolución'} de <strong>{money(review.amountCents)}</strong>, medio {review.method}. Referencia: {review.reference||'sin referencia'}.</p><p>Confirmá únicamente si el movimiento ya se realizó.</p><div className="actions"><button className="button payment-confirm" disabled={disabled} onClick={()=>void op.run(()=>record(review))}>{pending?'Verificar mismo movimiento':'Confirmar registro'}</button><button className="text-button" disabled={disabled} onClick={()=>setReview(null)}>Volver a los datos</button></div></div>:
 <form method="post" onSubmit={e=>{e.preventDefault();const cents=moneyToCents(amount);if(cents===null||cents<1||!validText(method,50,1)||!validText(reference,160)){op.setMessage('Revisá el importe positivo (hasta 10.000.000 ARS), medio (50) y referencia (160 caracteres).');return;}if(!pending&&type==='CHARGE'&&order.status==='CANCELLED'){op.setMessage('El pedido cancelado solo admite devoluciones.');return;}const quoteId=pending?.quoteId??active?.id;if(!quoteId)return;setReview({orderId:order.id,quoteId,type,amountCents:cents,method:method.trim(),reference:reference.trim()});op.setMessage('');}}><fieldset className="editor-fields" disabled={disabled}><div className="editor-grid">
 <label className="custom-field">Movimiento<select id="payment-type" value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="CHARGE">Cobro</option><option value="REFUND">Devolución</option></select></label>
 <Field id="payment-amount" label="Importe ARS *" value={amount} onChange={setAmount}/><Field id="payment-method" label="Medio *" value={method} onChange={setMethod} hint="Por ejemplo: TRANSFER o efectivo."/><Field id="payment-reference" label="Referencia" value={reference} onChange={setReference}/></div><button type="submit" className="button">Revisar movimiento</button></fieldset></form>}
 <h3>Movimientos registrados</h3>{!summary.movements.length?<p>Sin movimientos.</p>:<ol className="event-list">{summary.movements.map(m=><li key={m.id}><strong>{m.type==='CHARGE'?'Cobro':'Devolución'} · {money(m.amountCents)}</strong><p>{timestamp(m.occurredAt)} · {m.method} · {m.reference||'Sin referencia'}</p><details><summary>Identificación del registro</summary><p>Movimiento: {m.id}</p><p>Administrador: {m.administratorId}</p></details></li>)}</ol>}
 </Section>;
}
