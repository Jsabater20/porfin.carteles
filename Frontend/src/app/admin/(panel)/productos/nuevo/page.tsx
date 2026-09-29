import { requireAdminSession } from '@/features/auth/session';
import { allTaxonomy } from '@/features/admin-catalog/queries';
import { ProductEditor } from '@/features/admin-catalog/product-editor';
export default async function NewProduct() { await requireAdminSession(); const [categories,careers]=await Promise.all([allTaxonomy('categories'),allTaxonomy('careers')]); return <ProductEditor categories={categories} careers={careers}/>; }
