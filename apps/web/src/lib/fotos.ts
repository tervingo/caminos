// Subida de fotos desde el navegador: se leen fecha y GPS, se generan dos WebP (grande y miniatura)
// y se suben directo a R2 con URL firmada. El original nunca sale del ordenador, ni sus EXIF.
import exifr from 'exifr';
import type { Etapa, TramoEditor } from '@caminos/shared';
import { editar, firmarFoto } from './admin';
import { etapaDeFecha } from './asignar';

export const TIPOS_ADMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

const LADO_GRANDE = 2000;
const LADO_MINI = 480;

interface Version {
  blob: Blob;
  ancho: number;
  alto: number;
}

async function reducir(imagen: ImageBitmap, lado: number, calidad: number): Promise<Version> {
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const ancho = Math.round(imagen.width * escala);
  const alto = Math.round(imagen.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite procesar imágenes');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', calidad));
  // Algunos navegadores (Safari antiguo) devuelven PNG en vez de WebP
  if (!blob || blob.type !== 'image/webp') throw new Error('Este navegador no genera WebP; prueba con Chrome, Edge o Firefox');
  return { blob, ancho, alto };
}

interface Metadatos {
  tomadaEn: Date | null;
  lat: number | null;
  lon: number | null;
}

async function leerMetadatos(archivo: File): Promise<Metadatos> {
  const [fechas, gps] = await Promise.all([
    exifr.parse(archivo, ['DateTimeOriginal', 'CreateDate']).catch(() => null) as Promise<Record<string, unknown> | null>,
    exifr.gps(archivo).catch(() => null),
  ]);
  const fecha = fechas?.DateTimeOriginal ?? fechas?.CreateDate;
  const valida = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  return {
    tomadaEn: fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : null,
    lat: gps && valida(gps.latitude) ? gps.latitude : null,
    lon: gps && valida(gps.longitude) ? gps.longitude : null,
  };
}

async function subir(url: string, blob: Blob) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: blob });
  if (!res.ok) throw new Error(`El almacenamiento rechazó la subida (HTTP ${res.status})`);
}

export type FaseSubida = 'leyendo' | 'subiendo' | 'registrando';

/** Procesa, sube y registra una foto. Devuelve el tramo actualizado y el id de la foto. */
export async function subirFoto(
  tramoId: string,
  etapas: Pick<Etapa, 'id' | 'fecha'>[],
  archivo: File,
  avisar: (fase: FaseSubida) => void,
): Promise<{ tramo: TramoEditor; id: string }> {
  if (!TIPOS_ADMITIDOS.includes(archivo.type)) throw new Error('Formato no admitido: usa JPEG, PNG o WebP');

  avisar('leyendo');
  const meta = await leerMetadatos(archivo);
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  let grande: Version;
  let mini: Version;
  try {
    grande = await reducir(imagen, LADO_GRANDE, 0.82);
    mini = await reducir(imagen, LADO_MINI, 0.75);
  } finally {
    imagen.close();
  }

  avisar('subiendo');
  const firma = await firmarFoto(tramoId);
  const url = (v: 'grande' | 'mini') => firma.subidas.find((s) => s.variante === v)!.url;
  await Promise.all([subir(url('grande'), grande.blob), subir(url('mini'), mini.blob)]);

  avisar('registrando');
  const tramo = await editar('POST', `/api/admin/tramos/${tramoId}/fotos`, {
    id: firma.id,
    ancho: grande.ancho,
    alto: grande.alto,
    tomadaEn: meta.tomadaEn?.toISOString() ?? null,
    lat: meta.lat,
    lon: meta.lon,
    etapaId: etapaDeFecha(etapas, meta.tomadaEn),
  });
  return { tramo, id: firma.id };
}
