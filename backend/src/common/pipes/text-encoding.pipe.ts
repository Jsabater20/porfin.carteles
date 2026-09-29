import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// PostgreSQL no admite NUL ni sustitutos Unicode aislados, tampoco en JSONB.
// Verifica sin modificar textos (incluidas contraseñas) ni normalizar Unicode.
@Injectable()
export class TextEncodingPipe implements PipeTransform {
  transform<T>(value: T, metadata: ArgumentMetadata): T {
    if (!['body', 'query', 'param'].includes(metadata.type)) return value;
    const pending: unknown[] = [value];
    const seen = new WeakSet<object>();
    while (pending.length) {
      const item = pending.pop();
      if (typeof item === 'string') {
        if (/[\u0000\uD800-\uDFFF]/u.test(item)) throw new BadRequestException('El texto contiene caracteres no admitidos.');
      } else if (item !== null && typeof item === 'object' && !seen.has(item)) {
        seen.add(item);
        for (const [key, child] of Object.entries(item)) pending.push(key, child);
      }
    }
    return value;
  }
}