'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { browserApi } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/errors';
import { authMessage, resetToken, retryDelay, validateAuth, type AuthMode } from './validation';

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function AuthForm({ mode, status = '' }: { mode: AuthMode; status?: string }) {
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState(false), [show, setShow] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const form = useRef<HTMLFormElement>(null), working = useRef(false);
  useEffect(() => {
    if (mode !== 'reset') return;
    const readLink = () => {
      const fragment = window.location.hash;
      window.history.replaceState(window.history.state, '', window.location.pathname);
      if (fragment) {
        setToken(resetToken(fragment)); setMessage(''); setPassword(''); setConfirmation(''); setSuccess(false);
      } else setToken((previous) => previous ?? '');
    };
    // Se sincroniza el enlace externo sin enviar su fragmento al servidor.
    readLink();
    window.addEventListener('hashchange', readLink);
    return () => window.removeEventListener('hashchange', readLink);
  }, [mode]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(() => setRetryAt(0), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [retryAt]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working.current || retryAt > Date.now()) return;
    const checked = validateAuth(mode, email, password, confirmation);
    setErrors(checked.errors); setMessage('');
    if (Object.keys(checked.errors).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    if (mode === 'reset' && !token) return;
    working.current = true; setBusy(true);
    try {
      await browserApi('auth/' + (mode === 'recovery' ? 'recovery' : mode), { method: 'POST', body: mode === 'login' ? { email: checked.email, password } : mode === 'recovery' ? { email: checked.email } : { token, password } });
      setPassword(''); setConfirmation('');
      if (mode === 'login') {
        try { const channel = new BroadcastChannel('porfin-admin'); channel.postMessage('changed'); channel.close(); } catch {}
        window.location.replace('/admin');
      } else {
        setSuccess(true); setToken('');
        if (mode === 'reset') { try { const channel = new BroadcastChannel('porfin-admin'); channel.postMessage('changed'); channel.close(); } catch {} }
      }
    } catch (error) {
      setMessage(authMessage(mode, error));
      const seconds = retryDelay(error); if (seconds) setRetryAt(Date.now() + seconds * 1000);
      if (mode === 'login') setPassword('');
      if (mode === 'reset' && error instanceof ApiError && error.status === 400) { setToken(''); setPassword(''); setConfirmation(''); }
    } finally { working.current = false; setBusy(false); }
  }
  const title = mode === 'login' ? 'Ingresá al panel' : mode === 'recovery' ? 'Recuperá tu acceso' : 'Elegí una contraseña nueva';
  if (success) return <section className="auth-card" aria-live="polite"><h1>{mode === 'recovery' ? 'Revisá tu correo' : 'Contraseña actualizada'}</h1><p>{mode === 'recovery' ? 'Si la cuenta está habilitada, recibirás un enlace para recuperar el acceso. Revisá también el correo no deseado.' : 'Las sesiones anteriores quedaron cerradas. Iniciá sesión con tu contraseña nueva.'}</p><Link className="button" href="/admin/login">Volver al inicio de sesión</Link></section>;
  return <section className="auth-card"><p className="eyebrow">Administración · Por fin!</p><h1>{title}</h1>
    {mode === 'login' && status === 'vencida' && <p className="notice" role="status">Tu sesión venció o dejó de estar activa. Ingresá nuevamente.</p>}
    {mode === 'login' && status === 'cerrada' && <p className="notice" role="status">Tu sesión se cerró.</p>}
    <noscript>Activá JavaScript para usar el acceso administrativo.</noscript>{message && <p className="notice" role="alert">{message}</p>}
    {mode === 'reset' && token === null ? <p role="status">Revisando el enlace…</p> : mode === 'reset' && !token ? <><p>Este enlace no tiene un código válido. Si recargaste la página, volvé a abrir el enlace del correo.</p><Link className="button" href="/admin/recuperar">Solicitar otro enlace</Link></> : <form ref={form} method="post" onSubmit={submit} noValidate>
      <fieldset className="auth-fields" disabled={busy || !hydrated}>
        {mode !== 'reset' && <div className="custom-field"><label htmlFor="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'auth-email-error' : undefined} />{errors.email && <p id="auth-email-error" className="field-error">{errors.email}</p>}</div>}
        {mode !== 'recovery' && <>
          <div className="custom-field"><label htmlFor="auth-password">{mode === 'reset' ? 'Contraseña nueva' : 'Contraseña'}</label><input id="auth-password" name="password" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'auth-password-error' : mode === 'reset' ? 'password-hint' : undefined} />{mode === 'reset' && <small id="password-hint" className="muted">Entre 12 y 128 caracteres. Podés usar una frase larga.</small>}{errors.password && <p id="auth-password-error" className="field-error">{errors.password}</p>}</div>
          {mode === 'reset' && <div className="custom-field"><label htmlFor="auth-confirmation">Repetí la contraseña nueva</label><input id="auth-confirmation" name="confirmation" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} aria-invalid={Boolean(errors.confirmation)} aria-describedby={errors.confirmation ? 'auth-confirmation-error' : undefined} />{errors.confirmation && <p id="auth-confirmation-error" className="field-error">{errors.confirmation}</p>}</div>}
          <button type="button" className="text-button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button>
        </>}
      </fieldset>
      <button className="button auth-submit" type="submit" disabled={busy || !hydrated || retryAt > 0}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : mode === 'recovery' ? 'Enviar enlace' : 'Guardar contraseña'}</button>
      {retryAt > 0 && <p role="status" className="muted">El botón se habilitará cuando puedas volver a intentar.</p>}
      {mode === 'login' ? <Link className="text-link auth-alternative" href="/admin/recuperar">Olvidé mi contraseña</Link> : <Link className="text-link auth-alternative" href="/admin/login">Volver al inicio de sesión</Link>}
    </form>}
  </section>;
}
