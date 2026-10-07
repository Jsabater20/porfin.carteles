'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReferenceArt } from '@/features/catalog/reference-art';
import type { CatalogShape } from '@/lib/contracts/catalog';

const categories = [
  { key: 'carteles', title: 'Carteles', subtitle: 'El centro de tu festejo' },
  { key: 'props', title: 'Props', subtitle: 'Fotos con tu estilo' },
  { key: 'combos', title: 'Combos', subtitle: 'Todo para celebrar' },
] as const;
const shapes: { key: CatalogShape; title: string; description: string }[] = [
  { key: 'RECTANGULAR', title: 'Rectangulares', description: 'El formato clásico para destacar nombres, carreras y temáticas.' },
  { key: 'CIRCULAR', title: 'Circulares', description: 'Una opción delicada y diferente para enmarcar cada celebración.' },
  { key: 'XXL', title: 'XXL', description: 'Carteles alargados con mayor presencia para diseños a medida.' },
];

export function HomeShowcase() {
  const [category, setCategory] = useState<(typeof categories)[number]['key']>('carteles');
  const [shape, setShape] = useState<CatalogShape>('RECTANGULAR');
  const shapeChoice = shapes.find((item) => item.key === shape)!;
  const choice = category === 'carteles'
    ? { title: `Carteles ${shape === 'XXL' ? 'XXL' : shapeChoice.title.toLocaleLowerCase('es-AR')}`, eyebrow: 'Un formato para cada idea', description: shapeChoice.description, art: 'cartel-personalizado', href: `/catalogo?category=CARTEL&shape=${shape}`, shape }
    : category === 'props'
      ? { title: 'Props', eyebrow: 'Detalles para las fotos', description: 'Carteles chicos con frases, nombres e ideas para sumar a cada momento.', art: 'props-personalizados', href: '/catalogo?category=PROP', shape: null }
      : { title: 'Combos', eyebrow: 'Todo listo para festejar', description: 'Propuestas completas con carteles, props y más para celebrar con todo.', art: 'combo-2', href: '/catalogo?category=COMBO', shape: null };
  return <div className="home-showcase">
    <div className="showcase-options" role="group" aria-label="Elegir una categoría">
      {categories.map((item) => <button key={item.key} type="button" aria-pressed={category === item.key} aria-controls="showcase-content" onClick={() => setCategory(item.key)}>
        <svg className="showcase-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {item.key === 'carteles' ? <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8M12 18v3M8 9h8M8 13h5" /></>
            : item.key === 'props' ? <><path d="m12 14 5 7M8 5l9-2 4 7-6 7-9-3-3-6Z" /><path d="m10 9 2-1 2 2" /></>
              : <><rect x="4" y="9" width="16" height="12" rx="2" /><path d="M3 9h18V6H3ZM12 6v15M12 6C4 6 6 0 9 2l3 4ZM12 6c8 0 6-6 3-4l-3 4Z" /></>}
        </svg>
        <span className="showcase-category-label"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
      </button>)}
    </div>
    <div id="showcase-content" className="showcase-window">
      <div className="showcase-art" key={`${category}-${shape}`} data-shape={category === 'carteles' ? shape : undefined}>
        <ReferenceArt slug={choice.art} shape={choice.shape} label={`Ejemplo de ${choice.title.toLocaleLowerCase('es-AR')}`} />
      </div>
      <div className="showcase-copy">
        <p className="eyebrow">{choice.eyebrow}</p>
        <h2>{choice.title}</h2>
        <p>{choice.description}</p>
        {category === 'carteles' && <fieldset className="showcase-formats"><legend>Elegí tu formato</legend><div className="showcase-shapes">
          {shapes.map((item) => <button key={item.key} type="button" aria-pressed={shape === item.key} onClick={() => setShape(item.key)}><span className="showcase-shape-icon" data-shape={item.key} aria-hidden="true" />{item.key === 'RECTANGULAR' ? 'Rectangular' : item.key === 'CIRCULAR' ? 'Circular' : 'XXL'}</button>)}
        </div></fieldset>}
        <Link href={choice.href} className="button showcase-cta">Ver {choice.title.toLocaleLowerCase('es-AR')} <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
  </div>;
}
