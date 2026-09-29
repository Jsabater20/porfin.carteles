import type { Metadata } from 'next';
import {publicMetadata} from '@/lib/seo';
import {EDITORIAL_PATHS} from '@/lib/sitemap';
import type { ContentKey } from '@/lib/contracts/content';
import { getStoreSettings } from '@/features/settings/queries';
import { getContent } from './queries';
import { ContentBody } from './content-body';
import { ContactDetails } from './contact-details';

export async function contentMetadata(page: ContentKey, title: string): Promise<Metadata> {
  const result = await getContent(page);
  return publicMetadata(result.data?.title||title,result.data?.subtitle||'Información de Por fin! · Carteles y combos.',EDITORIAL_PATHS[page],result.status==='published');
}
export async function ContentPage({ page, title }: { page: ContentKey; title: string }) {
  const [result, settings] = await Promise.all([getContent(page), page === 'contact' ? getStoreSettings() : Promise.resolve(null)]);
  return <div className="container editorial-page">
    <header className="page-heading"><p className="eyebrow">Por fin!</p><h1>{result.data?.title || title}</h1>{result.data?.subtitle && <p className="muted preserve-lines">{result.data.subtitle}</p>}</header>
    {result.status === 'published' && <ContentBody content={result.data} />}
    {result.status === 'unavailable' && <p className="notice" role="status">No pudimos cargar esta información. Intentá nuevamente en unos minutos.</p>}
    {result.status === 'unpublished' && page !== 'contact' && <p className="muted">Estamos preparando esta información. Pronto vas a encontrarla acá.</p>}
    {page === 'contact' && <ContactDetails settings={settings} />}
  </div>;
}
