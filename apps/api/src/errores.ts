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

interface Esquema<T> {
  safeParse(datos: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

/** Valida con un esquema Zod; si falla, 400 con la lista de campos incorrectos */
export function validar<T>(esquema: Esquema<T>, datos: unknown): T {
  const r = esquema.safeParse(datos);
  if (r.success) return r.data;
  const campos = r.error.issues.map((i) => ({ campo: i.path.map(String).join('.'), mensaje: i.message }));
  throw new HttpError(400, 'datos-invalidos', 'Hay datos incorrectos', campos);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id de la URL que no es un uuid no puede existir: 404 en vez de un error de Postgres */
export function idValido(id: string, que = 'No encontrado'): string {
  if (!UUID.test(id)) throw noEncontrado(que);
  return id;
}
