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

/** Dónde dormir y dónde comer; lo que hay que ver son los sitios de interés de cada etapa */
export const tipoLugarSchema = z.enum(['dormir', 'comer']);
export type TipoLugar = z.infer<typeof tipoLugarSchema>;

/** Etapa del Camino o viaje en coche de ida o de vuelta (fuera de la numeración y de los totales) */
export const tipoEtapaSchema = z.enum(['camino', 'ida', 'vuelta']);
export type TipoEtapa = z.infer<typeof tipoEtapaSchema>;

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

/** Sitio de interés de una etapa: se marca en el mapa con una estrella, aunque quede fuera de la ruta */
export const sitioSchema = z.object({
  nombre: z.string(),
  localidad: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  nota: z.string().nullable(),
});
export type Sitio = z.infer<typeof sitioSchema>;

export const etapaSchema = z.object({
  id: z.string().uuid(),
  tipo: tipoEtapaSchema,
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
  sitios: z.array(sitioSchema),
});
export type Etapa = z.infer<typeof etapaSchema>;

export const lugarSchema = z.object({
  id: z.string().uuid(),
  etapaId: z.string().uuid(),
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
  /** Solo las etapas del Camino, en orden */
  etapas: z.array(etapaSchema),
  /** Viajes en coche de ida y vuelta, si se han anotado */
  ida: etapaSchema.nullable(),
  vuelta: etapaSchema.nullable(),
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

// ---------- Editor (solo autor) ----------

/** Texto opcional de formulario: '' se guarda como null */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** Fecha opcional de formulario ('AAAA-MM-DD' o '') */
const fechaOpcional = z
  .union([fecha, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const uuidOpcional = z.string().uuid().nullable().optional();

export const estadoTramoSchema = z.enum(['borrador', 'publicado']);
export type EstadoTramo = z.infer<typeof estadoTramoSchema>;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones');

export const caminoEntradaSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color en formato #RRGGBB'),
});
export type CaminoEntrada = z.infer<typeof caminoEntradaSchema>;

export const tramoEntradaSchema = z.object({
  anio: z.number().int().min(1990).max(2100),
  /** slug del camino */
  camino: z.string().min(1),
  titulo: z.string().trim().min(1).max(160),
  resumen: textoOpcional(2000),
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  /** Si falta, se genera a partir del año y el camino */
  slug: slugSchema.optional(),
});
export type TramoEntrada = z.input<typeof tramoEntradaSchema>;

export const tramoCambiosSchema = tramoEntradaSchema.partial().extend({
  portadaFotoId: uuidOpcional,
});
export type TramoCambios = z.input<typeof tramoCambiosSchema>;

export const perfilRutaSchema = z.enum(['driving-car', 'foot-walking', 'foot-hiking']);
export type PerfilRuta = z.infer<typeof perfilRutaSchema>;

export const sitioEntradaSchema = z.object({
  nombre: z.string().trim().min(1).max(160),
  localidad: textoOpcional(120).transform((v) => v ?? null),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  nota: textoOpcional(1000).transform((v) => v ?? null),
});
export type SitioEntrada = z.input<typeof sitioEntradaSchema>;

export const etapaEntradaSchema = z.object({
  /** Solo al crear: una etapa no cambia de tipo */
  tipo: tipoEtapaSchema.optional(),
  titulo: z.string().trim().min(1).max(160),
  fecha: fechaOpcional,
  origen: puntoSchema.nullable().optional(),
  destino: puntoSchema.nullable().optional(),
  via: z.array(puntoSchema).max(20).optional(),
  notas: textoOpcional(4000),
  km: z.number().min(0).max(9999).nullable().optional(),
  desnivelPos: z.number().int().min(0).max(20000).nullable().optional(),
  desnivelNeg: z.number().int().min(0).max(20000).nullable().optional(),
  sitios: z.array(sitioEntradaSchema).max(30).optional(),
});
export type EtapaEntrada = z.input<typeof etapaEntradaSchema>;

export const etapaCambiosSchema = etapaEntradaSchema.omit({ tipo: true }).partial().strict();
export type EtapaCambios = z.input<typeof etapaCambiosSchema>;

export const ordenEtapasSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export const calcularRutaSchema = z.object({ perfil: perfilRutaSchema.default('driving-car') });

export const lugarEntradaSchema = z.object({
  tipo: tipoLugarSchema,
  nombre: z.string().trim().min(1).max(160),
  localidad: textoOpcional(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  precio: z.number().int().min(1).max(3).nullable().optional(),
  nota: textoOpcional(2000),
  url: z
    .union([z.string().trim().url().max(500), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  /** Etapa a la que pertenece (obligatoria) */
  etapaId: z.string().uuid(),
});
export type LugarEntrada = z.input<typeof lugarEntradaSchema>;

export const lugarCambiosSchema = lugarEntradaSchema.partial();

export const notaEntradaSchema = z.object({
  texto: z.string().trim().min(1).max(4000),
  fecha: fechaOpcional,
  etapaId: uuidOpcional,
});
export type NotaEntrada = z.input<typeof notaEntradaSchema>;

export const notaCambiosSchema = notaEntradaSchema.partial();

export const varianteFotoSchema = z.enum(['grande', 'mini']);
export type VarianteFoto = z.infer<typeof varianteFotoSchema>;

/** Respuesta a la petición de firma: dónde subir cada versión de una foto nueva */
export const firmaFotoSchema = z.object({
  id: z.string().uuid(),
  contentType: z.literal('image/webp'),
  subidas: z.array(z.object({ variante: varianteFotoSchema, url: z.string().url() })),
});
export type FirmaFoto = z.infer<typeof firmaFotoSchema>;

export const fotoEntradaSchema = z.object({
  /** El id que devolvió la firma */
  id: z.string().uuid(),
  ancho: z.number().int().min(1).max(8000),
  alto: z.number().int().min(1).max(8000),
  tomadaEn: z.string().datetime({ offset: true }).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lon: z.number().min(-180).max(180).nullable().optional(),
  pie: textoOpcional(300),
  etapaId: uuidOpcional,
  mostrarPosicion: z.boolean().optional(),
});
export type FotoEntrada = z.input<typeof fotoEntradaSchema>;

export const fotoCambiosSchema = z.object({
  pie: textoOpcional(300),
  etapaId: uuidOpcional,
  mostrarPosicion: z.boolean().optional(),
  orden: z.number().int().min(0).optional(),
});
export type FotoCambios = z.input<typeof fotoCambiosSchema>;

/** Resultado del buscador de localidades */
export const lugarGeoSchema = z.object({
  nombre: z.string(),
  /** Nombre con provincia y país, para distinguir homónimos */
  etiqueta: z.string(),
  lat: z.number(),
  lon: z.number(),
});
export type LugarGeo = z.infer<typeof lugarGeoSchema>;

/** Fila de la lista del editor: incluye borradores */
export const tramoAdminSchema = tramoResumenSchema.omit({ ruta: true }).extend({
  id: z.string().uuid(),
  estado: estadoTramoSchema,
  actualizadoEn: z.string(),
});
export type TramoAdmin = z.infer<typeof tramoAdminSchema>;

/** En el editor, la foto conserva su posición aunque esté oculta al público */
export const fotoEditorSchema = fotoSchema.extend({ mostrarPosicion: z.boolean() });
export type FotoEditor = z.infer<typeof fotoEditorSchema>;

export const tramoEditorSchema = tramoDetalleSchema.extend({
  id: z.string().uuid(),
  estado: estadoTramoSchema,
  portadaFotoId: z.string().uuid().nullable(),
  fotos: z.array(fotoEditorSchema),
});
export type TramoEditor = z.infer<typeof tramoEditorSchema>;
