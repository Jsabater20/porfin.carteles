import Link from 'next/link';
import {publicMetadata} from '@/lib/seo';
export async function generateMetadata(){const [settings,content]=await Promise.all([getStoreSettings(),getContent('home')]);return publicMetadata(content.data?.title||settings?.storeName||'Por fin! · Carteles para celebrar',content.data?.subtitle||settings?.description||'Carteles y combos personalizados para tus celebraciones.','/');}
import { getStoreSettings } from '@/features/settings/queries';
import { getContent } from '@/features/content/queries';
import { ContentBody } from '@/features/content/content-body';
import { getTaxonomy } from '@/features/catalog/queries';
import { ProductCard } from '@/features/catalog/product-card';
import { BrandLogo } from '@/components/brand-logo';
import { CatalogCollections } from '@/features/catalog/catalog-collections';

export default async function HomePage() {
  const [settings, content, categoriesResult] = await Promise.all([
    getStoreSettings(), getContent('home'), getTaxonomy('categories').then((items) => ({ items, failed: false }), () => ({ items: [], failed: true })),
  ]);

  return (
    <>
      <section className="brand-hero" aria-labelledby="home-title">
        <BrandLogo hero />
        <h1 id="home-title">{content.data?.title || 'Un detalle especial para cada celebración.'}</h1>
        <p className="hero-description">{content.data?.subtitle || 'Carteles, props y combos personalizados para celebrar a tu manera.'}</p>
        <div className="actions">
          <Link href="/catalogo" className="button">Explorar el catálogo <span aria-hidden="true">↗</span></Link>
          <Link href="#como-pedir" className="text-link">Cómo hacer tu pedido</Link>
        </div>
      </section>
      {(content.status === 'unavailable' || categoriesResult.failed || !settings) && <div className="container"><p className="notice" role="status">No pudimos cargar toda la información. Podés volver a intentarlo en unos minutos.</p></div>}

      <div className="container home-collections"><CatalogCollections categories={categoriesResult.items} /></div>

      {categoriesResult.items.length > 0 && <section className="container home-section"><div className="section-heading"><p className="eyebrow">Siempre hay algo para festejar</p><h2>Encontrá tu propuesta.</h2></div>
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
            <li><span className="step-number">03</span><h3>Revisá el carrito y completá tus datos</h3><p>Antes de ir a WhatsApp, completá el formulario e indicá para cuándo lo necesitarías.</p></li>
            <li><span className="step-number">04</span><h3>Confirmamos por WhatsApp</h3><p>Enviá el mensaje con tu pedido. La emprendedora debe confirmar disponibilidad, fecha y presupuesto por el chat.</p></li>
          </ol>
          <Link href="/preguntas-frecuentes" className="text-link how-faq-link">Ver preguntas frecuentes</Link>
        </div>
      </section>
    </>
  );
}
