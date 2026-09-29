import Link from 'next/link';
import { requireAdminSession } from '@/features/auth/session';
export default async function AdminHome() {
 const session=await requireAdminSession();
 const sections=[
  {title:'Pedidos y operación',text:'Solicitudes, producción, presupuestos, cobros y devoluciones.',href:'/admin/pedidos',label:'Abrir pedidos'},
  {title:'Catálogo',text:'Productos, variantes, personalizaciones, combos e imágenes.',href:'/admin/productos',label:'Administrar productos'},
  {title:'Contenido de la tienda',text:'Inicio, Nosotros, Contacto, preguntas frecuentes y destacados.',href:'/admin/contenido',label:'Editar contenido'},
  {title:'Configuración comercial',text:'Contacto, redes, modalidades de entrega y plazos.',href:'/admin/configuracion',label:'Editar configuración'},
 ];
 return <><p className="eyebrow">Panel de administración</p><h1>Hola, {session.admin.name}.</h1><p className="muted">Administrá la tienda y acompañá cada pedido.</p><div className="admin-product-list">{sections.map(section=><section className="panel-card" key={section.href}><div><h2>{section.title}</h2><p>{section.text}</p></div><Link className="text-link" href={section.href}>{section.label}</Link></section>)}</div>
 <section className="panel-card"><h2>Organización y acceso</h2><p>{session.admin.email} · {session.admin.role==='OWNER'?'Propietario':'Administrador'}</p><div className="actions"><Link className="text-link" href="/admin/categorias">Categorías</Link><Link className="text-link" href="/admin/carreras">Carreras</Link>{session.admin.role==='OWNER'&&<Link className="text-link" href="/admin/administradores">Administradores</Link>}</div></section></>;
}
