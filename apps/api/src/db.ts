import pg from 'pg';

export type Db = pg.Pool;

export function createDb(databaseUrl: string | undefined): Db | undefined {
  if (!databaseUrl) return undefined;
  return new pg.Pool({ connectionString: databaseUrl, max: 5 });
}

export async function comprobarDb(db: Db | undefined): Promise<'ok' | 'error' | 'sin-configurar'> {
  if (!db) return 'sin-configurar';
  try {
    await db.query('select 1');
    return 'ok';
  } catch {
    return 'error';
  }
}
