import Link from 'next/link';
import {publicMetadata} from '@/lib/seo';
export async function generateMetadata(){const [settings,content]=await Promise.all([getStoreSettings(),getContent('home')]);return publicMetadata(content.data?.title||settings?.storeName||'Por fin! · Carteles para celebrar',content.data?.subtitle||settings?.description||'Carteles y combos personalizados para tus celebraciones.','/');}
import { getStoreSettings } from '@/features/settings/queries';
import { getContent } from '@/features/content/queries';
import { ContentBody } from '@/features/content/content-body';
import { getTaxonomy } from '@/features/catalog/queries';
import { ProductCard } from '@/features/catalog/product-card';

export default async function HomePage() {
  const [settings, content, categoriesResult] = await Promise.all([
    getStoreSettings(), getContent('home'), getTaxonomy('categories').then((items) => ({ items, failed: false }), () => ({ items: [], failed: true })),
  ]);
  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="small-star" aria-hidden="true">✳</span> Hecho para tu momento</p>
          <h1>{content.data?.title || <>Eso que tanto esperaste.<br /><em>Vamos a celebrarlo.</em></>}</h1>
          <p className="hero-description preserve-lines">{content.data?.subtitle || settings?.description || 'Carteles y combos personalizados para recibidas, cumpleaños y esos días que merecen un detalle especial.'}</p>
          <div className="actions">
            <Link href="/catalogo" className="button">Explorar el catálogo <span aria-hidden="true">↗</span></Link>
            <Link href="#como-pedir" className="text-link">Cómo hacer tu pedido</Link>
          </div>
          {(!settings || content.status === 'unavailable' || categoriesResult.failed) && <p className="notice" role="status">No pudimos cargar toda la información actual de la tienda. Intentá nuevamente en unos minutos.</p>}
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-star star-one">✳</span>
          <div className="celebration-card"><span>Hay momentos que dicen</span><strong>¡Por<br />fin!</strong><span>Y merecen celebrarse.</span></div>
          <span className="art-star star-two">✳</span>
          <span className="art-label">Un detalle. Un gran recuerdo.</span>
        </div>
      </section>
      {categoriesResult.items.length > 0 && <section className="container home-section"><div className="section-heading"><p className="eyebrow">Siempre hay algo para festejar</p><h2>Elegí tu ocasión.</h2></div>
        <div className="tag-list">{categoriesResult.items.map((category) => <Link key={category.id} href={`/catalogo?categoryId=${encodeURIComponent(category.id)}`} className="tag category-tag">{category.name} <span aria-hidden="true">↗</span></Link>)}</div>
      </section>}
      {!!content.data?.featuredProducts.length && <section className="container home-section"><div className="section-heading heading-row"><div><p className="eyebrow">Elegidos para vos</p><h2>Para tu próxima celebración.</h2></div><Link className="text-link" href="/catalogo">Ver todo el catálogo</Link></div>
        <div className="product-grid">{content.data.featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </section>}
      {content.data && (content.data.body || content.data.sections.length > 0 || content.data.faqItems.length > 0) && <div className="container home-section"><ContentBody content={content.data} /></div>}
      <section id="como-pedir" className="how-section">
        <div className="container">
          <div className="section-heading"><p className="eyebrow">Simple, como tiene que ser</p><h2>Tu idea, paso a paso.</h2></div>
          <ol className="steps">
            <li><span className="step-number">01</span><h3>Elegí tu cartel o combo</h3><p>Encontrá la propuesta que acompaña tu celebración.</p></li>
            <li><span className="step-number">02</span><h3>Dale tu toque</h3><p>Completá los textos y las opciones que lo hacen tuyo.</p></li>
            <li><span className="step-number">03</span><h3>Lo charlamos por WhatsApp</h3><p>Después de enviar tu solicitud, confirmamos disponibilidad, entrega y pago.</p></li>
          </ol>
          <Link href="/preguntas-frecuentes" className="text-link how-faq-link">Ver preguntas frecuentes</Link>
        </div>
      </section>
    </>
  );
}
