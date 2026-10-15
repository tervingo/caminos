// Cliente del API: cada respuesta se valida con los esquemas de @caminos/shared.
import { errorSchema, tramoDetalleSchema, tramoResumenSchema } from '@caminos/shared';

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
    /** Errores por campo cuando el API responde datos-invalidos */
    readonly campos: ErrorCampo[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Esquema<T> {
  parse(data: unknown): T;
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function pedir<T>(metodo: Metodo, path: string, schema: Esquema<T> | null, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: metodo,
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor', 'sin-conexion');
  }
  if (!res.ok) {
    const cuerpo = errorSchema.safeParse(await res.json().catch(() => null));
    if (!cuerpo.success) throw new ApiError(res.status, `HTTP ${res.status}`);
    const { code, message, details } = cuerpo.data.error;
    const campos = Array.isArray(details) ? (details as ErrorCampo[]).filter((d) => typeof d?.campo === 'string') : [];
    throw new ApiError(res.status, message, code, campos);
  }
  if (res.status === 204 || schema === null) return undefined as T;
  return schema.parse(await res.json());
}

export const getJson = <T>(path: string, schema: Esquema<T>) => pedir('GET', path, schema);

export const enviar = <T>(metodo: Exclude<Metodo, 'GET'>, path: string, schema: Esquema<T> | null, body?: unknown) =>
  pedir(metodo, path, schema, body);

export const fetchTramos = () => getJson('/api/tramos', tramoResumenSchema.array());

export const fetchTramo = (slug: string) => getJson(`/api/tramos/${encodeURIComponent(slug)}`, tramoDetalleSchema);
