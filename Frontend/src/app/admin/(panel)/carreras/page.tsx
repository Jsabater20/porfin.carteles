import { TaxonomyPage } from '@/features/admin-catalog/taxonomy-page';
export default function Careers({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { return <TaxonomyPage kind="careers" searchParams={searchParams}/>; }
