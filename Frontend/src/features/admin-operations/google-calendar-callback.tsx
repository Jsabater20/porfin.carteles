'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAdmin } from '@/features/auth/admin-provider';

export function GoogleCalendarCallback({ code, state, error }: { code?: string; state?: string; error?: string }) {
  const initialMessage = error ? 'Google no autorizó la vinculación.' : !code || !state ? 'La respuesta de Google está incompleta. Volvé a intentarlo desde Pedidos.' : 'Terminando de vincular Google Calendar…';
  const { manager } = useAdmin(), started = useRef(false), [message, setMessage] = useState(initialMessage), [done, setDone] = useState(false);
  useEffect(() => {
    if (started.current || error) return; started.current = true;
    if (!code || !state) return;
    manager.request('admin/calendar-integration/google/complete', { method: 'POST', body: { code, state } })
      .then(() => { setDone(true); setMessage('Google Calendar quedó vinculado correctamente.'); })
      .catch(reason => setMessage(reason instanceof Error ? reason.message : 'No pudimos completar la vinculación.'));
  }, [code, error, manager, state]);
  return <section className="editor-card"><p className="eyebrow">Agenda de pedidos</p><h1>{done ? 'Calendario vinculado' : 'Google Calendar'}</h1><p className="notice" role="status">{message}</p><Link className="button" href="/admin/pedidos">Volver a Pedidos</Link></section>;
}
