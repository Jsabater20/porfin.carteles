'use client';

import Link from 'next/link';
import { useCart } from './provider';

export function CartLink() {
  const { state } = useCart();
  const count = state.lines.reduce((sum, line) => sum + line.quantity, 0);
  return <Link href="/carrito" className="cart-link">Carrito{state.ready && count > 0 && <span className="cart-count" aria-label={`${count} unidades`}>{count}</span>}</Link>;
}
