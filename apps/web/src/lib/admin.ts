// Sesión del autor y llamadas del editor. Todas las escrituras de un tramo devuelven el tramo
// completo, que se guarda directamente en la caché de TanStack Query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  caminoSchema,
  firmaFotoSchema,
  lugarGeoSchema,
  type Login,
  type TramoEditor,
  tramoAdminSchema,
  tramoEditorSchema,
  usuarioSchema,
} from '@caminos/shared';
import { ApiError, enviar, getJson } from './api';

// Marca no sensible para mostrar «Modo editor» en la web pública sin consultar al API.
// La sesión real va en una cookie httpOnly que el navegador no deja leer.
const MARCA_AUTOR = 'caminos:autor';

export function pareceAutor(): boolean {
  try {
    return localStorage.getItem(MARCA_AUTOR) === '1';
  } catch {
    return false;
  }
}

function marcarAutor(si: boolean) {
  try {
    if (si) localStorage.setItem(MARCA_AUTOR, '1');
    else localStorage.removeItem(MARCA_AUTOR);
  } catch {
    // Sin almacenamiento local, solo se pierde el atajo
  }
}

// ---------- Sesión ----------

async function fetchSesion() {
  try {
    const usuario = await getJson('/api/auth/me', usuarioSchema);
    marcarAutor(true);
    return usuario;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      marcarAutor(false);
      return null;
    }
    throw err;
  }
}

export const useSesion = () => useQuery({ queryKey: ['sesion'], queryFn: fetchSesion, retry: false, staleTime: 60_000 });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: Login) => enviar('POST', '/api/auth/login', usuarioSchema, datos),
    onSuccess: (usuario) => {
      marcarAutor(true);
      qc.setQueryData(['sesion'], usuario);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => enviar('POST', '/api/auth/logout', null),
    onSuccess: () => {
      marcarAutor(false);
      qc.setQueryData(['sesion'], null);
      qc.removeQueries({ queryKey: ['admin'] });
    },
  });
}

// ---------- Lecturas del editor ----------

export const useTramosAdmin = () =>
  useQuery({ queryKey: ['admin', 'tramos'], queryFn: () => getJson('/api/admin/tramos', tramoAdminSchema.array()) });

export const useTramoEditor = (id: string) =>
  useQuery({ queryKey: ['admin', 'tramo', id], queryFn: () => getJson(`/api/admin/tramos/${id}`, tramoEditorSchema) });

export const useCaminos = () => useQuery({ queryKey: ['caminos'], queryFn: () => getJson('/api/caminos', caminoSchema.array()) });

export const buscarLocalidad = (q: string) => getJson(`/api/admin/geo/buscar?${new URLSearchParams({ q })}`, lugarGeoSchema.array());

export const nombrarPunto = (lat: number, lon: number) =>
  getJson(`/api/admin/geo/inverso?${new URLSearchParams({ lat: String(lat), lon: String(lon) })}`, lugarGeoSchema.nullable());

// ---------- Escrituras ----------

/** Tras cambiar un tramo, la web pública y la lista del editor deben volver a pedirse */
function useRefrescar() {
  const qc = useQueryClient();
  return (tramo?: TramoEditor) => {
    if (tramo) qc.setQueryData(['admin', 'tramo', tramo.id], tramo);
    qc.invalidateQueries({ queryKey: ['admin', 'tramos'] });
    qc.invalidateQueries({ queryKey: ['tramos'] });
  };
}

/** Mutación genérica sobre un tramo: recibe la petición y guarda el tramo que devuelve */
export function useCambio<V>(peticion: (variables: V) => Promise<TramoEditor>) {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: peticion, onSuccess: refrescar });
}

export const editar = (metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
  enviar(metodo, path, tramoEditorSchema, body);

export function useCrearCamino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { nombre: string; color: string }) => enviar('POST', '/api/admin/caminos', caminoSchema, datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caminos'] }),
  });
}

export function useBorrarTramo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enviar('DELETE', `/api/admin/tramos/${id}`, null),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: ['admin', 'tramo', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'tramos'] });
      qc.invalidateQueries({ queryKey: ['tramos'] });
    },
  });
}

export const firmarFoto = (tramoId: string) => enviar('POST', `/api/admin/tramos/${tramoId}/fotos/firmar`, firmaFotoSchema);
