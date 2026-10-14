import { hash, verify } from '@node-rs/argon2';
import type { FastifyRequest } from 'fastify';
import { HttpError } from './errores.js';

export const COOKIE_SESION = 'sesion';
export const DURACION_SESION_S = 7 * 24 * 60 * 60;

export interface Sesion {
  sub: string; // id del usuario
  email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Sesion;
    user: Sesion;
  }
}

// argon2id con los parámetros por defecto de @node-rs/argon2 (19 MiB, 2 iteraciones)
export const hashPassword = (password: string) => hash(password);

// Hash de una contraseña cualquiera, para gastar el mismo tiempo cuando el email no existe
const hashFicticio = hash('contraseña-que-no-existe');

export async function comprobarPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash ?? (await hashFicticio), password);
  } catch {
    return false;
  }
}

/** preHandler para las rutas del autor */
export async function requiereAutor(req: FastifyRequest): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw new HttpError(401, 'no-autenticado', 'Hace falta iniciar sesión');
  }
}

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Defensa frente a CSRF: las escrituras deben venir de un origen conocido */
export function comprobarOrigen(origenesPermitidos: string[]) {
  return async (req: FastifyRequest): Promise<void> => {
    if (METODOS_SEGUROS.has(req.method)) return;
    const origen = req.headers.origin;
    if (!origen || !origenesPermitidos.includes(origen)) {
      throw new HttpError(403, 'origen-no-permitido', 'Origen no permitido');
    }
  };
}
