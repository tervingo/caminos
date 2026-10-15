// Cliente del API: cada respuesta se valida con los esquemas de @caminos/shared.
import { errorSchema, tramoDetalleSchema, tramoResumenSchema } from '@caminos/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(path: string, schema: { parse(data: unknown): T }): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const cuerpo = errorSchema.safeParse(await res.json().catch(() => null));
    throw new ApiError(res.status, cuerpo.success ? cuerpo.data.error.message : `HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
}

export const fetchTramos = () => getJson('/api/tramos', tramoResumenSchema.array());

export const fetchTramo = (slug: string) => getJson(`/api/tramos/${encodeURIComponent(slug)}`, tramoDetalleSchema);
