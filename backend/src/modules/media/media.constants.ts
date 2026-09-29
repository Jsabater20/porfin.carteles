export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_MAX_IMAGES = 12;
export const MEDIA_FORMATS = ['jpg', 'png', 'webp'];
export const MEDIA_MAX_PIXELS = 40_000_000;
export const MEDIA_INTENT_TTL_MS = 15 * 60 * 1000;
// Cloudinary acepta firmas durante una hora. Esperamos un margen adicional
// antes de borrar: una firma aún vigente podría volver a crear el archivo.
export const MEDIA_CLEANUP_DELAY_MS = 65 * 60 * 1000;
