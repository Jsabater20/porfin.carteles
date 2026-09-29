import 'server-only';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api/server';
import { ApiError } from '@/lib/api/errors';
import type { AdminProduct } from '@/lib/contracts/admin-catalog';
export async function loadProduct(id: string) { if(!/^c[a-z0-9]{24}$/.test(id)) notFound(); try { return await serverApi<AdminProduct>('admin/products/'+id); } catch(e) { if(e instanceof ApiError && e.status===404) notFound(); throw e; } }
