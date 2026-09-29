export function safeContactLink(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}
