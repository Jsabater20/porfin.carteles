import Holidays from 'date-holidays';
import type { CalendarHoliday } from '@/lib/contracts/admin-operations';

const TOURIST_2026: CalendarHoliday[] = [
  { date: '2026-03-23', name: 'Día no laborable con fines turísticos', scope: 'NATIONAL', type: 'TOURIST' },
  { date: '2026-07-10', name: 'Día no laborable con fines turísticos', scope: 'NATIONAL', type: 'TOURIST' },
  { date: '2026-12-07', name: 'Día no laborable con fines turísticos', scope: 'NATIONAL', type: 'TOURIST' },
];

export function argentinaHolidays(year: number): CalendarHoliday[] {
  const holidays = new Holidays('AR').getHolidays(year)
    .filter(holiday => holiday.type === 'public' || holiday.type === 'bank')
    .map<CalendarHoliday>(holiday => ({ date: holiday.date.slice(0, 10), name: holiday.name, scope: 'NATIONAL', type: 'PUBLIC' }));
  if (year === 2026) holidays.push(...TOURIST_2026);
  holidays.push({ date: `${year}-11-15`, name: 'Fundación de Santa Fe', scope: 'SANTA_FE', type: 'LOCAL' });
  const byDateAndName = new Map<string, CalendarHoliday>();
  for (const holiday of holidays) byDateAndName.set(`${holiday.date}:${holiday.name}`, holiday);
  return [...byDateAndName.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
