'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReferenceArt } from '@/features/catalog/reference-art';
import type { CatalogShape } from '@/lib/contracts/catalog';

const categories = [
  { key: 'carteles', title: 'Carteles' },
  { key: 'props', title: 'Props' },
  { key: 'combos', title: 'Combos' },
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
  const categoryIndex = categories.findIndex((item) => item.key === category);
  const choice = category === 'carteles'
    ? { title: `Carteles ${shapeChoice.title.toLocaleLowerCase('es-AR')}`, eyebrow: 'Elegí el formato que mejor acompaña tu idea', description: shapeChoice.description, art: 'cartel-personalizado', href: `/catalogo?category=CARTEL&shape=${shape}`, shape }
    : category === 'props'
      ? { title: 'Props', eyebrow: 'Detalles para las fotos', description: 'Carteles chicos con frases, nombres e ideas para sumar a cada momento.', art: 'props-personalizados', href: '/catalogo?category=PROP', shape: null }
      : { title: 'Combos', eyebrow: 'Todo listo para festejar', description: 'Propuestas completas con carteles, props y más para celebrar con todo.', art: 'combo-2', href: '/catalogo?category=COMBO', shape: null };
  return <div className="home-showcase">
    <div className="showcase-options" aria-label="Elegir una categoría">
      {categories.map((item, index) => <button key={item.key} type="button" aria-pressed={category === item.key} onClick={() => setCategory(item.key)}>
        <span aria-hidden="true">0{index + 1}</span>{item.title}
      </button>)}
    </div>
    <div className="showcase-window">
      <div className="showcase-art" key={`${category}-${shape}`} data-shape={category === 'carteles' ? shape : undefined}>
        <ReferenceArt slug={choice.art} shape={choice.shape} label={`Ejemplo de ${choice.title.toLocaleLowerCase('es-AR')}`} />
      </div>
      <span className="showcase-count" aria-hidden="true">0{categoryIndex + 1}</span>
      <div className="showcase-copy">
        <p className="eyebrow">{choice.eyebrow}</p>
        <h2>{choice.title}</h2>
        <p>{choice.description}</p>
        {category === 'carteles' && <div className="showcase-shapes" aria-label="Elegir forma del cartel">
          {shapes.map((item) => <button key={item.key} type="button" aria-pressed={shape === item.key} onClick={() => setShape(item.key)}>{item.title}</button>)}
        </div>}
        <Link href={choice.href} className="text-link">Ver {choice.title.toLocaleLowerCase('es-AR')} <span aria-hidden="true">→</span></Link>
      </div>
    </div>
  </div>;
}
