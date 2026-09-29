import { ContentPage, contentMetadata } from '@/features/content/content-page';
export const generateMetadata = () => contentMetadata('about', 'Nosotros');
export default function AboutPage() { return <ContentPage page="about" title="Nosotros" />; }
