import {serverApi} from '@/lib/api/server';
export async function GET(){try{await serverApi('health/ready');return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
