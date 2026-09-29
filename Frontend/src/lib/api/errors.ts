export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly requestId?: string,
    public readonly retryAfter?: string,
    public readonly messages: string[] = [message],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'No pudimos completar la solicitud. Intentá nuevamente.';
    let messages: string[] = [];
    try {
      const data: unknown = await response.json();
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const detail = data.message;
        if (typeof detail === 'string') message = detail;
        else if (Array.isArray(detail) && detail.every((item) => typeof item === 'string')) { messages = detail; message = detail.join(' '); }
      }
    } catch { /* Un error de red o proxy puede no contener JSON. */ }
    throw new ApiError(response.status, message, response.headers.get('x-request-id') ?? undefined, response.headers.get('retry-after') ?? undefined, messages.length ? messages : [message]);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
