import { requireAdminSession } from '@/features/auth/session';
import { allTaxonomy } from '@/features/admin-catalog/queries';
import { loadProduct } from '@/features/admin-catalog/load-product';
import { ProductEditor } from '@/features/admin-catalog/product-editor';
export default async function EditProduct({params}:{params:Promise<{id:string}>}) { await requireAdminSession(); const {id}=await params; const [product,categories,careers]=await Promise.all([loadProduct(id),allTaxonomy('categories'),allTaxonomy('careers')]); return <ProductEditor key={id} product={product} categories={categories} careers={careers}/>; }
