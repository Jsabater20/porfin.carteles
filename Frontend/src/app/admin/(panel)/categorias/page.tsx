import { TaxonomyPage } from '@/features/admin-catalog/taxonomy-page';
export default function Categories({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { return <TaxonomyPage kind="categories" searchParams={searchParams}/>; }
