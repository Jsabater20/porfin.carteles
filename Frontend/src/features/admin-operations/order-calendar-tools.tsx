'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { AdminOrder, CalendarIntegrationStatus, CalendarSyncResult } from '@/lib/contracts/admin-operations';
import { appendOrdersToChosenExcel, appendOrdersToUploadedExcel, createOrdersExcel } from './orders-excel';
import { useOperation } from './use-operation';

export function OrderCalendarTools({ selectedIds, monthOrderIds, onSelectAll, onClear }: { selectedIds: string[]; monthOrderIds: string[]; onSelectAll(): void; onClear(): void }) {
  const op = useOperation(), fileInput = useRef<HTMLInputElement>(null), [calendar, setCalendar] = useState<CalendarIntegrationStatus | null>(null), [statusMessage, setStatusMessage] = useState('');
  useEffect(() => { let active = true; op.manager.request<CalendarIntegrationStatus>('admin/calendar-integration/status').then(value => { if (active) setCalendar(value); }).catch(error => { if (active) setStatusMessage(error instanceof Error ? error.message : 'No pudimos consultar Google Calendar.'); }); return () => { active = false; }; }, [op.manager]);
  const details = () => Promise.all(selectedIds.map(id => op.manager.request<AdminOrder>('admin/orders/' + id)));
  const exportNew = () => op.run(async () => { const orders = await details(); await createOrdersExcel(orders); op.setMessage(`${orders.length} pedido${orders.length === 1 ? '' : 's'} exportado${orders.length === 1 ? '' : 's'} a un Excel nuevo.`); });
  const exportExisting = () => op.run(async () => { if (!(window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker) { fileInput.current?.click(); return; } const added = await appendOrdersToChosenExcel(details); if (added === null || added < 0) return; op.setMessage(`${added} pedido${added === 1 ? '' : 's'} agregado${added === 1 ? '' : 's'} al Excel elegido.`); });
  const uploadExisting = (event: ChangeEvent<HTMLInputElement>) => op.run(async () => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const orders = await details(); const added = await appendOrdersToUploadedExcel(file, orders); op.setMessage(`Se descargó una copia actualizada con ${added} pedido${added === 1 ? '' : 's'} nuevo${added === 1 ? '' : 's'}.`); });
  const connect = () => op.run(async () => { const result = await op.manager.request<{ authorizationUrl: string }>('admin/calendar-integration/google/start', { method: 'POST' }); window.location.assign(result.authorizationUrl); });
  const sync = () => op.run(async () => { const result = await op.manager.request<CalendarSyncResult>('admin/calendar-integration/google/sync', { method: 'POST', body: { orderIds: selectedIds } }); const current = await op.manager.request<CalendarIntegrationStatus>('admin/calendar-integration/status'); setCalendar(current); op.setMessage(result.failures.length ? `${result.synced} pedidos sincronizados; ${result.failures.length} no pudieron copiarse.` : `${result.synced} pedido${result.synced === 1 ? '' : 's'} sincronizado${result.synced === 1 ? '' : 's'} con Google Calendar.`); });
  const disconnect = () => { if (!window.confirm('¿Querés desvincular Google Calendar? Los eventos ya creados se conservarán en Google.')) return; void op.run(async () => { setCalendar(await op.manager.request<CalendarIntegrationStatus>('admin/calendar-integration/google', { method: 'DELETE' })); op.setMessage('Google Calendar quedó desvinculado.'); }); };
  const allSelected = monthOrderIds.length > 0 && monthOrderIds.every(id => selectedIds.includes(id));
  return <section className="calendar-tools" aria-labelledby="calendar-tools-title">
    <div className="calendar-tools-heading"><div><p className="eyebrow">Acciones del calendario</p><h2 id="calendar-tools-title">Elegí los pedidos que querés usar</h2><p className="muted">Marcá uno o más pedidos en el calendario. Después podés exportarlos o copiarlos a Google Calendar.</p></div><strong>{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}</strong></div>
    <div className="calendar-tools-actions">
      <button className="button button-secondary" type="button" disabled={!monthOrderIds.length || op.disabled} onClick={allSelected ? onClear : onSelectAll}>{allSelected ? 'Quitar selección' : 'Seleccionar el mes'}</button>
      <button className="button button-secondary" type="button" disabled={!selectedIds.length || op.disabled} onClick={() => void exportNew()}>Crear Excel nuevo</button>
      <button className="button button-secondary" type="button" disabled={!selectedIds.length || op.disabled} onClick={() => void exportExisting()}>Agregar a un Excel</button>
      <input ref={fileInput} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={uploadExisting}/>
      {calendar?.connected
        ? <><button className="button" type="button" disabled={!selectedIds.length || op.disabled} onClick={() => void sync()}>Pasar a Google Calendar</button><button className="text-button" type="button" disabled={op.disabled} onClick={disconnect}>Desvincular</button></>
        : <button className="button" type="button" disabled={!calendar?.configured || op.disabled} onClick={() => void connect()}>Vincular Google Calendar</button>}
    </div>
    {calendar && <p className="calendar-connection">{calendar.connected ? `Vinculado con ${calendar.email}. Los pedidos se copian sólo cuando los seleccionás.` : calendar.configured ? `Podés vincular ${calendar.email ?? 'la cuenta del emprendimiento'} cuando quieras.` : 'Google Calendar estará disponible cuando se complete su configuración externa.'}</p>}
    {(op.message || statusMessage) && <p className="notice" role="status">{op.message || statusMessage}</p>}
  </section>;
}
