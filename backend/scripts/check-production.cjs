const { existsSync } = require('node:fs');
if (existsSync('.env')) process.loadEnvFile('.env');
let validateEnvironment;
try { ({ validateEnvironment } = require('../dist/config/environment')); }
catch { console.error('Ejecutá npm run build antes de validar producción.'); process.exit(1); }
try {
  if (process.env.NODE_ENV !== 'production') throw new Error('check:production requiere NODE_ENV=production.');
  const env = validateEnvironment(process.env);
  if (env.SWAGGER_ENABLED) throw new Error('Deshabilitá SWAGGER_ENABLED antes de publicar.');
  if (env.MAIL_MODE !== 'smtp') throw new Error('Configurá MAIL_MODE=smtp antes de publicar.');
  if (!env.CLOUDINARY_CLOUD_NAME) throw new Error('Configurá Cloudinary antes de publicar.');
  console.log('Configuración de producción válida. No se verificaron credenciales remotas ni conectividad.');
} catch (error) {
  // validateEnvironment solamente emite mensajes propios sin valores de variables.
  console.error(error.message);
  process.exitCode = 1;
}