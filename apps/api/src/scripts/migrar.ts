import { migrar } from '../db/index.js';
import { conBase, destino } from './comun.js';

await conBase(async ({ db }) => {
  await migrar(db);
  console.log(`Migraciones aplicadas en ${destino()}`);
});
