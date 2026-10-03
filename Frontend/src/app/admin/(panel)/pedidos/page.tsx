import { requireAdminSession } from '@/features/auth/session';
import { serverApi } from '@/lib/api/server';
import type { OrderCalendar } from '@/lib/contracts/admin-operations';
import { OrdersCalendar } from '@/features/admin-operations/orders-calendar';

const validMonth=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const monthIso=(date:Date)=>date.toISOString().slice(0,7);
const argentinaMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit'}).format(new Date());

export default async function Orders({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await requireAdminSession();
 const params=await searchParams,month=validMonth(params.mes)?params.mes:argentinaMonth();
 const [year,monthNumber]=month.split('-').map(Number),start=new Date(Date.UTC(year,monthNumber-1,1)),end=new Date(Date.UTC(year,monthNumber,0));
 const from=start.toISOString().slice(0,10),to=end.toISOString().slice(0,10);
 const query=new URLSearchParams({from,to}),result=await serverApi<OrderCalendar>('admin/orders/calendar',query);
 const monthLabel=new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(start);
 const calendarKey=month+':'+result.items.map(item=>item.id+item.status+item.scheduledDate).join('|');
 return <OrdersCalendar key={calendarKey} initialItems={result.items} from={from} to={to} monthLabel={monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1)} previousMonth={monthIso(new Date(Date.UTC(year,monthNumber-2,1)))} nextMonth={monthIso(new Date(Date.UTC(year,monthNumber,1)))}/>;
}
