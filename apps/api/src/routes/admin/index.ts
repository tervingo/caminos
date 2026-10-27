import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { LugarGeo } from '@caminos/shared';
import { requiereAutor } from '../../auth.js';
import { validar } from '../../errores.js';
import type { OpcionesAdmin } from './comun.js';
import { contenidoAdmin } from './contenido.js';
import { etapasAdmin } from './etapas.js';
import { fotosAdmin } from './fotos.js';
import { tramosAdmin } from './tramos.js';

// lat y lon (opcionales): un punto de referencia para que salgan antes las localidades cercanas
const busquedaSchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});
const puntoSchema = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) });

/** Todo lo que cuelga de /api/admin exige sesión del autor */
export const adminRoutes: FastifyPluginAsync<OpcionesAdmin> = async (app, opciones) => {
  app.addHook('preHandler', requiereAutor);

  await app.register(tramosAdmin, opciones);
  await app.register(etapasAdmin, opciones);
  await app.register(contenidoAdmin, opciones);
  await app.register(fotosAdmin, opciones);

  // Buscador de localidades desde el servidor, para no exponer la clave de ORS en el navegador
  const { buscador } = opciones;

  app.get('/api/admin/geo/buscar', async (req): Promise<LugarGeo[]> => {
    const { q, lat, lon } = validar(busquedaSchema, req.query);
    return buscador.buscar(q, lat !== undefined && lon !== undefined ? { lat, lon } : undefined);
  });

  app.get('/api/admin/geo/inverso', async (req): Promise<LugarGeo | null> => {
    const { lat, lon } = validar(puntoSchema, req.query);
    return buscador.inverso(lat, lon);
  });
};
