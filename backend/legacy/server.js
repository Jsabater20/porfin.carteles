import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = process.env.DATA_DIR || path.join(root, 'backend/data');
mkdirSync(path.join(data, 'uploads'), { recursive: true });
const db = new DatabaseSync(path.join(data, 'store.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY, body TEXT NOT NULL);`);
const initialSettings = { name: 'Por fin!', whatsapp: '', instagram: '', description: 'Carteles para momentos que merecen festejarse.', delivery: ['Retiro a coordinar', 'Envío a coordinar'], categories: ['Recibida', 'Jubilación', 'Cumpleaños', 'Otras celebraciones'] };
db.prepare('INSERT OR IGNORE INTO settings VALUES (1, ?)').run(JSON.stringify(initialSettings));
const all = table => db.prepare(`SELECT body FROM ${table}`).all().map(x => JSON.parse(x.body));
const get = (table, id) => { const row = db.prepare(`SELECT body FROM ${table} WHERE id=?`).get(id); return row && JSON.parse(row.body); };
const save = (table, value) => db.prepare(`INSERT OR REPLACE INTO ${table} VALUES (?, ?)`).run(value.id, JSON.stringify(value));
const settings = () => JSON.parse(db.prepare('SELECT body FROM settings WHERE id=1').get().body);
if (!all('products').length) {
  const seeds = [
    ['cartel-recibida', '¡Por fin me recibí!', 'predeterminado', 'Recibida', 18000, 'Un clásico para ese último final. Elegí los colores y hacelo tuyo.', 'lavender'],
    ['combo-festejo', 'Todo listo para festejar', 'combo', 'Recibida', 32000, 'El combo que acompaña el abrazo, las fotos y toda la emoción.', 'peach'],
    ['cartel-personalizado', 'Tan único como tu momento', 'personalizado', 'Otras celebraciones', null, 'Contanos tu idea y creemos juntos un cartel especial.', 'lime'],
    ['cumple', 'Hoy se festeja', 'genérico', 'Cumpleaños', 14000, 'Un toque de color para darle la bienvenida a un nuevo año.', 'pink'],
    ['jubilacion', 'Ahora sí, a disfrutar', 'predeterminado', 'Jubilación', 18000, 'Una nueva etapa merece un gran festejo.', 'blue']
  ];
  for (const [id,name,type,occasion,price,description,color] of seeds) save('products', {id,name,type,occasions:[occasion],price,description,color,status:'publicado',images:[],measurements:'60 × 40 cm',materials:'Cartón rígido y terminación impresa',includes:'Un cartel terminado. Accesorios decorativos no incluidos.',leadTime:'Consultar disponibilidad para tu fecha',variants: type==='predeterminado'?[{id:'simple',name:'Sin fotos',extra:0},{id:'fotos',name:'Con tres fotos',extra:3000,photos:true}]:[],fields:type==='genérico'?[]:[{id:'nombre',label:'Nombre',required:true},{id:'frase',label:'Frase o carrera',required:true},{id:'colores',label:'Colores y temática',required:false}],components:type==='combo'?[{name:'Cartel personalizado',quantity:1},{name:'Banderines',quantity:1},{name:'Props para fotos',quantity:6}]:[]});
}
const sessions = new Map(), attempts = new Map();
const salt = randomBytes(16);
const passwordHash = process.env.ADMIN_PASSWORD ? scryptSync(process.env.ADMIN_PASSWORD, salt, 64) : null;
const fail = (message, status=400, details) => { throw Object.assign(new Error(message), {status, details}); };
const str = (v, max=500) => typeof v==='string' && v.length<=max ? v.trim() : '';
const money = n => Number.isSafeInteger(n) && n>=0 && n<=100000000;
const states = ['Pendiente de confirmación','Confirmado','En producción','Listo','Entregado','Cancelado'];
const payments = ['Pendiente','Seña recibida','Pagado'];
function validateProduct(p) {
  if (!p || typeof p!=='object' || Array.isArray(p)) fail('Producto inválido.');
  if (!str(p.name,120) || !['genérico','predeterminado','personalizado','combo'].includes(p.type) || !['publicado','oculto','no disponible'].includes(p.status) || !(p.price===null || money(p.price))) fail('Revisá nombre, tipo, estado y precio.');
  for (const key of ['images','occasions','variants','fields','components']) if (!Array.isArray(p[key]) || p[key].length>30) fail(`Lista inválida: ${key}`);
  if (p.images.some(x=>typeof x!=='string' || !(/^https:\/\//.test(x) || /^\/uploads\/[a-f0-9]+\.(png|jpg|webp)$/.test(x)))) fail('Usá imágenes HTTPS o subidas desde el panel.');
  if (!p.occasions.length || p.occasions.some(c=>!settings().categories.includes(c))) fail('Elegí al menos una ocasión de las categorías de la tienda.');
  for (const v of p.variants) if(!v || !str(v.id,80)||!str(v.name,120)||!money(v.extra)||(v.photos!==undefined&&typeof v.photos!=='boolean')) fail('Variante inválida.');
  for (const f of p.fields) if(!f || !str(f.id,80)||!str(f.label,120)||typeof f.required!=='boolean') fail('Campo de personalización inválido.');
  if (new Set(p.fields.map(f=>f.id)).size!==p.fields.length || new Set(p.variants.map(v=>v.id)).size!==p.variants.length) fail('Los identificadores deben ser únicos.');
  if (new Set(p.fields.map(f=>f.label.trim().toLocaleLowerCase())).size!==p.fields.length) fail('Usá nombres distintos para cada campo de personalización.');
  for (const c of p.components) if(!c || !str(c.name,120)||!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>100) fail('Componente inválido.');
  if (p.type==='combo' && !p.components.length) fail('Agregá al menos un componente al combo.');
  const clean={id:p.id,name:p.name.trim(),type:p.type,status:p.status,price:p.price,occasions:[...new Set(p.occasions)],images:p.images,variants:p.variants.map(v=>({id:v.id,name:v.name.trim(),extra:v.extra,photos:!!v.photos})),fields:p.fields.map(f=>({id:f.id,label:f.label.trim(),required:f.required})),components:p.type==='combo'?p.components.map(c=>({name:c.name.trim(),quantity:c.quantity})):[],color:['lavender','peach','lime','pink','blue'].includes(p.color)?p.color:'lavender'};
  for (const key of ['description','measurements','materials','includes','leadTime']) {
    if (typeof p[key]!=='string'||p[key].length>2000) fail(`Texto inválido: ${key}`);
    clean[key]=p[key].trim();
  }
  return clean;
}
function quote(items) {
  if (!Array.isArray(items)||!items.length||items.length>50) fail('El carrito debe tener entre 1 y 50 productos.');
  const lines = items.map(item=>{
    const p=get('products',str(item.productId,100));
    if(!p || p.status!=='publicado') fail('Un producto ya no está disponible. Revisá el carrito.',409);
    if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100) fail('Cantidad inválida.');
    const variant=p.variants.find(v=>v.id===item.variantId);
    if(p.variants.length&&!variant) fail(`Elegí una variante para ${p.name}.`);
    const customization={};
    for(const f of p.fields) { const value=str(item.customization?.[f.id],1000); if(f.required&&!value) fail(`Completá ${f.label} en ${p.name}.`); customization[f.label]=value; }
    const unitPrice=p.price===null?null:p.price+(variant?.extra||0);
    return {productId:p.id,name:p.name,variantId:variant?.id||'',variant:variant?.name||'',photos:!!variant?.photos,quantity:item.quantity,customization,notes:str(item.notes,1000),unitPrice,subtotal:unitPrice===null?null:unitPrice*item.quantity,components:p.components};
  });
  return {lines,subtotal:lines.reduce((s,l)=>s+(l.subtotal??0),0),pendingQuote:lines.filter(l=>l.unitPrice===null).reduce((s,l)=>s+l.quantity,0)};
}
const currency=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
function message(o) { return [`¡Hola! Quiero consultar el pedido ${o.id}.`,...o.lines.map(l=>`${l.quantity} × ${l.name}${l.variant?' ('+l.variant+')':''}: ${l.subtotal===null?'A cotizar':currency(l.subtotal)}\n${Object.entries(l.customization).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n')}${l.notes?'\nObservaciones: '+l.notes:''}${l.photos?'\nEnviaré las tres fotos por WhatsApp.':''}`),`Subtotal conocido: ${currency(o.subtotal)}`,o.pendingQuote?`${o.pendingQuote} producto(s) a cotizar`:'',`Nombre: ${o.customer.name}`,`Teléfono: ${o.customer.phone}`,`Fecha solicitada: ${o.customer.date}`,`Entrega: ${o.customer.delivery}`,`Dirección: ${o.customer.address||'A coordinar'}`,o.customer.notes, 'Fecha, disponibilidad, envío y pago pendientes de confirmación.'].filter(Boolean).join('\n\n'); }
async function body(req) { let bytes=0, chunks=[]; for await(const chunk of req) { bytes+=chunk.length;if(bytes>8*1024*1024) fail('Archivo demasiado grande.',413);chunks.push(chunk); } try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail('JSON inválido.');} }
function admin(req) { const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8); const expiry=sessions.get(token); if(!expiry || expiry<Date.now()) fail('Iniciá sesión para continuar.',401); return token; }
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'), route=url.pathname;
  const send=(value,status=200,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));};
  try {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if(route.startsWith('/api/')) {
      if(req.method!=='GET' && req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) fail('Origen inválido.',403);
      if(route==='/api/catalog'&&req.method==='GET') return send({products:all('products').filter(p=>p.status!=='oculto'),settings:settings()});
      if(route==='/api/login'&&req.method==='POST') {
        if(!passwordHash) fail('Configurá ADMIN_PASSWORD en el servidor para habilitar el panel.',503);
        const key=req.socket.remoteAddress, record=attempts.get(key)||{count:0,until:Date.now()+900000};
        if(record.until<Date.now()){record.count=0;record.until=Date.now()+900000;}
        if(record.count>=10) fail('Demasiados intentos. Probá en 15 minutos.',429);
        const b=await body(req); record.count++;attempts.set(key,record);
        if(!timingSafeEqual(passwordHash,scryptSync(typeof b.password==='string'&&b.password.length<=256?b.password:'',salt,64))) fail('Contraseña incorrecta.',401);
        attempts.delete(key);const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);
        return send({ok:true},200,{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`});
      }
      if(route==='/api/quote'&&req.method==='POST') return send(quote((await body(req)).items));
      if(route==='/api/orders'&&req.method==='POST') {
        const b=await body(req), q=quote(b.items), c=b.customer||{}, config=settings();
        if(!/^\d{8,15}$/.test(config.whatsapp)) fail('La tienda todavía debe configurar su WhatsApp. Intentá más tarde.',503);
        if(!str(c.name,120)||!/^\+?[\d\s()-]{8,25}$/.test(c.phone||'')||!/^\d{4}-\d{2}-\d{2}$/.test(c.date||'')||!Number.isFinite(Date.parse(c.date))||new Date(c.date+'T23:59:59-03:00')<new Date()||!config.delivery.includes(c.delivery)) fail('Revisá nombre, teléfono, fecha solicitada y entrega.');
        if(JSON.stringify(b.acceptedQuote)!==JSON.stringify(q)) fail('Revisá los precios actualizados antes de continuar.',409,{quote:q});
        const id='PF-'+randomBytes(5).toString('hex').toUpperCase();
        const o={id,...q,customer:{name:str(c.name,120),phone:str(c.phone,25),date:c.date,delivery:c.delivery,address:str(c.address,300),notes:str(c.notes,1000)},status:states[0],payment:payments[0],createdAt:new Date().toISOString()};
        save('orders',o);return send({...o,whatsappUrl:`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message(o))}`},201);
      }
      if(route.startsWith('/api/admin')) {
        const token=admin(req);
        if(route==='/api/admin/logout'&&req.method==='POST'){sessions.delete(token);return send({ok:true},200,{'Set-Cookie':'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
        if(route==='/api/admin'&&req.method==='GET') return send({products:all('products'),orders:all('orders').reverse(),settings:settings(),states,payments});
        if(route==='/api/admin/products'&&req.method==='POST') {const p=validateProduct(await body(req));p.id=/^[a-zA-Z0-9-]{1,100}$/.test(p.id||'')?p.id:randomBytes(10).toString('hex');save('products',p);return send(p);}
        if(route==='/api/admin/settings'&&req.method==='POST') {const b=await body(req);if(!str(b.name,100)||(b.whatsapp!==''&&!/^\d{8,15}$/.test(b.whatsapp))||!Array.isArray(b.delivery)||!b.delivery.length||!Array.isArray(b.categories)||!b.categories.length||[...b.delivery,...b.categories].some(x=>!str(x,100))) fail('Revisá nombre, WhatsApp (solo dígitos), entregas y categorías.');if(new Set(b.categories).size!==b.categories.length)fail('Las categorías no deben repetirse.');const removed=settings().categories.filter(c=>!b.categories.includes(c));if(all('products').some(p=>p.occasions.some(c=>removed.includes(c))))fail('Antes de quitar una categoría, reasigná los productos que la usan.');db.prepare('UPDATE settings SET body=? WHERE id=1').run(JSON.stringify({name:str(b.name,100),whatsapp:b.whatsapp,instagram:str(b.instagram,200),description:str(b.description,500),delivery:b.delivery,categories:b.categories}));return send({ok:true});}
        if(route.startsWith('/api/admin/orders/')&&req.method==='PATCH') {const o=get('orders',route.split('/').pop());if(!o)fail('Pedido inexistente.',404);const b=await body(req);if(!states.includes(b.status)||!payments.includes(b.payment))fail('Estado inválido.');o.status=b.status;o.payment=b.payment;save('orders',o);return send(o);}
        if(route==='/api/admin/upload'&&req.method==='POST'){const b=await body(req);const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.image||'');if(!match)fail('Usá una imagen PNG, JPG o WebP.');const buffer=Buffer.from(match[2],'base64');if(buffer.length>5*1024*1024)fail('La imagen debe pesar menos de 5 MB.');const valid=match[1]==='png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?buffer[0]===255&&buffer[1]===216:buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';if(!valid)fail('El contenido no corresponde al formato de imagen.');const name=randomBytes(16).toString('hex')+'.'+(match[1]==='jpeg'?'jpg':match[1]);writeFileSync(path.join(data,'uploads',name),buffer);return send({url:'/uploads/'+name});}
      }
      return send({error:'Ruta inexistente.'},404);
    }
    if(req.method!=='GET') return send({error:'Método no permitido.'},405);
    const files={'/':'index.html','/admin':'index.html','/app.js':'app.js','/product-editor.js':'product-editor.js','/style.css':'style.css'};
    const upload=/^\/uploads\/[a-f0-9]+\.(png|jpg|webp)$/.test(route);
    const file=upload?path.join(data,route.slice(1)):files[route]?path.join(root,'Frontend',files[route]):null;
    if(!file||!existsSync(file))return send({error:'No encontrado.'},404);
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]});res.end(readFileSync(file));
  } catch(e) {if(!res.headersSent)send({error:e.status?e.message:'Ocurrió un error en el servidor.',...e.details},e.status||500);if(!e.status)console.error(e);}
});
server.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log(`Por fin! → http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3000}`));
