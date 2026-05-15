import { SENSITIVE_FIELD_FRAGMENTS } from './constants';
import type { ScrapedField } from './types';

const REDACTED = '<redacted>';

export function isSensitiveFieldName(name: string): boolean {
  const lower = name.toLowerCase();
  return SENSITIVE_FIELD_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

export function redactValue(name: string, value: string): string {
  if (isSensitiveFieldName(name)) return REDACTED;
  if (value.length > 200) return `${value.slice(0, 200)}…(truncated)`;
  return value;
}

export function buildPayloadPreview(
  fields: readonly ScrapedField[],
): Record<string, string> {
  const preview: Record<string, string> = {};
  for (const field of fields) {
    preview[field.name] = redactValue(field.name, field.value);
  }
  return preview;
}

export function truncateBody(body: string, maxLength = 500): string {
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength)}…(truncated, ${body.length - maxLength} chars hidden)`;
}
