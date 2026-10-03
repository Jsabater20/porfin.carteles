import Link from 'next/link';
import { requireAdminSession } from '@/features/auth/session';
export default async function AdminHome() {
 const session=await requireAdminSession();
 const sections=[
  {title:'Pedidos y operación',text:'Solicitudes, producción, presupuestos, cobros y devoluciones.',href:'/admin/pedidos',label:'Abrir pedidos'},
  {title:'Productos',text:'Productos, precios, imágenes, ocasiones y carreras.',href:'/admin/productos',label:'Administrar productos'},
  {title:'Editar inicio',text:'Título, promoción y productos destacados de la página principal.',href:'/admin/contenido',label:'Editar página principal'},
 ];
 return <><p className="eyebrow">Panel de administración</p><h1>Hola, {session.admin.name}.</h1><p className="muted">Elegí qué necesitás hacer.</p><div className="admin-product-list">{sections.map(section=><section className="panel-card" key={section.href}><div><h2>{section.title}</h2><p>{section.text}</p></div><Link className="text-link" href={section.href}>{section.label}</Link></section>)}</div></>;
}
