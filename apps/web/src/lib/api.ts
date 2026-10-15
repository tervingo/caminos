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

/** Ninguna petición puede dejar la interfaz colgada: a los 30 s se da por perdida */
const LIMITE_MS = 30_000;

async function pedir<T>(metodo: Metodo, path: string, schema: Esquema<T> | null, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: metodo,
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(LIMITE_MS),
    });
  } catch (err) {
    throw sinRespuesta(err);
  }
  if (!res.ok) {
    const cuerpo = errorSchema.safeParse(await res.json().catch(() => null));
    if (!cuerpo.success) throw new ApiError(res.status, `HTTP ${res.status}`);
    const { code, message, details } = cuerpo.data.error;
    const campos = Array.isArray(details) ? (details as ErrorCampo[]).filter((d) => typeof d?.campo === 'string') : [];
    throw new ApiError(res.status, message, code, campos);
  }
  if (res.status === 204 || schema === null) return undefined as T;
  // El cuerpo también puede cortarse a medias
  const datos = await res.json().catch((err) => {
    throw sinRespuesta(err);
  });
  return schema.parse(datos);
}

function sinRespuesta(err: unknown): ApiError {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new ApiError(0, 'El servidor no ha respondido a tiempo. Recarga la página para ver si se guardó.', 'tiempo-agotado');
  }
  return new ApiError(0, 'Se ha perdido la conexión con el servidor. Recarga la página para ver si se guardó.', 'sin-conexion');
}

export const getJson = <T>(path: string, schema: Esquema<T>) => pedir('GET', path, schema);

export const enviar = <T>(metodo: Exclude<Metodo, 'GET'>, path: string, schema: Esquema<T> | null, body?: unknown) =>
  pedir(metodo, path, schema, body);

export const fetchTramos = () => getJson('/api/tramos', tramoResumenSchema.array());

export const fetchTramo = (slug: string) => getJson(`/api/tramos/${encodeURIComponent(slug)}`, tramoDetalleSchema);
