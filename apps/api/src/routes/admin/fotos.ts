// Fotos: el navegador las reduce a WebP, pide una firma, las sube directo a R2 y luego las registra.
// El API nunca recibe la imagen; solo comprueba en R2 que lo subido es lo esperado.
import { randomUUID } from 'node:crypto';
import { eq, max } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { type FirmaFoto, fotoCambiosSchema, fotoEntradaSchema, type TramoEditor, type VarianteFoto } from '@caminos/shared';
import { etapas, fotos, tramos } from '../../db/schema.js';
import { HttpError, idValido, noEncontrado, validar } from '../../errores.js';
import type { R2 } from '../../r2.js';
import { cargarTramo, comprobarEtapa, type OpcionesAdmin, recalcularTramo, tramoEditor } from './comun.js';

type Params = { Params: { id: string } };

const TIPO = 'image/webp';
const LIMITE: Record<VarianteFoto, number> = { grande: 5 * 1024 * 1024, mini: 1024 * 1024 };

export const claveFoto = (tramoId: string, fotoId: string, variante: VarianteFoto) => `fotos/${tramoId}/${fotoId}-${variante}.webp`;

function requiereR2(r2: R2 | undefined): R2 {
  if (!r2) throw new HttpError(503, 'almacenamiento-sin-configurar', 'Falta la configuración de R2');
  return r2;
}

export const fotosAdmin: FastifyPluginAsync<OpcionesAdmin> = async (app, { db, assetsUrl, r2 }) => {
  const cargarFoto = async (id: string) => {
    const [foto] = await db.select().from(fotos).where(eq(fotos.id, idValido(id, 'No existe esa foto')));
    if (!foto) throw noEncontrado('No existe esa foto');
    return foto;
  };

  app.post<Params>('/api/admin/tramos/:id/fotos/firmar', async (req): Promise<FirmaFoto> => {
    const almacen = requiereR2(r2);
    const { tramo } = await cargarTramo(db, req.params.id);
    const id = randomUUID();
    const variantes: VarianteFoto[] = ['grande', 'mini'];
    return {
      id,
      contentType: TIPO,
      subidas: await Promise.all(
        variantes.map(async (variante) => ({ variante, url: await almacen.firmarSubida(claveFoto(tramo.id, id, variante), TIPO) })),
      ),
    };
  });

  app.post<Params>('/api/admin/tramos/:id/fotos', async (req, reply): Promise<TramoEditor> => {
    const almacen = requiereR2(r2);
    const { tramo } = await cargarTramo(db, req.params.id);
    const datos = validar(fotoEntradaSchema, req.body);
    await comprobarEtapa(db, tramo.id, datos.etapaId);

    const keyGrande = claveFoto(tramo.id, datos.id, 'grande');
    const keyMini = claveFoto(tramo.id, datos.id, 'mini');
    const [grande, mini] = await Promise.all([almacen.cabecera(keyGrande), almacen.cabecera(keyMini)]);
    const valida = (c: typeof grande, variante: VarianteFoto) => c && c.contentType === TIPO && c.tamano > 0 && c.tamano <= LIMITE[variante];
    if (!valida(grande, 'grande') || !valida(mini, 'mini')) {
      await almacen.borrar([keyGrande, keyMini]).catch((err) => req.log.error(err));
      throw new HttpError(422, 'foto-invalida', 'La foto no se subió bien o no es un WebP de tamaño permitido');
    }

    const [{ ultima }] = await db.select({ ultima: max(fotos.orden) }).from(fotos).where(eq(fotos.tramoId, tramo.id));
    await db.insert(fotos).values({
      id: datos.id,
      tramoId: tramo.id,
      etapaId: datos.etapaId ?? null,
      keyGrande,
      keyMini,
      ancho: datos.ancho,
      alto: datos.alto,
      pie: datos.pie ?? null,
      tomadaEn: datos.tomadaEn ? new Date(datos.tomadaEn) : null,
      lat: datos.lat ?? null,
      lon: datos.lon ?? null,
      mostrarPosicion: datos.mostrarPosicion ?? true,
      orden: (ultima ?? -1) + 1,
    });
    // La primera foto hace de portada hasta que se elija otra
    if (!tramo.portadaFotoId) await db.update(tramos).set({ portadaFotoId: datos.id }).where(eq(tramos.id, tramo.id));
    await recalcularTramo(db, tramo.id);
    reply.code(201);
    return tramoEditor(db, assetsUrl, tramo.id);
  });

  app.patch<Params>('/api/admin/fotos/:id', async (req): Promise<TramoEditor> => {
    const foto = await cargarFoto(req.params.id);
    const datos = validar(fotoCambiosSchema, req.body);
    await comprobarEtapa(db, foto.tramoId, datos.etapaId);
    await db.update(fotos).set(datos).where(eq(fotos.id, foto.id));
    await recalcularTramo(db, foto.tramoId);
    return tramoEditor(db, assetsUrl, foto.tramoId);
  });

  app.delete<Params>('/api/admin/fotos/:id', async (req): Promise<TramoEditor> => {
    const foto = await cargarFoto(req.params.id);
    await db.delete(fotos).where(eq(fotos.id, foto.id));
    // Los lugares la sueltan solos (clave ajena); los sitios de interés van en JSON
    const conEsaFoto = await db.select({ id: etapas.id, sitios: etapas.sitios }).from(etapas).where(eq(etapas.tramoId, foto.tramoId));
    for (const e of conEsaFoto.filter((x) => x.sitios.some((s) => s.fotoId === foto.id))) {
      const sitios = e.sitios.map((s) => (s.fotoId === foto.id ? { ...s, fotoId: null } : s));
      await db.update(etapas).set({ sitios }).where(eq(etapas.id, e.id));
    }
    await r2?.borrar([foto.keyGrande, foto.keyMini]).catch((err) => req.log.error(err, 'No se pudo borrar la foto de R2'));
    await recalcularTramo(db, foto.tramoId);
    return tramoEditor(db, assetsUrl, foto.tramoId);
  });
};
