import type {MetadataRoute} from 'next';
import {robotsPolicy} from '@/lib/seo';
export const dynamic='force-dynamic';
export default function robots():MetadataRoute.Robots {return robotsPolicy();}
