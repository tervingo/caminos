import { conectar, type Conexion } from '../db/index.js';

/** Abre la base de DATABASE_URL, ejecuta `tarea` y cierra la conexión. */
export async function conBase(tarea: (conexion: Conexion) => Promise<void>): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL (en apps/api/.env o en el entorno).');
    process.exit(1);
  }
  const conexion = conectar(url);
  try {
    await tarea(conexion);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await conexion.pool.end();
  }
}

/** Host de la base, sin credenciales, para saber dónde se está escribiendo */
export function destino(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host;
  } catch {
    return '(desconocido)';
  }
}
