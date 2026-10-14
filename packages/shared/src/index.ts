import { z } from 'zod';

// ---------- Utilidades ----------

export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  time: z.string(),
  db: z.enum(['ok', 'error', 'sin-configurar']),
});
export type Health = z.infer<typeof healthSchema>;

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof errorSchema>;

// ---------- Geometría (GeoJSON: [lon, lat]) ----------

export const puntoSchema = z.object({
  nombre: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Punto = z.infer<typeof puntoSchema>;

/** [minLon, minLat, maxLon, maxLat], como en GeoJSON */
export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type BBox = z.infer<typeof bboxSchema>;

export const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});
export type LineString = z.infer<typeof lineStringSchema>;

// ---------- Dominio: lectura pública ----------

export const caminoSchema = z.object({
  slug: z.string(),
  nombre: z.string(),
  color: z.string(),
});
export type Camino = z.infer<typeof caminoSchema>;

export const tipoLugarSchema = z.enum(['dormir', 'comer', 'ver']);
export type TipoLugar = z.infer<typeof tipoLugarSchema>;

export const trazaOrigenSchema = z.enum(['carretera', 'gpx', 'manual']);
export type TrazaOrigen = z.infer<typeof trazaOrigenSchema>;

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const fotoSchema = z.object({
  id: z.string().uuid(),
  etapaId: z.string().uuid().nullable(),
  urlGrande: z.string().url(),
  urlMini: z.string().url(),
  ancho: z.number().int(),
  alto: z.number().int(),
  pie: z.string().nullable(),
  tomadaEn: z.string().nullable(),
  /** null si no tiene posición o el autor la oculta */
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  orden: z.number().int(),
});
export type Foto = z.infer<typeof fotoSchema>;

export const tramoResumenSchema = z.object({
  slug: z.string(),
  anio: z.number().int(),
  camino: caminoSchema,
  titulo: z.string(),
  resumen: z.string().nullable(),
  fechaInicio: fecha.nullable(),
  fechaFin: fecha.nullable(),
  kmTotal: z.number(),
  desnivelPosTotal: z.number().int(),
  numEtapas: z.number().int(),
  bbox: bboxSchema.nullable(),
  /** Recorrido muy simplificado de todo el tramo, para la vista de península */
  ruta: lineStringSchema.nullable(),
  portada: fotoSchema.nullable(),
});
export type TramoResumen = z.infer<typeof tramoResumenSchema>;

export const etapaSchema = z.object({
  id: z.string().uuid(),
  posicion: z.number().int(),
  titulo: z.string(),
  fecha: fecha.nullable(),
  origen: puntoSchema.nullable(),
  destino: puntoSchema.nullable(),
  via: z.array(puntoSchema),
  notas: z.string().nullable(),
  km: z.number().nullable(),
  desnivelPos: z.number().int().nullable(),
  desnivelNeg: z.number().int().nullable(),
  traza: lineStringSchema.nullable(),
  trazaOrigen: trazaOrigenSchema,
  bbox: bboxSchema.nullable(),
});
export type Etapa = z.infer<typeof etapaSchema>;

export const lugarSchema = z.object({
  id: z.string().uuid(),
  etapaId: z.string().uuid().nullable(),
  tipo: tipoLugarSchema,
  nombre: z.string(),
  localidad: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  precio: z.number().int().min(1).max(3).nullable(),
  nota: z.string().nullable(),
  url: z.string().nullable(),
});
export type Lugar = z.infer<typeof lugarSchema>;

export const notaSchema = z.object({
  id: z.string().uuid(),
  etapaId: z.string().uuid().nullable(),
  fecha: fecha.nullable(),
  texto: z.string(),
});
export type Nota = z.infer<typeof notaSchema>;

export const tramoDetalleSchema = tramoResumenSchema.omit({ ruta: true }).extend({
  etapas: z.array(etapaSchema),
  lugares: z.array(lugarSchema),
  fotos: z.array(fotoSchema),
  notas: z.array(notaSchema),
});
export type TramoDetalle = z.infer<typeof tramoDetalleSchema>;

// ---------- Acceso del autor ----------

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export type Login = z.infer<typeof loginSchema>;

export const usuarioSchema = z.object({
  email: z.string().email(),
});
export type Usuario = z.infer<typeof usuarioSchema>;
