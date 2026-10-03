import { moneyToCents } from '../admin-catalog/model';
import type { OrderStatus,QuoteStatus,QuoteInput,ContentInput,StoreInput } from '../../lib/contracts/admin-operations';
export const ORDER_LABELS:Record<OrderStatus,string>={PENDING_CONFIRMATION:'Por confirmar',CONFIRMED:'Confirmado',IN_PRODUCTION:'En producción',READY:'Listo',DELIVERED:'Entregado',CANCELLED:'Cancelado'};
export const ORDER_NEXT:Record<OrderStatus,OrderStatus[]>={PENDING_CONFIRMATION:['CONFIRMED','CANCELLED'],CONFIRMED:['IN_PRODUCTION','CANCELLED'],IN_PRODUCTION:['READY','CANCELLED'],READY:['DELIVERED','CANCELLED'],DELIVERED:[],CANCELLED:[]};
export const QUOTE_LABELS:Record<QuoteStatus,string>={DRAFT:'Borrador',SENT:'Enviado',ACCEPTED:'Aceptado',REJECTED:'Rechazado'};
export const QUOTE_NEXT:Record<QuoteStatus,QuoteStatus[]>={DRAFT:['SENT','REJECTED'],SENT:['ACCEPTED','REJECTED'],ACCEPTED:[],REJECTED:[]};
export const PAGE_LABELS={home:'Inicio',about:'Nosotros',contact:'Contacto',faq:'Preguntas frecuentes'};
export const money=(cents:number|null)=>cents===null?'Por confirmar':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(cents/100);
// Construir el texto con partes numéricas evita diferencias de ICU entre Node y Chrome.
export function date(value:string) {
 const d=new Date(value);
 return [d.getUTCDate(),d.getUTCMonth()+1,d.getUTCFullYear()].map((n,i)=>String(n).padStart(i===2?4:2,'0')).join('/');
}
export function timestamp(value:string) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 return parts.day+'/'+parts.month+'/'+parts.year+' '+parts.hour+':'+parts.minute;
}
export const validText=(value:string,max:number,min=0)=>[...value.trim()].length>=min&&[...value.trim()].length<=max&&!/[\u0000\uD800-\uDFFF]/u.test(value);
export interface QuoteDraft {items:{productName:string;description:string;quantity:string;price:string}[];notes:string}
export function buildQuote(draft:QuoteDraft) {
 const errors:string[]=[];
 if(!draft.items.length||draft.items.length>100)errors.push('El presupuesto necesita entre 1 y 100 renglones.');
 if(!validText(draft.notes,1000))errors.push('Las notas admiten hasta 1000 caracteres.');
 const items=draft.items.map((item,index)=>{
  const quantity=Number(item.quantity),price=moneyToCents(item.price);
  if(!validText(item.productName,160,1)||!validText(item.description,500))errors.push('Revisá el nombre y la descripción del renglón '+(index+1)+'.');
  if(!/^\d+$/.test(item.quantity)||!Number.isInteger(quantity)||quantity<1||quantity>10000)errors.push('La cantidad del renglón '+(index+1)+' debe ser de 1 a 10000.');
  if(price===null)errors.push('Ingresá un precio válido en el renglón '+(index+1)+'.');
  return {productName:item.productName.trim(),description:item.description.trim(),quantity,unitPriceCents:price??0};
 });
 const total=items.reduce((sum,item)=>sum+item.quantity*item.unitPriceCents,0);
 if(!Number.isSafeInteger(total))errors.push('El total supera el límite admitido.');
 return {input:{items,notes:draft.notes.trim()} satisfies QuoteInput,total,errors};
}
export function validateContent(input:ContentInput) {
 const errors:string[]=[];
 if(!validText(input.title,200,input.published?1:0)||!validText(input.subtitle,500)||!validText(input.body,10000))errors.push('Revisá título (200), subtítulo (500) y cuerpo (10000 caracteres). Publicar requiere título.');
 if(input.sections.length>20||input.sections.some(s=>!validText(s.heading,150,1)||!validText(s.text,3000,1)))errors.push('Hasta 20 secciones, con título (150) y texto (3000) completos.');
 if(input.faqItems.length>30||input.faqItems.some(f=>!validText(f.question,200,1)||!validText(f.answer,2000,1)))errors.push('Hasta 30 preguntas (200) con respuesta (2000 caracteres).');
 for(const items of [input.sections,input.faqItems])if(new Set(items.map(x=>x.key)).size!==items.length||items.some(x=>!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(x.key)||x.key.length>80))errors.push('Hay identificadores repetidos o inválidos.');
 if(input.page==='faq'&&input.published&&!input.faqItems.length)errors.push('Agregá al menos una pregunta antes de publicar.');
 if(input.featuredProductIds && (input.page!=='home'||input.featuredProductIds.length>12||new Set(input.featuredProductIds).size!==input.featuredProductIds.length))errors.push('Hasta 12 productos destacados distintos, solo en Inicio.');
 return errors;
}
export const SETTING_TEXT={storeName:['Nombre de la tienda',120],description:['Descripción',2000],pickupAddress:['Dirección de retiro',500],deliveryNotes:['Información de entrega',2000],businessHours:['Horarios',500]} as const;
export const SETTING_CONTACT={whatsappNumber:'WhatsApp internacional (sin +)',contactEmail:'Correo de contacto',instagramUrl:'Instagram (HTTPS)',facebookUrl:'Facebook (HTTPS)',tiktokUrl:'TikTok (HTTPS)'} as const;
export function settingsInput(raw:StoreInput):StoreInput {return Object.fromEntries([...Object.keys(SETTING_TEXT),...Object.keys(SETTING_CONTACT),'leadTimeText','deliveryMethods'].map(key=>[key,raw[key as keyof StoreInput]])) as unknown as StoreInput;}
export function validateSettings(input:StoreInput) {
 const errors:string[]=[];
 for(const [key,[label,max]] of Object.entries(SETTING_TEXT))if(!validText(input[key as keyof typeof SETTING_TEXT],max,key==='storeName'?1:0))errors.push(label+': revisá el texto (máximo '+max+').');
 if(input.whatsappNumber&&!/^[1-9][0-9]{7,14}$/.test(input.whatsappNumber))errors.push('WhatsApp requiere entre 8 y 15 dígitos internacionales, sin +.');
 if(input.contactEmail&&(input.contactEmail.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)))errors.push('Revisá el correo de contacto.');
 for(const key of ['instagramUrl','facebookUrl','tiktokUrl'] as const){const value=input[key];if(!value)continue;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||!validText(value,500))throw new Error();}catch{errors.push('La dirección de '+key.replace('Url','')+' debe ser HTTPS, sin credenciales.');}}
 if(input.deliveryMethods.length>2||new Set(input.deliveryMethods).size!==input.deliveryMethods.length||input.deliveryMethods.some(m=>!['PICKUP','SHIPPING'].includes(m)))errors.push('Revisá las modalidades de entrega.');
 return errors;
}
