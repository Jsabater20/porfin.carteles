'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReferenceArt } from '@/features/catalog/reference-art';

const choices = [
  { key: 'carteles', title: 'Carteles', eyebrow: 'El centro de la celebración', description: 'Genéricos, predeterminados o diseñados especialmente para vos.', art: 'cartel-generico', href: '/catalogo?category=CARTEL' },
  { key: 'props', title: 'Props', eyebrow: 'Detalles para las fotos', description: 'Frases, nombres y ocurrencias para sumar a cada momento.', art: 'props-personalizados', href: '/catalogo?category=PROP' },
  { key: 'combos', title: 'Combos', eyebrow: 'Todo listo para festejar', description: 'Propuestas completas para que cada detalle acompañe tu idea.', art: 'combo-2', href: '/catalogo?category=COMBO' },
] as const;

export function HomeShowcase() {
  const [selected, setSelected] = useState(0);
  const choice = choices[selected];
  return <div className="home-showcase">
    <div className="showcase-window">
      <div className="showcase-art" key={choice.key}>
        <ReferenceArt slug={choice.art} label={`Ejemplo de ${choice.title.toLocaleLowerCase('es-AR')}`} />
      </div>
      <span className="showcase-count" aria-hidden="true">0{selected + 1}</span>
      <div className="showcase-copy">
        <p className="eyebrow">{choice.eyebrow}</p>
        <h2>{choice.title}</h2>
        <p>{choice.description}</p>
        <Link href={choice.href} className="text-link">Ver {choice.title.toLocaleLowerCase('es-AR')} <span aria-hidden="true">→</span></Link>
      </div>
    </div>
    <div className="showcase-options" aria-label="Elegir una propuesta">
      {choices.map((item, index) => <button key={item.key} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
        <span aria-hidden="true">0{index + 1}</span>{item.title}
      </button>)}
    </div>
  </div>;
}
