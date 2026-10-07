'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { validateImage } from './upload';

export function ImagePicker({ file, onChange, disabled, error, id = 'image-file' }: {
  file: File | null; onChange: (file: File | null) => void; disabled?: boolean; error?: string; id?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: File; src: string } | null>(null);
  const invalid = error || (file ? validateImage(file) : '');
  useEffect(() => {
    if (!file || validateImage(file)) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setPreview({ file, src: reader.result }); };
    reader.readAsDataURL(file);
    return () => { reader.onload = null; reader.abort(); };
  }, [file]);
  useEffect(() => { if (!file && input.current) input.current.value = ''; }, [file]);
  return <div className="product-image-picker">
    <div className="custom-field">
      <label htmlFor={id}>Foto del producto</label>
      <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => onChange(event.target.files?.[0] ?? null)} aria-invalid={Boolean(invalid)} aria-describedby={id + (invalid ? '-error' : '-hint')} />
      <small id={id + '-hint'} className="muted">JPG, PNG o WebP, hasta 5 MiB.</small>
      {invalid && <p id={id + '-error'} className="field-error">{invalid}</p>}
    </div>
    {file && <div className="selected-product-image">
      {preview?.file === file && <Image src={preview.src} alt="Vista previa de la foto seleccionada" width={360} height={260} unoptimized />}
      <div><p>{file.name}</p><button type="button" className="text-button" disabled={disabled} onClick={() => onChange(null)}>Quitar foto</button></div>
    </div>}
  </div>;
}
