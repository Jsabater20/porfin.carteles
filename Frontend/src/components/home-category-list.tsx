'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Taxonomy } from '@/lib/contracts/catalog';

const visibleCount = 10;

export function HomeCategoryList({ categories }: { categories: Taxonomy[] }) {
  const [expanded, setExpanded] = useState(false);
  const occasions = categories.filter((category) => !['carteles', 'props', 'combos'].includes(category.slug));
  const visible = expanded ? occasions : occasions.slice(0, visibleCount);
  if (!occasions.length) return null;
  return <>
    <div className="tag-list home-category-list">
      {visible.map((category) => <Link key={category.id} href={`/catalogo?categoryId=${encodeURIComponent(category.id)}`} className="tag category-tag">{category.name} <span aria-hidden="true">↗</span></Link>)}
    </div>
    <div className="home-category-actions">
      {occasions.length > visibleCount && <button className="text-button" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? 'Ver menos ocasiones' : `Ver todas las ocasiones (${occasions.length})`}</button>}
      <Link className="text-link" href="/catalogo">Explorar todo el catálogo</Link>
    </div>
  </>;
}
