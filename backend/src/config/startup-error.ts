/** Diagnose known startup failures without logging connection strings or credentials. */
export function startupErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    const port = 'port' in error && typeof error.port === 'number' && Number.isInteger(error.port) && error.port > 0 && error.port <= 65535 ? String(error.port) : 'configurado';
    return 'No se pudo iniciar la API: el puerto ' + port + ' ya está ocupado. Si el backend ya está ejecutándose en otra terminal, usá esa instancia o detenela antes de volver a ejecutar npm run start.';
  }
  return 'No se pudo iniciar la API. Revisá la configuración y la conexión a PostgreSQL.';
}
