import {test} from 'node:test';
import assert from 'node:assert/strict';
import {date,timestamp,buildQuote,ORDER_NEXT,QUOTE_NEXT,validateContent} from '../src/features/admin-operations/model';
import {readAttempt,prepareAttempt,attemptStorageKey,type AttemptStorage} from '../src/features/admin-operations/payment-attempt';
import {routePolicy} from '../src/lib/api/policy';
import {forwardToBackend} from '../src/lib/api/gateway';
import type {ContentInput,PaymentInput} from '../src/lib/contracts/admin-operations';
import {argentinaHolidays} from '../src/features/admin-operations/argentina-holidays';
test('fechas de entrega y horarios se formatean de manera estable, incluso a medianoche',()=>{
 assert.equal(date('2026-10-29T00:00:00.000Z'),'29/10/2026');
 assert.equal(timestamp('2026-09-29T03:01:00.000Z'),'29/09/2026 00:01');
 assert.equal(timestamp('2026-09-29T02:59:00.000Z'),'28/09/2026 23:59');
});
const id='c123456789012345678901234';
const storage=()=>{const entries=new Map<string,string>();return {entries,getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>{entries.set(key,value);},removeItem:(key:string)=>{entries.delete(key);}};};
const payment:PaymentInput={orderId:id,quoteId:id,type:'CHARGE',amountCents:125050,method:'TRANSFER',reference:'recibo privado'};
test('transiciones no permiten saltos ni reabrir pedidos y revisiones terminales',()=>{
 assert.deepEqual(ORDER_NEXT.PENDING_CONFIRMATION,['CONFIRMED','CANCELLED']);assert.deepEqual(ORDER_NEXT.DELIVERED,[]);assert.deepEqual(ORDER_NEXT.CANCELLED,[]);
 assert.deepEqual(QUOTE_NEXT.DRAFT,['SENT','REJECTED']);assert.deepEqual(QUOTE_NEXT.ACCEPTED,[]);assert.deepEqual(QUOTE_NEXT.REJECTED,[]);
});
test('presupuesto convierte ARS a centavos, suma cantidades y no convierte vacíos de cotización en cero',()=>{
 const draft={items:[{productName:' Cartel ',description:'',quantity:'2',price:'1250,25'},{productName:'Envío',description:'',quantity:'1',price:'300'}],notes:''};
 const result=buildQuote(draft);assert.deepEqual(result.errors,[]);assert.equal(result.total,280050);assert.equal(result.input.items[0].unitPriceCents,125025);
 draft.items[0].price='';assert.ok(buildQuote(draft).errors.length);draft.items[0].price='0';assert.deepEqual(buildQuote(draft).errors,[]);
 draft.items[0].quantity='10001';assert.ok(buildQuote(draft).errors.length);assert.ok(buildQuote({items:[],notes:''}).errors.length);
});
test('recarga y pérdida de respuesta conservan clave; el registro no almacena importes ni referencias',async()=>{
 const s=storage(),key=attemptStorageKey('owner',id);const first=await prepareAttempt(s,key,payment);
 const serialized=s.getItem(key)!;assert.equal(serialized.includes('recibo privado'),false);assert.equal(serialized.includes('125050'),false);
 assert.deepEqual(readAttempt(s,key),first);const replay=await prepareAttempt(s,key,{...payment});assert.equal(replay.key,first.key);
 // Simular que el servidor grabó el primer movimiento pero se perdió su respuesta.
 const records=new Map<string,PaymentInput>();records.set(first.key,payment);records.set(replay.key,payment);assert.equal(records.size,1);
 await assert.rejects(prepareAttempt(s,key,{...payment,amountCents:payment.amountCents+1}),/mismos|exactamente/);
 await assert.rejects(prepareAttempt(s,key,{...payment,type:'REFUND'}),/mismos|exactamente/);
 s.removeItem(key);assert.notEqual((await prepareAttempt(s,key,payment)).key,first.key);
});
test('almacenamiento corrupto o bloqueado impide crear una clave de pago alternativa',async()=>{
 const s=storage();s.setItem('key','{broken');assert.throws(()=>readAttempt(s,'key'),/no es válido/);
 await assert.rejects(prepareAttempt(s,'key',payment));
 const blocked:AttemptStorage={getItem:()=>null,setItem:()=>{throw new Error('blocked');},removeItem:()=>{}};
 await assert.rejects(prepareAttempt(blocked,'key',payment),/blocked/);
 const silent:AttemptStorage={...blocked,setItem:()=>{}};await assert.rejects(prepareAttempt(silent,'key',payment),/conservar/);
 assert.notEqual(attemptStorageKey('owner',id),attemptStorageKey('admin',id));
});
const content:ContentInput={page:'faq',title:'Preguntas',subtitle:'',body:'',sections:[],faqItems:[],published:true};
test('publicación exige título y FAQ con preguntas completas; listas y claves se validan',()=>{
 assert.ok(validateContent(content).length);
 const valid={...content,faqItems:[{key:'fotos',question:'¿Fotos?',answer:'Por WhatsApp.'}]};assert.deepEqual(validateContent(valid),[]);
 assert.ok(validateContent({...valid,title:''}).length);assert.ok(validateContent({...valid,faqItems:[...valid.faqItems,...valid.faqItems]}).length);
 assert.ok(validateContent({...valid,featuredProductIds:[id]}).length);
 assert.deepEqual(validateContent({...valid,body:'<script>alert(1)</script>'}),[],'El texto plano se conserva; React lo escapa.');
});
test('rutas privadas de operación aceptan solo sus métodos exactos',()=>{
 for(const [path,method] of [['admin/orders','GET'],['admin/orders/calendar','GET'],['admin/orders/manual','POST'],['admin/calendar-integration/status','GET'],['admin/calendar-integration/google/start','POST'],['admin/calendar-integration/google/complete','POST'],['admin/calendar-integration/google/sync','POST'],['admin/calendar-integration/google','DELETE'],['admin/orders/'+id,'GET'],['admin/orders/'+id+'/status','PATCH'],['admin/orders/'+id+'/schedule','PATCH'],['admin/orders/'+id+'/quotes','POST'],['admin/orders/'+id+'/quotes/'+id+'/status','PATCH'],['admin/payments','POST'],['admin/payments/orders/'+id,'GET'],['admin/content','PATCH'],['admin/admins/'+id,'PATCH']])assert.equal(routePolicy(path,method),'admin');
 for(const [path,method] of [['admin/orders','POST'],['admin/payments','DELETE'],['admin/admins/'+id,'DELETE'],['admin/content/home','PATCH'],['admin/admins/'+id+'/password','PATCH']])assert.equal(routePolicy(path,method),undefined);
});
test('agenda incluye feriados argentinos, días turísticos 2026 y el feriado local de Santa Fe',()=>{
 const holidays=argentinaHolidays(2026);
 assert.ok(holidays.some(item=>item.date==='2026-03-24'&&item.scope==='NATIONAL'));
 assert.ok(holidays.some(item=>item.date==='2026-07-10'&&item.type==='TOURIST'));
 assert.ok(holidays.some(item=>item.date==='2026-11-15'&&item.scope==='SANTA_FE'));
});
test('pasarela de pagos preserva clave y CSRF, filtra sesión invitada y bloquea origen ajeno',async()=>{
 const config={backendUrl:'http://127.0.0.1:3001/api/v1',webOrigin:'http://localhost:3000'},key=crypto.randomUUID();
 const headers={'Content-Type':'application/json','Origin':config.webOrigin,'X-Requested-With':'porfin-admin','X-CSRF-Token':'csrf','Idempotency-Key':key,Cookie:'porfin_session=owner; porfin_guest=guest'};
 let called=0;
 const transport:typeof fetch=async(_url,init)=>{called++;const h=new Headers(init?.headers);assert.equal(h.get('cookie'),'porfin_session=owner');assert.equal(h.get('idempotency-key'),key);assert.equal(h.get('x-csrf-token'),'csrf');assert.deepEqual(JSON.parse(init?.body as string),payment);return Response.json({movement:{id}},{status:201});};
 const request=(origin:string)=>new Request('http://localhost:3000/api/backend/admin/payments',{method:'POST',headers:{...headers,Origin:origin},body:JSON.stringify(payment)});
 assert.equal((await forwardToBackend(request(config.webOrigin),['admin','payments'],config,transport)).status,201);
 assert.equal((await forwardToBackend(request('https://other.test'),['admin','payments'],config,transport)).status,403);assert.equal(called,1);
});
