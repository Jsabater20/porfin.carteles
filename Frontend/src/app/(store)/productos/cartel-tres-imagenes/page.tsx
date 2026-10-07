import { redirect } from 'next/navigation';

// Los enlaces antiguos llevan al catálogo, donde cada forma tiene su propia ficha y precio.
export default function ThreeImagesPage() {
  redirect('/catalogo?category=CARTEL&type=PREDEFINED');
}
