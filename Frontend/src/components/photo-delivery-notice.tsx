export function PhotoDeliveryNotice({ count, method, className }: { count: number; method: 'EMAIL' | 'WHATSAPP'; className?: string }) {
  if (method === 'EMAIL') return <p className={className}>Envianos tus {count === 3 ? '3 imágenes' : `${count} imágenes (3 por cartel)`} a nuestro mail <a href="mailto:porfincarteles@gmail.com">porfincarteles@gmail.com</a>.</p>;
  return <p className={className}>{count} {count === 1 ? 'foto para enviar' : 'fotos para enviar'} por WhatsApp al coordinar el pedido.</p>;
}
