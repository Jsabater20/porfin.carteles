'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Taxonomy } from '@/lib/contracts/catalog';

const visibleCount = 10;

export function HomeCareerList({ careers }: { careers: Taxonomy[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? careers : careers.slice(0, visibleCount);
  if (!careers.length) return null;
  return <>
    <div className="tag-list home-career-list">
      {visible.map((career) => <Link key={career.id} href={`/catalogo?category=CARTEL&type=PREDEFINED&career=${encodeURIComponent(career.id)}`} className="tag career-tag">{career.name} <span aria-hidden="true">↗</span></Link>)}
    </div>
    <div className="home-career-actions">
      {careers.length > visibleCount && <button className="text-button" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? 'Ver menos carreras' : `Ver todas las carreras (${careers.length})`}</button>}
      <Link className="text-link" href="/catalogo?category=CARTEL&type=PREDEFINED">Ver todos los carteles predeterminados</Link>
    </div>
  </>;
}
