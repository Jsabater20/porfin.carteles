import Link from 'next/link';
import {publicMetadata} from '@/lib/seo';
export async function generateMetadata(){const [settings,content]=await Promise.all([getStoreSettings(),getContent('home')]);return publicMetadata(content.data?.title||settings?.storeName||'Por fin Carteles · Carteles para celebrar',content.data?.subtitle||settings?.description||'Carteles y combos personalizados para tus celebraciones.','/');}
import { getStoreSettings } from '@/features/settings/queries';
import { getContent } from '@/features/content/queries';
import { getTaxonomy } from '@/features/catalog/queries';
import { ProductCard } from '@/features/catalog/product-card';
import { HomeShowcase } from '@/components/home-showcase';
import { HomeCareerList } from '@/components/home-career-list';

export default async function HomePage() {
  const [settings, content, careersResult] = await Promise.all([
    getStoreSettings(), getContent('home'), getTaxonomy('careers').then((items) => ({ items, failed: false }), () => ({ items: [], failed: true })),
  ]);

  return (
    <>
      <section className="brand-hero" aria-labelledby="home-title">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow"><span aria-hidden="true">✦</span> Carteles hechos para celebrar</p>
            <h1 id="home-title">{content.data?.title || 'Un detalle especial para cada celebración.'}</h1>
            <p className="hero-description">{content.data?.subtitle || 'Carteles, props y combos personalizados para celebrar a tu manera.'}</p>
            <div className="actions">
              <Link href="/catalogo" className="button">Explorar el catálogo <span aria-hidden="true">↗</span></Link>
              <Link href="#como-pedir" className="text-link">Cómo hacer tu pedido</Link>
            </div>
            <ul className="hero-details" aria-label="Información destacada">
              <li><strong>Hecho a medida</strong><span>Cada idea tiene su detalle</span></li>
              <li><strong>Santa Fe Capital</strong><span>Retiro o envío a coordinar</span></li>
              <li><strong>50% de seña</strong><span>Para comenzar con el diseño</span></li>
            </ul>
          </div>
        </div>
      </section>
      {(content.status === 'unavailable' || careersResult.failed || !settings) && <div className="container"><p className="notice" role="status">No pudimos cargar toda la información. Podés volver a intentarlo en unos minutos.</p></div>}

      <section className="container home-section home-showcase-section" aria-labelledby="showcase-title">
        <div className="section-heading"><p className="eyebrow">Encontrá el formato ideal</p><h2 id="showcase-title">Una propuesta para cada festejo.</h2><p className="muted">Explorá carteles por su forma o elegí props y combos para completar tu celebración.</p></div>
        <HomeShowcase />
      </section>

      {careersResult.items.length > 0 && <section className="container home-section home-careers"><div className="section-heading"><p className="eyebrow">Carteles predeterminados para recibidas</p><h2>Elegí tu carrera.</h2><p className="muted">Encontrá diseños preparados para cada profesión y personalizalos con tu nombre.</p></div>
        <HomeCareerList careers={careersResult.items} />
      </section>}
      {!!content.data?.featuredProducts.length && <section className="container home-section"><div className="section-heading heading-row"><div><p className="eyebrow">Elegidos para vos</p><h2>Para tu próxima celebración.</h2></div><Link className="text-link" href="/catalogo">Ver todo el catálogo</Link></div>
        <div className="product-grid">{content.data.featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </section>}
      {content.data?.body && <section className="container home-section home-promo"><p className="eyebrow">Novedades</p><p className="preserve-lines">{content.data.body}</p></section>}
      <section id="como-pedir" className="how-section">
        <div className="container">
          <div className="section-heading"><p className="eyebrow">Simple, como tiene que ser</p><h2>Tu idea, paso a paso.</h2></div>
          <ol className="steps">
            <li><span className="step-number">01</span><h3>Elegí tu cartel o combo</h3><p>Encontrá la propuesta que acompaña tu celebración.</p></li>
            <li><span className="step-number">02</span><h3>Revisá el carrito y completá tus datos</h3><p>Antes de ir a WhatsApp, completá el formulario e indicá para cuándo lo necesitarías.</p></li>
            <li><span className="step-number">03</span><h3>Confirmamos por WhatsApp</h3><p>Enviá el mensaje con tu pedido. La emprendedora debe confirmar disponibilidad, fecha y presupuesto por el chat.</p></li>
          </ol>
          <Link href="/preguntas-frecuentes" className="text-link how-faq-link">Ver preguntas frecuentes</Link>
        </div>
      </section>
    </>
  );
}
