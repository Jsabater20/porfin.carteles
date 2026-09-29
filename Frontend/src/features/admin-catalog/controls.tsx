'use client';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function useEditorReady() { return useSyncExternalStore(subscribeReady, clientReady, serverReady); }
export function Field({ label, id, value, onChange, error, type = 'text', multiline = false, hint, disabled }: { label: string; id: string; value: string; onChange: (value: string) => void; error?: string; type?: string; multiline?: boolean; hint?: string; disabled?: boolean }) {
  const props = { id, value, disabled, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value), 'aria-invalid': Boolean(error), 'aria-describedby': error ? id + '-error' : hint ? id + '-hint' : undefined };
  return <div className="custom-field"><label htmlFor={id}>{label}</label>{multiline ? <textarea {...props} rows={3} /> : <input {...props} type={type} inputMode={type === 'number' ? 'decimal' : undefined} />}{hint && <small id={id + '-hint'} className="muted">{hint}</small>}{error && <p className="field-error" id={id + '-error'}>{error}</p>}</div>;
}
export function Confirm({ label, question, disabled, onConfirm }: { label: string; question: string; disabled?: boolean; onConfirm: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return open ? <div className="notice" role="group" aria-label={question}><p>{question}</p><div className="actions"><button type="button" className="text-button" disabled={disabled} onClick={() => { setOpen(false); void onConfirm(); }}>Confirmar</button><button type="button" className="text-button" onClick={() => setOpen(false)}>Cancelar</button></div></div> : <button type="button" className="text-button" disabled={disabled} onClick={() => setOpen(true)}>{label}</button>;
}
export function RowTools({ index, count, name, move, remove }: { index: number; count: number; name: string; move: (delta: number) => void; remove: () => void }) {
  return <div className="actions row-tools"><button type="button" className="text-button" aria-label={'Subir ' + name} disabled={index === 0} onClick={() => move(-1)}>Subir</button><button type="button" className="text-button" aria-label={'Bajar ' + name} disabled={index === count - 1} onClick={() => move(1)}>Bajar</button><Confirm label="Quitar" question={'¿Quitar ' + name + '?'} onConfirm={remove} /></div>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="editor-section"><h2>{title}</h2>{children}</section>; }
