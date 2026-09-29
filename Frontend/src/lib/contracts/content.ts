import type { ProductCard } from './catalog';

export type ContentKey = 'home' | 'about' | 'contact' | 'faq';
export interface PublicContent {
  page: ContentKey; title: string; subtitle: string; body: string;
  sections: { key: string; heading: string; text: string }[];
  faqItems: { key: string; question: string; answer: string }[];
  featuredProducts: ProductCard[];
}
export type ContentResult = { status: 'published'; data: PublicContent } | { status: 'unpublished' | 'unavailable'; data: null };
