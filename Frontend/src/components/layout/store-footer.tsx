import Link from 'next/link';

export function StoreFooter({ storeName }: { storeName: string }) {
  return (
    <footer className="store-footer">
      <div className="container footer-inner">
        <div><strong>{storeName}</strong><p>Un detalle especial para cada celebración.</p></div>
        <nav aria-label="Información de la tienda" className="footer-nav"><Link href="/nosotros">Nosotros</Link><Link href="/contacto">Contacto</Link><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link><Link href="/admin/login">Administración</Link></nav>
      </div>
    </footer>
  );
}
