import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { conectar, migrar } from './db/index.js';

const config = loadConfig();
const conexion = config.DATABASE_URL ? conectar(config.DATABASE_URL) : undefined;
const app = buildApp(config, conexion);
app.addHook('onClose', async () => {
  await conexion?.pool.end();
});

try {
  if (conexion) {
    await migrar(conexion.db);
    app.log.info('Migraciones aplicadas');
  } else {
    app.log.warn('Sin DATABASE_URL: solo responde /api/health');
  }
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
