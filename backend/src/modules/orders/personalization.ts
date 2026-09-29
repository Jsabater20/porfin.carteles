import { BadRequestException } from '@nestjs/common';
import { PersonalizationType } from '@prisma/client';
import { PreviewAnswerDto, PreviewAnswerResultDto } from './dto/preview.dto';

interface Field {
  key: string; label: string; type: PersonalizationType; required: boolean;
  componentKey: string | null; minLength: number | null; maxLength: number | null;
  minValue: number | null; maxValue: number | null;
  options: { key: string; label: string }[];
}

export function validatePersonalization(fields: Field[], input: PreviewAnswerDto[]): PreviewAnswerResultDto[] {
  const answers = new Map(input.map(answer => [answer.fieldKey, answer.value]));
  if (answers.size !== input.length) throw new BadRequestException('No repitas campos de personalización.');
  for (const key of answers.keys()) if (!fields.some(field => field.key === key)) throw new BadRequestException('Hay campos que no pertenecen al producto.');
  const result: PreviewAnswerResultDto[] = [];
  for (const field of fields) {
    const raw = answers.get(field.key);
    const value = typeof raw === 'string' ? raw.normalize('NFC').trim() : raw;
    if (value === undefined || value === '') {
      if (field.required) throw new BadRequestException('Completá el campo obligatorio: ' + field.key + '.');
      continue;
    }
    let displayValue: string | number = value;
    if (field.type === 'SHORT_TEXT' || field.type === 'LONG_TEXT') {
      if (typeof value !== 'string') throw new BadRequestException('El campo ' + field.key + ' requiere texto.');
      const length = [...value].length;
      const max = Math.min(field.type === 'SHORT_TEXT' ? 240 : 2000, field.maxLength ?? Infinity);
      if (length < (field.minLength ?? 0) || length > max) throw new BadRequestException('El texto de ' + field.key + ' no cumple los límites.');
    } else if (field.type === 'NUMBER') {
      if (typeof value !== 'number' || !Number.isFinite(value) || (field.minValue !== null && value < field.minValue) || (field.maxValue !== null && value > field.maxValue)) throw new BadRequestException('El número de ' + field.key + ' no cumple los límites.');
    } else {
      const option = field.options.find(item => item.key === value);
      if (typeof value !== 'string' || !option) throw new BadRequestException('La opción de ' + field.key + ' no es válida.');
      displayValue = option.label;
    }
    result.push({ fieldKey: field.key, label: field.label, type: field.type, componentKey: field.componentKey, value, displayValue });
  }
  return result;
}
