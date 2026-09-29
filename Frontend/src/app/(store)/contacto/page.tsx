import { ContentPage, contentMetadata } from '@/features/content/content-page';
export const generateMetadata = () => contentMetadata('contact', 'Contacto');
export default function ContactPage() { return <ContentPage page="contact" title="Contacto" />; }
