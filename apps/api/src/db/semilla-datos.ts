// Los cuatro tramos de ejemplo del mock-up D. Las trazas son aproximadas (4 puntos por etapa).
import type { TipoLugar } from '@caminos/shared';

type LatLon = [number, number];

export interface CaminoSemilla {
  slug: string;
  nombre: string;
  color: string;
}

export interface TramoSemilla {
  slug: string;
  anio: number;
  camino: string;
  titulo: string;
  resumen: string;
  fechaInicio: string;
  fechaFin: string;
  desnivelPos: number;
  etapas: { titulo: string; fecha: string; km: number; notas: string; puntos: LatLon[] }[];
  /** «ver» se carga como sitio de interés de la etapa de esa localidad */
  lugares: { tipo: TipoLugar | 'ver'; nombre: string; localidad: string; precio: number | null; nota: string }[];
  notas: { fecha: string; texto: string }[];
}

export const caminosSemilla: CaminoSemilla[] = [
  { slug: 'frances', nombre: 'Camino Francés', color: '#234E8F' },
  { slug: 'portugues', nombre: 'Camino Portugués', color: '#B4237E' },
  { slug: 'lebaniego', nombre: 'Camino Lebaniego', color: '#C2570C' },
];

export const localidades: Record<string, LatLon> = {
  'Saint-Jean': [43.163, -1.238],
  Roncesvalles: [43.009, -1.319],
  Zubiri: [42.931, -1.505],
  Pamplona: [42.812, -1.645],
  Sarria: [42.781, -7.414],
  Portomarín: [42.807, -7.616],
  'Palas de Rei': [42.873, -7.868],
  Melide: [42.914, -8.015],
  Tui: [42.046, -8.644],
  'O Porriño': [42.161, -8.619],
  Redondela: [42.282, -8.61],
  Pontevedra: [42.431, -8.644],
  'San Vicente de la Barquera': [43.384, -4.395],
  Cades: [43.335, -4.445],
  Puentenansa: [43.288, -4.48],
  Cicera: [43.25, -4.53],
};

export const tramosSemilla: TramoSemilla[] = [
  {
    slug: '2023-frances',
    anio: 2023,
    camino: 'frances',
    titulo: 'Saint-Jean → Pamplona',
    resumen: 'El primer tramo: cruzamos los Pirineos con niebla y llegamos a Pamplona con las piernas hechas polvo.',
    fechaInicio: '2023-09-08',
    fechaFin: '2023-09-10',
    desnivelPos: 1700,
    etapas: [
      {
        titulo: 'Saint-Jean → Roncesvalles',
        fecha: '2023-09-08',
        km: 25,
        notas: 'Subida larga entre ovejas y niebla; cena colectiva en el albergue.',
        puntos: [[43.163, -1.238], [43.095, -1.275], [43.04, -1.325], [43.009, -1.319]],
      },
      {
        titulo: 'Roncesvalles → Zubiri',
        fecha: '2023-09-09',
        km: 22,
        notas: 'Bosque de hayas y la primera ampolla del viaje.',
        puntos: [[43.009, -1.319], [42.99, -1.37], [42.96, -1.43], [42.931, -1.505]],
      },
      {
        titulo: 'Zubiri → Pamplona',
        fecha: '2023-09-10',
        km: 21,
        notas: 'Entrada por la muralla y pintxos en el casco viejo.',
        puntos: [[42.931, -1.505], [42.9, -1.55], [42.86, -1.6], [42.812, -1.645]],
      },
    ],
    lugares: [
      { tipo: 'dormir', nombre: 'Albergue de peregrinos', localidad: 'Roncesvalles', precio: 1, nota: 'Literas y cena a las 19:00. Conviene reservar.' },
      { tipo: 'dormir', nombre: 'Albergue municipal', localidad: 'Zubiri', precio: 1, nota: 'Pueblo pequeño: mejor llegar pronto.' },
      { tipo: 'comer', nombre: 'Menú del peregrino', localidad: 'Roncesvalles', precio: 2, nota: 'Plato contundente y vino incluido.' },
      { tipo: 'comer', nombre: 'Ronda de pintxos', localidad: 'Pamplona', precio: 2, nota: 'Casco viejo, al caer la tarde.' },
      { tipo: 'ver', nombre: 'Colegiata y museo', localidad: 'Roncesvalles', precio: null, nota: 'Parada obligada antes de seguir.' },
    ],
    notas: [
      { fecha: '2023-09-11', texto: 'Cruzar los Pirineos con niebla fue lo mejor del viaje.' },
      { fecha: '2023-09-12', texto: 'Pendiente: volver a Roncesvalles con más tiempo para el museo.' },
    ],
  },
  {
    slug: '2024-frances',
    anio: 2024,
    camino: 'frances',
    titulo: 'Sarria → Melide',
    resumen:
      'Segundo año, otro punto del mismo Camino: saltamos hasta Galicia y recorrimos los bosques entre Sarria y Melide.',
    fechaInicio: '2024-09-06',
    fechaFin: '2024-09-08',
    desnivelPos: 900,
    etapas: [
      {
        titulo: 'Sarria → Portomarín',
        fecha: '2024-09-06',
        km: 22,
        notas: 'Sendas entre robles y muros de piedra; bajada final hacia el embalse.',
        puntos: [[42.781, -7.414], [42.79, -7.48], [42.8, -7.56], [42.807, -7.616]],
      },
      {
        titulo: 'Portomarín → Palas de Rei',
        fecha: '2024-09-07',
        km: 25,
        notas: 'Etapa larga con subidas suaves y mucha charla con otros peregrinos.',
        puntos: [[42.807, -7.616], [42.83, -7.7], [42.85, -7.78], [42.873, -7.868]],
      },
      {
        titulo: 'Palas de Rei → Melide',
        fecha: '2024-09-08',
        km: 15,
        notas: 'Etapa corta que terminó, como manda la tradición, con pulpo.',
        puntos: [[42.873, -7.868], [42.89, -7.93], [42.9, -7.98], [42.914, -8.015]],
      },
    ],
    lugares: [
      { tipo: 'dormir', nombre: 'Albergue', localidad: 'Portomarín', precio: 1, nota: 'Cerca del puente, con cocina.' },
      { tipo: 'dormir', nombre: 'Albergue', localidad: 'Palas de Rei', precio: 1, nota: 'Llegar pronto en temporada alta.' },
      { tipo: 'comer', nombre: 'Pulpería', localidad: 'Melide', precio: 2, nota: 'Pulpo a feira, mesas largas compartidas.' },
      { tipo: 'comer', nombre: 'Menú del día', localidad: 'Portomarín', precio: 2, nota: 'Caldo gallego para empezar.' },
      { tipo: 'ver', nombre: 'Iglesia de San Nicolás', localidad: 'Portomarín', precio: null, nota: 'Reconstruida piedra a piedra al subir el embalse.' },
    ],
    notas: [
      { fecha: '2024-09-09', texto: 'Galicia en septiembre: verde y mucha humedad.' },
      { fecha: '2024-09-10', texto: 'Repetiría la pulpería de Melide.' },
    ],
  },
  {
    slug: '2025-portugues',
    anio: 2025,
    camino: 'portugues',
    titulo: 'Tui → Pontevedra',
    resumen:
      'Tercer año y primer cambio de Camino: el Portugués desde Tui, con puentes, caminos de piedra y mucha tapa.',
    fechaInicio: '2025-09-05',
    fechaFin: '2025-09-07',
    desnivelPos: 500,
    etapas: [
      {
        titulo: 'Tui → O Porriño',
        fecha: '2025-09-05',
        km: 17,
        notas: 'Salimos de la ciudad amurallada cruzando el Miño por la mañana.',
        puntos: [[42.046, -8.644], [42.09, -8.63], [42.13, -8.625], [42.161, -8.619]],
      },
      {
        titulo: 'O Porriño → Redondela',
        fecha: '2025-09-06',
        km: 15,
        notas: 'Tramo suave entre pueblos; paramos a comer tarde en Redondela.',
        puntos: [[42.161, -8.619], [42.2, -8.62], [42.25, -8.615], [42.282, -8.61]],
      },
      {
        titulo: 'Redondela → Pontevedra',
        fecha: '2025-09-07',
        km: 19,
        notas: 'Subida al alto de la Canicouva y bajada hacia el casco antiguo.',
        puntos: [[42.282, -8.61], [42.33, -8.61], [42.38, -8.64], [42.431, -8.644]],
      },
    ],
    lugares: [
      { tipo: 'dormir', nombre: 'Albergue', localidad: 'O Porriño', precio: 1, nota: 'Sencillo y bien situado.' },
      { tipo: 'dormir', nombre: 'Hostal', localidad: 'Redondela', precio: 2, nota: 'Habitaciones dobles, cerca de la estación.' },
      { tipo: 'comer', nombre: 'Menú del día', localidad: 'O Porriño', precio: 1, nota: 'Buena opción para el mediodía.' },
      { tipo: 'comer', nombre: 'Ronda de tapas', localidad: 'Pontevedra', precio: 2, nota: 'Plazas del casco antiguo al atardecer.' },
      { tipo: 'ver', nombre: 'Catedral', localidad: 'Tui', precio: null, nota: 'Merece una visita antes de salir.' },
    ],
    notas: [
      { fecha: '2025-09-08', texto: 'Cambiar de Camino nos dio un aire nuevo.' },
      { fecha: '2025-09-09', texto: 'Pontevedra: ciudad para volver con calma.' },
    ],
  },
  {
    slug: '2026-lebaniego',
    anio: 2026,
    camino: 'lebaniego',
    titulo: 'San Vicente de la Barquera → Cicera',
    resumen:
      'Este año nos fuimos a Cantabria: parte del Camino Lebaniego, entre el mar y las primeras montañas de Liébana.',
    fechaInicio: '2026-09-12',
    fechaFin: '2026-09-14',
    desnivelPos: 1100,
    etapas: [
      {
        titulo: 'San Vicente de la Barquera → Cades',
        fecha: '2026-09-12',
        km: 12,
        notas: 'Salimos del puerto con niebla baja y primeras subidas entre prados.',
        puntos: [[43.384, -4.395], [43.365, -4.41], [43.348, -4.43], [43.335, -4.445]],
      },
      {
        titulo: 'Cades → Puentenansa',
        fecha: '2026-09-13',
        km: 14,
        notas: 'Valle estrecho, río a un lado y vacas en el camino.',
        puntos: [[43.335, -4.445], [43.318, -4.462], [43.303, -4.472], [43.288, -4.48]],
      },
      {
        titulo: 'Puentenansa → Cicera',
        fecha: '2026-09-14',
        km: 18,
        notas: 'Subida más exigente, pero con las mejores vistas del tramo.',
        puntos: [[43.288, -4.48], [43.275, -4.5], [43.262, -4.515], [43.25, -4.53]],
      },
    ],
    lugares: [
      { tipo: 'dormir', nombre: 'Albergue', localidad: 'San Vicente de la Barquera', precio: 1, nota: 'Cerca del puerto.' },
      { tipo: 'dormir', nombre: 'Casa rural', localidad: 'Cades', precio: 2, nota: 'Desayuno casero.' },
      { tipo: 'comer', nombre: 'Pescado y marisco', localidad: 'San Vicente de la Barquera', precio: 3, nota: 'Para celebrar el primer día.' },
      { tipo: 'comer', nombre: 'Menú del día', localidad: 'Puentenansa', precio: 1, nota: 'Cocina de montaña, platos grandes.' },
      { tipo: 'ver', nombre: 'Castillo del Rey', localidad: 'San Vicente de la Barquera', precio: null, nota: 'Vistas a la ría.' },
    ],
    notas: [
      { fecha: '2026-09-15', texto: 'El Lebaniego se queda a medias: hay que volver a terminarlo hasta Santo Toribio.' },
      { fecha: '2026-09-16', texto: 'Subida a Cicera: la más dura del año.' },
    ],
  },
];
