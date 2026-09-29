import { requireAdminSession } from '@/features/auth/session';
import { loadProduct } from '@/features/admin-catalog/load-product';
import { MediaGallery } from '@/features/admin-catalog/media-gallery';
export default async function Images({params}:{params:Promise<{id:string}>}) {await requireAdminSession();const {id}=await params;const product=await loadProduct(id);return <MediaGallery key={id} productId={id} name={product.name} initialImages={product.images}/>;}
