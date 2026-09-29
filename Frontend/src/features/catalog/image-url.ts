export function isCatalogImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.port &&
      !url.username && !url.password && !url.search && !url.hash &&
      /^\/[a-zA-Z0-9_-]+\/image\/upload\/.+/.test(url.pathname);
  } catch { return false; }
}
