import { migrar } from '../db/index.js';
import { sembrar } from '../db/semilla.js';
import { tramosSemilla } from '../db/semilla-datos.js';
import { conBase, destino } from './comun.js';

await conBase(async ({ db }) => {
  await migrar(db);
  await sembrar(db);
  console.log(`Semilla cargada en ${destino()}: ${tramosSemilla.map((t) => t.slug).join(', ')}`);
});
