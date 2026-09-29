import { ContentPage, contentMetadata } from '@/features/content/content-page';
export const generateMetadata = () => contentMetadata('faq', 'Preguntas frecuentes');
export default function FaqPage() { return <ContentPage page="faq" title="Preguntas frecuentes" />; }
