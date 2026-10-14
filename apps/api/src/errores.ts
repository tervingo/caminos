import type { ApiError } from '@caminos/shared';

/** Error con la forma única del API: { error: { code, message, details } } */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  toJSON(): ApiError {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export const noEncontrado = (message = 'No encontrado') => new HttpError(404, 'no-encontrado', message);
