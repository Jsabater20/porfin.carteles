import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    if (response.headersSent) return;
    const requestId = response.locals.requestId ?? randomUUID();
    let statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    // Errores del parser ocurren antes de los controllers.
    const parserError = exception as { type?: string; status?: number } | null;
    if (parserError?.type === 'entity.parse.failed') statusCode = 400;
    if (parserError?.type === 'entity.too.large' || parserError?.type === 'parameters.too.many') statusCode = 413;
    if (parserError?.type === 'encoding.unsupported' || parserError?.type === 'charset.unsupported') statusCode = 415;
    let message: string | string[] = 'Error interno del servidor.';
    if (statusCode < 500 && exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const detail = (body as { message?: unknown }).message;
        if (typeof detail === 'string') message = detail;
        else if (Array.isArray(detail) && detail.every(item => typeof item === 'string')) message = detail;
        else message = 'La solicitud no pudo procesarse.';
      }
    }
    if (statusCode === 400 && parserError?.type === 'entity.parse.failed') message = 'JSON inválido.';
    if (statusCode === 404) message = 'Ruta no encontrada.';
    if (statusCode === 413) message = 'El cuerpo de la solicitud supera el límite permitido.';
    if (statusCode === 415) message = 'Formato o codificación del cuerpo no admitidos.';
    if (statusCode === 429 && exception instanceof HttpException) {
      const retry = (exception.getResponse() as { retryAfterSeconds?: number }).retryAfterSeconds;
      if (Number.isInteger(retry) && retry! > 0) response.setHeader('Retry-After', String(retry));
    }
    if (statusCode === 503) message = 'Servicio temporalmente no disponible.';
    if (statusCode >= 500) {
      // No registrar cuerpos, cookies, cadenas de conexión ni mensajes de Prisma.
      this.logger.error({ requestId, statusCode, method: request.method, errorType: exception instanceof Error ? exception.name : 'UnknownError' });
    }
    response.setHeader('X-Request-Id', requestId);
    response.status(statusCode).json({ statusCode, message, requestId, timestamp: new Date().toISOString() });
  }
}
