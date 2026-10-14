import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { BBox, LineString, Punto } from '@caminos/shared';

export const estadoTramo = pgEnum('estado_tramo', ['borrador', 'publicado']);
export const tipoLugar = pgEnum('tipo_lugar', ['dormir', 'comer', 'ver']);

export const caminos = pgTable('caminos', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  color: text('color').notNull(),
});

export const tramos = pgTable('tramos', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  anio: integer('anio').notNull(),
  caminoId: integer('camino_id')
    .notNull()
    .references(() => caminos.id),
  titulo: text('titulo').notNull(),
  resumen: text('resumen'),
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  estado: estadoTramo('estado').notNull().default('borrador'),
  kmTotal: numeric('km_total', { precision: 7, scale: 2, mode: 'number' }).notNull().default(0),
  desnivelPosTotal: integer('desnivel_pos_total').notNull().default(0),
  bbox: jsonb('bbox').$type<BBox>(),
  portadaFotoId: uuid('portada_foto_id').references((): AnyPgColumn => fotos.id, { onDelete: 'set null' }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const etapas = pgTable(
  'etapas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tramoId: uuid('tramo_id')
      .notNull()
      .references(() => tramos.id, { onDelete: 'cascade' }),
    posicion: integer('posicion').notNull(),
    titulo: text('titulo').notNull(),
    fecha: date('fecha'),
    origen: text('origen'),
    origenLat: doublePrecision('origen_lat'),
    origenLon: doublePrecision('origen_lon'),
    destino: text('destino'),
    destinoLat: doublePrecision('destino_lat'),
    destinoLon: doublePrecision('destino_lon'),
    via: jsonb('via').$type<Punto[]>(),
    notas: text('notas'),
    km: numeric('km', { precision: 6, scale: 2, mode: 'number' }),
    desnivelPos: integer('desnivel_pos'),
    desnivelNeg: integer('desnivel_neg'),
    traza: jsonb('traza').$type<LineString>(),
    trazaOrigen: text('traza_origen', { enum: ['carretera', 'gpx', 'manual'] })
      .notNull()
      .default('carretera'),
    bbox: jsonb('bbox').$type<BBox>(),
    gpxKey: text('gpx_key'),
  },
  (t) => [
    // En la migración se marca DEFERRABLE INITIALLY DEFERRED para poder reordenar.
    unique('etapas_tramo_id_posicion_unique').on(t.tramoId, t.posicion),
    check('etapas_traza_origen_check', sql`${t.trazaOrigen} in ('carretera', 'gpx', 'manual')`),
  ],
);

export const lugares = pgTable(
  'lugares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tramoId: uuid('tramo_id')
      .notNull()
      .references(() => tramos.id, { onDelete: 'cascade' }),
    etapaId: uuid('etapa_id').references(() => etapas.id, { onDelete: 'set null' }),
    tipo: tipoLugar('tipo').notNull(),
    nombre: text('nombre').notNull(),
    localidad: text('localidad'),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    precio: smallint('precio'),
    nota: text('nota'),
    url: text('url'),
  },
  (t) => [
    index('lugares_tramo_id_idx').on(t.tramoId),
    check('lugares_lat_check', sql`${t.lat} between -90 and 90`),
    check('lugares_lon_check', sql`${t.lon} between -180 and 180`),
    check('lugares_precio_check', sql`${t.precio} between 1 and 3`),
  ],
);

export const fotos = pgTable(
  'fotos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tramoId: uuid('tramo_id')
      .notNull()
      .references(() => tramos.id, { onDelete: 'cascade' }),
    etapaId: uuid('etapa_id').references(() => etapas.id, { onDelete: 'set null' }),
    keyGrande: text('key_grande').notNull(),
    keyMini: text('key_mini').notNull(),
    ancho: integer('ancho').notNull(),
    alto: integer('alto').notNull(),
    pie: text('pie'),
    tomadaEn: timestamp('tomada_en', { withTimezone: true }),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    mostrarPosicion: boolean('mostrar_posicion').notNull().default(true),
    orden: integer('orden').notNull().default(0),
  },
  (t) => [index('fotos_tramo_id_orden_idx').on(t.tramoId, t.orden)],
);

export const notas = pgTable(
  'notas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tramoId: uuid('tramo_id')
      .notNull()
      .references(() => tramos.id, { onDelete: 'cascade' }),
    etapaId: uuid('etapa_id').references(() => etapas.id, { onDelete: 'set null' }),
    fecha: date('fecha'),
    texto: text('texto').notNull(),
  },
  (t) => [index('notas_tramo_id_fecha_idx').on(t.tramoId, t.fecha)],
);

export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
});
