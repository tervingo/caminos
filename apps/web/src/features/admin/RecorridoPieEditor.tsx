import { useState } from 'react';
import { perfilDe, type TramoEditor } from '@caminos/shared';
import { editar, useCambio } from '../../lib/admin';
import { numeroKm } from '../../lib/formato';
import { FUENTE_CNIG, leerGpx, pareceCnig } from '../../lib/gpx';
import { construirRed, type LatLon, recortar, type ResultadoPie } from '../../lib/recorridoPie';
import { Boton, INPUT, MensajeError } from './ui';

interface Propuesta {
  etapaId: string;
  titulo: string;
  resultado: ResultadoPie;
}

/**
 * Recorrido a pie de las etapas: se suben uno o varios GPX del Camino (p. ej. los ficheros por etapa
 * del CNIG), se recorta el trozo de cada etapa entre su origen y su destino y, tras revisarlo, se guarda.
 */
export function RecorridoPieEditor({ tramo }: { tramo: TramoEditor }) {
  const [ficheros, setFicheros] = useState<string[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [fuente, setFuente] = useState('');
  const [error, setError] = useState<unknown>(null);
  const guardar = useCambio((cuerpo: object) => editar('PUT', `/api/admin/tramos/${tramo.id}/recorrido-pie`, cuerpo));

  const conPuntos = tramo.etapas.filter((e) => e.origen && e.destino);
  const conPie = tramo.etapas.filter((e) => e.trazaPie);

  const leer = async (archivos: File[]) => {
    setError(null);
    setPropuestas(null);
    try {
      const textos = await Promise.all(archivos.map((a) => a.text()));
      const tracks = textos.flatMap((t, i) => {
        try {
          return leerGpx(t);
        } catch (err) {
          throw new Error(`${archivos[i].name}: ${(err as Error).message}`, { cause: err });
        }
      });
      const red = construirRed(tracks);
      setFicheros(archivos.map((a) => a.name));
      setFuente(archivos.some((a, i) => pareceCnig(a.name, textos[i])) ? FUENTE_CNIG : '');
      setPropuestas(
        conPuntos.map((e) => ({
          etapaId: e.id,
          titulo: e.titulo,
          resultado: recortar(red, [e.origen!.lat, e.origen!.lon] as LatLon, [e.destino!.lat, e.destino!.lon] as LatLon),
        })),
      );
    } catch (err) {
      setError(err);
    }
  };

  const validas = propuestas?.filter((p) => p.resultado.ok) ?? [];

  const aplicar = () =>
    guardar.mutate(
      {
        fuente: fuente.trim() || null,
        etapas: validas.flatMap(({ etapaId, resultado: r }) =>
          r.ok
            ? [
                {
                  id: etapaId,
                  traza: { type: 'LineString', coordinates: r.coordenadas },
                  km: Math.round(r.metros / 10) / 100,
                  // Con las altitudes del GPX, el perfil sale de todos sus puntos; si no, lo calcula el servidor
                  perfil: r.conAltitud ? perfilDe(r.conAltitud, 'gpx') : null,
                },
              ]
            : [],
        ),
      },
      { onSuccess: () => setPropuestas(null) },
    );

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-linea bg-papel/60 p-4">
      <div>
        <h3 className="m-0 text-sm font-semibold">Recorrido a pie del Camino</h3>
        <p className="mt-1 mb-0 text-[13px] text-gris">
          Sube los GPX del Camino que cubren este tramo (por ejemplo, los ficheros por etapa del{' '}
          <a href="https://centrodedescargas.cnig.es/CentroDescargas/camino-santiago" target="_blank" rel="noopener noreferrer" className="font-semibold text-bosque">
            centro de descargas del CNIG
          </a>
          ). Se recorta el trozo de cada etapa entre su origen y su destino; la ruta por carretera se mantiene aparte.
          {conPie.length > 0 && ` Ahora tienen recorrido a pie ${conPie.length} de ${tramo.etapas.length} etapas.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-tinta bg-white px-4 text-sm font-semibold hover:bg-papel">
          Subir GPX…
          <input
            type="file"
            multiple
            accept=".gpx,application/gpx+xml"
            className="sr-only"
            onChange={(e) => {
              const archivos = [...(e.target.files ?? [])];
              e.target.value = '';
              if (archivos.length > 0) leer(archivos);
            }}
          />
        </label>
        {conPuntos.length < tramo.etapas.length && (
          <span className="text-[13px] text-ambar-oscuro">Las etapas sin origen y destino no se pueden recortar.</span>
        )}
        {conPie.length > 0 && !propuestas && (
          <Boton
            variante="sutil"
            ocupado={guardar.isPending}
            onClick={() =>
              confirm('¿Quitar el recorrido a pie de todas las etapas?') &&
              guardar.mutate({ fuente: null, etapas: conPie.map((e) => ({ id: e.id, traza: null, km: null })) })
            }
          >
            Quitar los recorridos a pie
          </Boton>
        )}
      </div>
      <MensajeError error={error ?? guardar.error} />

      {propuestas && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] text-gris">
            {ficheros.length === 1 ? 'Fichero' : `${ficheros.length} ficheros`}: {ficheros.join(', ')}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {propuestas.map((p) => {
              const i = tramo.etapas.findIndex((e) => e.id === p.etapaId);
              const r = p.resultado;
              return (
                <li key={p.etapaId} className="flex flex-wrap gap-x-3">
                  <span className="min-w-0 flex-1">
                    {i + 1}. {p.titulo}
                  </span>
                  {r.ok ? (
                    <span className="text-bosque">
                      {numeroKm(r.metros / 1000)} km a pie
                      {Math.max(r.aOrigen, r.aDestino) > 500 && (
                        <span className="text-ambar-oscuro"> · origen o destino a {numeroKm(Math.max(r.aOrigen, r.aDestino) / 1000)} km del Camino</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ambar-oscuro">
                      {r.motivo === 'lejos' ? 'No está en estos ficheros' : 'El Camino no une origen y destino en estos ficheros'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Fuente del trazado (se cita en el mapa)
            <input value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder={FUENTE_CNIG} className={INPUT} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" disabled={validas.length === 0} ocupado={guardar.isPending} onClick={aplicar}>
              Guardar el recorrido a pie de {validas.length} {validas.length === 1 ? 'etapa' : 'etapas'}
            </Boton>
            <Boton variante="sutil" onClick={() => setPropuestas(null)}>
              Descartar
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
