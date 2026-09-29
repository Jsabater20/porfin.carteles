'use client';
import Link from 'next/link';
export default function PanelError({reset}:{reset:()=>void}) { return <section className="panel-card"><h1>No pudimos cargar esta pantalla</h1><p>Revisá la conexión e intentá nuevamente.</p><div className="actions"><button className="button" onClick={reset}>Volver a intentar</button><Link className="text-link" href="/admin">Volver al panel</Link></div></section>; }
