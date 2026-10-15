import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { LugarGeo } from '@caminos/shared';
import { requiereAutor } from '../../auth.js';
import { HttpError, validar } from '../../errores.js';
import type { OpcionesAdmin } from './comun.js';
import { contenidoAdmin } from './contenido.js';
import { etapasAdmin } from './etapas.js';
import { fotosAdmin } from './fotos.js';
import { tramosAdmin } from './tramos.js';

const busquedaSchema = z.object({ q: z.string().trim().min(2).max(120) });
const puntoSchema = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) });

/** Todo lo que cuelga de /api/admin exige sesión del autor */
export const adminRoutes: FastifyPluginAsync<OpcionesAdmin> = async (app, opciones) => {
  app.addHook('preHandler', requiereAutor);

  await app.register(tramosAdmin, opciones);
  await app.register(etapasAdmin, opciones);
  await app.register(contenidoAdmin, opciones);
  await app.register(fotosAdmin, opciones);

  // Buscador de localidades (OpenRouteService), para no exponer su clave en el navegador
  const ors = () => {
    if (!opciones.ors) throw new HttpError(503, 'rutas-sin-configurar', 'Falta la clave de OpenRouteService (ORS_API_KEY)');
    return opciones.ors;
  };

  app.get('/api/admin/geo/buscar', async (req): Promise<LugarGeo[]> => {
    const { q } = validar(busquedaSchema, req.query);
    return ors().buscar(q);
  });

  app.get('/api/admin/geo/inverso', async (req): Promise<LugarGeo | null> => {
    const { lat, lon } = validar(puntoSchema, req.query);
    return ors().inverso(lat, lon);
  });
};
