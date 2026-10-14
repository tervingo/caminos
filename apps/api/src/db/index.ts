import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema.js';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface Conexion {
  db: Db;
  pool: pg.Pool;
}

export function conectar(databaseUrl: string): Conexion {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}

// Desde src/db o dist/db, las migraciones están en apps/api/drizzle
const carpetaMigraciones = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function migrar(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: carpetaMigraciones });
}

export async function comprobarDb(pool: pg.Pool | undefined): Promise<'ok' | 'error' | 'sin-configurar'> {
  if (!pool) return 'sin-configurar';
  try {
    await pool.query('select 1');
    return 'ok';
  } catch {
    return 'error';
  }
}
