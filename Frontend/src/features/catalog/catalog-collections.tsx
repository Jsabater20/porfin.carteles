import Link from 'next/link';
import type { Taxonomy } from '@/lib/contracts/catalog';
import { ReferenceArt } from './reference-art';
import { catalogHref, type CatalogFilters } from './filters';

const collections = [
  { category: 'carteles', title: 'Carteles', description: 'Genéricos, por carrera o con un diseño personalizado.', art: 'cartel-generico' },
  { category: 'props', title: 'Props', description: 'Carteles chicos de 12 × 17 cm, con tus frases e ideas.', art: 'props-personalizados' },
  { category: 'combos', title: 'Combos', description: 'Carteles, props y remeras para celebrar con todo.', art: 'combo-2' },
];
export function CatalogCollections({ categories, filters }: { categories: Taxonomy[]; filters?: CatalogFilters }) {
  const available = collections.flatMap(collection => {
    const category = categories.find(item => item.slug === collection.category);
    return category ? [{ ...collection, id: category.id }] : [];
  });
  if (!available.length) return null;
  return <nav className="catalog-collections" aria-label="Explorar por producto">
    {available.map(collection => <Link key={collection.category} className="collection-card" aria-current={filters?.categoryId === collection.id ? 'page' : undefined}
      href={catalogHref({ sort: 'newest', ...filters, q: '', type: '', careerId: '', categoryId: collection.id, page: 1 })}>
      <div className="collection-art"><ReferenceArt slug={collection.art} label={collection.title} /></div>
      <div className="collection-copy"><h2>{collection.title} <span aria-hidden="true">↗</span></h2><p>{collection.description}</p></div>
    </Link>)}
  </nav>;
}
