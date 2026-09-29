import type { PaymentInput } from '../../lib/contracts/admin-operations';
export interface PaymentAttempt {key:string;fingerprint:string;quoteId:string}
export interface AttemptStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export const attemptStorageKey=(adminId:string,orderId:string)=>'porfin-payment-v1:'+adminId+':'+orderId;
export function readAttempt(storage:AttemptStorage,key:string):PaymentAttempt|null {
 const raw=storage.getItem(key);if(!raw)return null;
 try{const p=JSON.parse(raw);if(typeof p.key!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.key)||! /^[0-9a-f]{64}$/.test(p.fingerprint)||! /^c[a-z0-9]{24}$/.test(p.quoteId))throw new Error();return {key:p.key,fingerprint:p.fingerprint,quoteId:p.quoteId};}catch{throw new Error('El registro del intento pendiente no es válido. Revisá los movimientos antes de continuar con soporte.');}
}
export async function prepareAttempt(storage:AttemptStorage,key:string,input:PaymentInput):Promise<PaymentAttempt> {
 const bytes=new TextEncoder().encode(JSON.stringify([input.orderId,input.quoteId,input.type,input.amountCents,input.method,input.reference]));
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const previous=readAttempt(storage,key);
 if(previous){if(previous.fingerprint!==fingerprint)throw new Error('Hay un movimiento sin confirmar. Reingresá exactamente su tipo, importe, medio y referencia para verificarlo con la misma clave.');return previous;}
 const attempt={key:crypto.randomUUID(),fingerprint,quoteId:input.quoteId};
 storage.setItem(key,JSON.stringify(attempt));
 if(storage.getItem(key)!==JSON.stringify(attempt))throw new Error('No se pudo conservar el intento. Habilitá el almacenamiento de la pestaña antes de registrar pagos.');
 return attempt;
}
