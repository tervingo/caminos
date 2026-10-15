// Lugares (dormir y comer, siempre de una etapa) y notas (del tramo o de una etapa).
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import {
  lugarCambiosSchema,
  lugarEntradaSchema,
  notaCambiosSchema,
  notaEntradaSchema,
  type TramoEditor,
} from '@caminos/shared';
import { lugares, notas } from '../../db/schema.js';
import { idValido, noEncontrado, validar } from '../../errores.js';
import { cargarTramo, comprobarEtapa, type OpcionesAdmin, recalcularTramo, tramoEditor } from './comun.js';

type Params = { Params: { id: string } };

export const contenidoAdmin: FastifyPluginAsync<OpcionesAdmin> = async (app, { db, assetsUrl }) => {
  // ---------- Lugares ----------

  const cargarLugar = async (id: string) => {
    const [lugar] = await db.select().from(lugares).where(eq(lugares.id, idValido(id, 'No existe ese lugar')));
    if (!lugar) throw noEncontrado('No existe ese lugar');
    return lugar;
  };

  app.post<Params>('/api/admin/tramos/:id/lugares', async (req, reply): Promise<TramoEditor> => {
    const { tramo } = await cargarTramo(db, req.params.id);
    const datos = validar(lugarEntradaSchema, req.body);
    await comprobarEtapa(db, tramo.id, datos.etapaId);
    await db.insert(lugares).values({
      ...datos,
      tramoId: tramo.id,
      localidad: datos.localidad ?? null,
      precio: datos.precio ?? null,
      nota: datos.nota ?? null,
      url: datos.url ?? null,
    });
    await recalcularTramo(db, tramo.id);
    reply.code(201);
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  app.patch<Params>('/api/admin/lugares/:id', async (req): Promise<TramoEditor> => {
    const lugar = await cargarLugar(req.params.id);
    const datos = validar(lugarCambiosSchema, req.body);
    await comprobarEtapa(db, lugar.tramoId, datos.etapaId);
    await db.update(lugares).set(datos).where(eq(lugares.id, lugar.id));
    await recalcularTramo(db, lugar.tramoId);
    return tramoEditor(db, assetsUrl, lugar.tramoId);
  });

  app.delete<Params>('/api/admin/lugares/:id', async (req): Promise<TramoEditor> => {
    const lugar = await cargarLugar(req.params.id);
    await db.delete(lugares).where(eq(lugares.id, lugar.id));
    await recalcularTramo(db, lugar.tramoId);
    return tramoEditor(db, assetsUrl, lugar.tramoId);
  });

  // ---------- Notas ----------

  const cargarNota = async (id: string) => {
    const [nota] = await db.select().from(notas).where(eq(notas.id, idValido(id, 'No existe esa nota')));
    if (!nota) throw noEncontrado('No existe esa nota');
    return nota;
  };

  app.post<Params>('/api/admin/tramos/:id/notas', async (req, reply): Promise<TramoEditor> => {
    const { tramo } = await cargarTramo(db, req.params.id);
    const datos = validar(notaEntradaSchema, req.body);
    await comprobarEtapa(db, tramo.id, datos.etapaId);
    await db.insert(notas).values({ tramoId: tramo.id, texto: datos.texto, fecha: datos.fecha ?? null, etapaId: datos.etapaId ?? null });
    reply.code(201);
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  app.patch<Params>('/api/admin/notas/:id', async (req): Promise<TramoEditor> => {
    const nota = await cargarNota(req.params.id);
    const datos = validar(notaCambiosSchema, req.body);
    await comprobarEtapa(db, nota.tramoId, datos.etapaId);
    await db.update(notas).set(datos).where(eq(notas.id, nota.id));
    return tramoEditor(db, assetsUrl, nota.tramoId);
  });

  app.delete<Params>('/api/admin/notas/:id', async (req): Promise<TramoEditor> => {
    const nota = await cargarNota(req.params.id);
    await db.delete(notas).where(eq(notas.id, nota.id));
    return tramoEditor(db, assetsUrl, nota.tramoId);
  });
};
