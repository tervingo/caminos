import 'leaflet/dist/leaflet.css';
import './mapa.css';
import L from 'leaflet';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AttributionControl, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { useNavigate } from 'react-router';
import type { Lugar, TramoDetalle } from '@caminos/shared';
import { fechaCorta, kmEtapa, numeroKm, precio } from '../../lib/formato';
import {
  aLatLon,
  finEtapa,
  inicioEtapa,
  type LatLon,
  type Limites,
  limitesEtapa,
  limitesTramo,
  nivelVista,
  PENINSULA,
  puntoMedio,
  puntosEtapa,
  separador,
  ZOOM_DETALLE,
  ZOOM_FOCO,
} from '../../lib/geo';
import { Estrellas } from '../ui';
import { ACENTO, CAPAS, type Capa, COLOR_CAPA, icono } from './iconos';
import { ATRIBUCION, TESELAS } from './teselas';
import type { Foco, TripMapProps } from './tipos';


const TINTA = '#14231C';
const BOSQUE = '#1E4D3A';

const ROTULO_LUGAR: Record<Lugar['tipo'], string> = { dormir: 'Dormir', comer: 'Comer' };
const GLIFO_LUGAR: Record<Lugar['tipo'], string> = { dormir: 'D', comer: 'C' };

const TODAS: Record<Capa, boolean> = { etapas: true, carretera: true, sitios: true, dormir: true, comer: true, fotos: true, otros: true };

function volarA(mapa: L.Map, destino: Limites | null) {
  if (!destino) return;
  const opciones: L.FitBoundsOptions = { padding: [40, 40], maxZoom: 13 };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) mapa.fitBounds(destino, opciones);
  else mapa.flyToBounds(destino, { ...opciones, duration: 1.2 });
}

function puntoDeFoco(tramo: TramoDetalle, foco: Foco): LatLon | null {
  if (foco.tipo === 'lugar') {
    const l = tramo.lugares.find((x) => x.id === foco.id);
    return l ? [l.lat, l.lon] : null;
  }
  const f = tramo.fotos.find((x) => x.id === foco.id);
  return f && f.lat !== null && f.lon !== null ? [f.lat, f.lon] : null;
}

function capaDeFoco(tramo: TramoDetalle, foco: Foco): Capa {
  if (foco.tipo === 'foto') return 'fotos';
  return tramo.lugares.find((l) => l.id === foco.id)?.tipo ?? 'dormir';
}

const claveFoco = (foco: Foco) => `${foco.tipo}:${foco.id}`;

export default function TripMap({ tramo, otros, etapa, onEtapa, vista, onVista, foco, marcador = null }: TripMapProps) {
  const navigate = useNavigate();
  const [mapa, setMapa] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState(5);
  const [movimientos, setMovimientos] = useState(0);
  const [capas, setCapas] = useState(TODAS);
  const marcadores = useRef(new Map<string, L.Marker>());
  /** Marcador cuya ventana hay que abrir cuando termine el vuelo */
  const pendiente = useRef<string | null>(null);

  const limites = useMemo(() => limitesTramo(tramo), [tramo]);
  const detalle = zoom >= ZOOM_DETALLE;

  // Un foco nuevo enciende su capa (ajuste de estado durante el render, sin efecto)
  const [focoVisto, setFocoVisto] = useState<Foco | null>(null);
  if (foco !== focoVisto) {
    setFocoVisto(foco);
    if (foco) setCapas((c) => ({ ...c, [capaDeFoco(tramo, foco)]: true }));
  }

  const enfocar = (m: L.Map, f: Foco) => {
    const punto = puntoDeFoco(tramo, f);
    if (!punto) return;
    pendiente.current = claveFoco(f);
    m.closePopup();
    m.flyTo(punto, Math.max(m.getZoom(), ZOOM_FOCO), { duration: 1 });
  };

  // Primera vista: arranca en la península y vuela al foco, a la etapa o al tramo
  const alCrear = (m: L.Map | null) => {
    if (!m || m === mapa) return;
    setMapa(m);
    if (foco) enfocar(m, foco);
    else if (etapa === null && vista === 'tramo') volarA(m, limites);
  };

  useEffect(() => {
    if (!mapa) return;
    const alMover = () => {
      setZoom(mapa.getZoom());
      setMovimientos((n) => n + 1);
    };
    mapa.on('moveend', alMover);
    return () => {
      mapa.off('moveend', alMover);
    };
  }, [mapa]);

  useEffect(() => {
    if (mapa && etapa !== null) volarA(mapa, limitesEtapa(tramo.etapas[etapa]));
  }, [mapa, etapa, tramo]);

  // En el editor el tramo cambia (etapa nueva, recorrido recalculado): se vuelve a encuadrar
  const claveLimites = JSON.stringify(limites);
  const limitesPrevios = useRef(claveLimites);
  useEffect(() => {
    if (!mapa || limitesPrevios.current === claveLimites) return;
    limitesPrevios.current = claveLimites;
    if (etapa === null) volarA(mapa, limites);
  }, [mapa, claveLimites, limites, etapa]);

  useEffect(() => {
    if (mapa && foco) enfocar(mapa, foco);
    // enfocar solo depende de tramo, que no cambia sin cambiar foco
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, foco]);

  // Tras cada movimiento, abre la ventana pendiente si su marcador ya está en el mapa
  useEffect(() => {
    const clave = pendiente.current;
    const marcador = clave ? marcadores.current.get(clave) : undefined;
    if (mapa && marcador && mapa.hasLayer(marcador)) {
      marcador.openPopup();
      pendiente.current = null;
    }
  }, [mapa, movimientos]);

  const registrar = (clave: string) => (m: L.Marker | null) => {
    if (m) marcadores.current.set(clave, m);
    else marcadores.current.delete(clave);
  };

  const irPeninsula = () => {
    if (!mapa) return;
    mapa.closePopup();
    volarA(mapa, PENINSULA);
    onVista('peninsula');
  };
  const irTramo = () => {
    if (!mapa) return;
    volarA(mapa, limites);
    onVista('tramo');
  };

  // ---------- Capas ----------

  const puntosTramo = tramo.etapas.flatMap(puntosEtapa);
  const grosor = detalle ? 5 : 4;
  const separar = separador();

  const otrosAnios = capas.otros
    ? otros.flatMap((o) => {
        const puntos = o.ruta ? aLatLon(o.ruta) : [];
        const medio = puntoMedio(puntos);
        if (!medio) return [];
        return [
          <Fragment key={o.slug}>
            <Polyline
              positions={puntos}
              pathOptions={{ color: o.camino.color, weight: 2.5, opacity: 0.85 }}
              eventHandlers={{ click: () => navigate(`/tramos/${o.slug}`) }}
            >
              <Tooltip sticky>
                {o.anio} · {o.titulo}
              </Tooltip>
            </Polyline>
            {!detalle && (
              <Marker
                position={medio}
                icon={icono({
                  glifo: String(o.anio),
                  etiqueta: `Ir a ${o.anio} · ${o.camino.nombre}`,
                  fondo: o.camino.color,
                  texto: '#fff',
                  tam: 28,
                  ancho: 56,
                  desplazamiento: [0, -18],
                })}
                eventHandlers={{ click: () => navigate(`/tramos/${o.slug}`) }}
              />
            )}
          </Fragment>,
        ];
      })
    : [];

  // Ida y vuelta en coche: discontinuas y solo en la vista general (no entran en el zoom del tramo)
  const viajes =
    capas.etapas && !detalle
      ? [tramo.ida, tramo.vuelta].flatMap((v) => {
          const puntos = v ? puntosEtapa(v) : [];
          if (!v || puntos.length < 2) return [];
          return [
            <Polyline
              key={v.id}
              positions={puntos}
              pathOptions={{ color: tramo.camino.color, weight: 3, opacity: 0.9, dashArray: '6 8', lineCap: 'butt' }}
            >
              <Tooltip sticky>
                {v.tipo === 'ida' ? 'Ida' : 'Vuelta'} en coche: {v.titulo}
                {v.km !== null && ` · ${numeroKm(v.km)} km`}
              </Tooltip>
            </Polyline>,
          ];
        })
      : [];

  const lineasEtapas = capas.etapas
    ? tramo.etapas.map((e, i) => {
        const puntos = puntosEtapa(e);
        const activa = i === etapa;
        const opacity = etapa === null || activa ? 1 : 0.5;
        // Con recorrido a pie, la ruta por carretera se ve aparte: fina, gris y discontinua
        const carretera = e.trazaPie && e.traza && capas.carretera ? aLatLon(e.traza) : null;
        return (
          <Fragment key={e.id}>
            {carretera && (
              <Polyline positions={carretera} interactive={false} pathOptions={{ color: '#6B7069', weight: 2.5, opacity: 0.8 * opacity, dashArray: '4 6' }} />
            )}
            <Polyline
              positions={puntos}
              interactive={false}
              pathOptions={{ color: activa ? ACENTO : '#fff', weight: grosor + (activa ? 7 : 3.5), opacity }}
            />
            <Polyline
              positions={puntos}
              pathOptions={{ color: tramo.camino.color, weight: grosor + (activa ? 1.5 : 0), opacity }}
              eventHandlers={{ click: () => onEtapa(activa ? null : i) }}
            >
              <Tooltip sticky>
                Etapa {i + 1}: {e.titulo}
              </Tooltip>
            </Polyline>
          </Fragment>
        );
      })
    : [];

  const vistaGeneral = !detalle && limites && mapa && (
    <>
      <RecuadroTramo mapa={mapa} zoom={zoom} limites={limites} onClick={irTramo} />
      {puntoMedio(puntosTramo) && (
        <Marker
          position={puntoMedio(puntosTramo)!}
          zIndexOffset={1000}
          icon={icono({
            glifo: String(tramo.anio),
            etiqueta: `Acercar al tramo de ${tramo.anio}`,
            fondo: tramo.camino.color,
            texto: '#fff',
            activo: true,
            tam: 28,
            ancho: 56,
            desplazamiento: [0, -34],
          })}
          eventHandlers={{ click: irTramo }}
        />
      )}
    </>
  );

  const marcadoresEtapas =
    detalle && capas.etapas
      ? tramo.etapas.flatMap((e, i) => {
          const fin = finEtapa(e);
          const inicio = i === 0 ? inicioEtapa(e) : null;
          const km = kmEtapa(e);
          const datos = [e.fecha && fechaCorta(e.fecha), km !== null && `${numeroKm(km)} km`].filter(Boolean).join(' · ');
          const nombreInicio = e.origen?.nombre ?? e.titulo.split(' → ')[0];
          return [
            inicio && (
              <Marker
                key="inicio"
                position={inicio}
                icon={icono({ glifo: 'S', etiqueta: `Inicio: ${nombreInicio}`, fondo: BOSQUE, texto: '#fff', tam: 30 })}
              >
                <Popup>
                  <Ficha rotulo="Inicio" titulo={nombreInicio} />
                </Popup>
              </Marker>
            ),
            fin && (
              <Marker
                key={e.id}
                position={fin}
                icon={icono({
                  glifo: String(i + 1),
                  etiqueta: `Etapa ${i + 1}: ${e.titulo}`,
                  fondo: BOSQUE,
                  texto: '#fff',
                  activo: i === etapa,
                  tam: 30,
                })}
              >
                <Popup>
                  <Ficha rotulo={`Etapa ${i + 1}`} titulo={e.titulo} subtitulo={datos} texto={e.notas} />
                </Popup>
              </Marker>
            ),
          ];
        })
      : [];

  // Sitios de interés de cada etapa: estrella, estén o no sobre la ruta
  const marcadoresSitios =
    detalle && capas.sitios
      ? tramo.etapas.flatMap((e, i) =>
          e.sitios.map((s, j) => (
            <Marker
              key={`sitio:${e.id}:${j}`}
              position={[s.lat, s.lon]}
              zIndexOffset={500}
              icon={icono({
                glifo: '★',
                etiqueta: `Sitio de interés: ${s.nombre}`,
                fondo: ACENTO,
                texto: TINTA,
                activo: i === etapa,
                tam: 32,
                desplazamiento: separar([s.lat, s.lon]),
              })}
            >
              <Popup>
                <Ficha rotulo={`Sitio de interés · Etapa ${i + 1}`} titulo={s.nombre} subtitulo={s.localidad ?? undefined} texto={s.nota}>
                  <FotoFicha tramo={tramo} id={s.fotoId} />
                </Ficha>
              </Popup>
            </Marker>
          )),
        )
      : [];

  const marcadoresLugares = detalle
    ? tramo.lugares
        .filter((l) => capas[l.tipo])
        .map((l) => {
          const clave = `lugar:${l.id}`;
          return (
            <Marker
              key={clave}
              ref={registrar(clave)}
              position={[l.lat, l.lon]}
              icon={icono({
                glifo: GLIFO_LUGAR[l.tipo],
                etiqueta: `${ROTULO_LUGAR[l.tipo]}: ${l.nombre}`,
                fondo: COLOR_CAPA[l.tipo],
                texto: TINTA,
                tam: 32,
                desplazamiento: separar([l.lat, l.lon]),
              })}
            >
              <Popup>
                <Ficha
                  rotulo={ROTULO_LUGAR[l.tipo]}
                  titulo={l.nombre}
                  subtitulo={[l.localidad, precio(l.precio)].filter(Boolean).join(' · ')}
                  texto={l.nota}
                >
                  {l.valoracion && <Estrellas valor={l.valoracion} />}
                  <FotoFicha tramo={tramo} id={l.fotoId} />
                </Ficha>
              </Popup>
            </Marker>
          );
        })
    : [];

  const marcadoresFotos =
    detalle && capas.fotos
      ? tramo.fotos.flatMap((f) => {
          if (f.lat === null || f.lon === null) return [];
          const clave = `foto:${f.id}`;
          return [
            <Marker
              key={clave}
              ref={registrar(clave)}
              position={[f.lat, f.lon]}
              icon={icono({
                glifo: 'F',
                etiqueta: `Foto: ${f.pie ?? 'sin pie'}`,
                fondo: COLOR_CAPA.fotos,
                texto: TINTA,
                tam: 32,
                desplazamiento: separar([f.lat!, f.lon!]),
              })}
            >
              <Popup>
                <Ficha rotulo="Foto" titulo={f.pie}>
                  <img
                    src={f.urlMini}
                    alt={f.pie ?? `Foto del tramo de ${tramo.anio}`}
                    width={f.ancho}
                    height={f.alto}
                    className="mt-2 block h-auto w-60 max-w-full rounded-lg"
                  />
                </Ficha>
              </Popup>
            </Marker>,
          ];
        })
      : [];

  // ---------- Controles, leyenda y avisos ----------

  const enPeninsula = zoom < 7;
  const caminos = new Map([[tramo.camino.slug, tramo.camino]]);
  if (capas.otros) for (const o of otros) if (o.ruta) caminos.set(o.camino.slug, o.camino);
  // El aviso de «por carretera» solo vale para etapas que no tienen recorrido a pie
  const porCarretera = tramo.etapas.some((e) => e.traza && e.trazaOrigen === 'carretera' && !e.trazaPie);
  const fuentesPie = [...new Set(tramo.etapas.flatMap((e) => (e.trazaPie && e.trazaPieFuente ? [e.trazaPieFuente] : [])))];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex rounded-full border-2 border-bosque bg-white p-0.5">
          <BotonVista activo={enPeninsula} onClick={irPeninsula}>
            Península
          </BotonVista>
          <BotonVista activo={detalle} onClick={irTramo}>
            Zona del tramo
          </BotonVista>
        </div>
        <div role="group" aria-label="Capas del mapa" className="flex flex-wrap gap-2">
          {CAPAS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={capas[c.id]}
              onClick={() => setCapas((actual) => ({ ...actual, [c.id]: !actual[c.id] }))}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-tinta px-3.5 text-sm font-semibold ${
                capas[c.id] ? 'bg-tinta text-white' : 'bg-white text-tinta'
              }`}
            >
              <span aria-hidden="true" className="size-2.5 rounded-full border border-tinta" style={{ background: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#8FB5C2]">
        <MapContainer
          ref={alCrear}
          bounds={PENINSULA}
          scrollWheelZoom={false}
          attributionControl={false}
          className="aspect-[900/560] min-h-[360px] w-full"
        >
          <TileLayer url={TESELAS} attribution={ATRIBUCION} />
          <AttributionControl position="bottomright" prefix={false} />
          {otrosAnios}
          {viajes}
          {lineasEtapas}
          {vistaGeneral}
          {marcadoresEtapas}
          {marcadoresSitios}
          {marcadoresLugares}
          {marcadoresFotos}
          {marcador && (
            <CircleMarker
              center={marcador}
              radius={7}
              interactive={false}
              pathOptions={{ color: '#fff', weight: 3, fillColor: '#B07A0F', fillOpacity: 1 }}
            />
          )}
        </MapContainer>
        <div className="pointer-events-none absolute top-3 right-3 z-[1000] rounded-full border border-[#CFCBBF] bg-white/92 px-3.5 py-1.5 text-[13px] font-semibold">
          Vista: {nivelVista(zoom)}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap justify-between gap-x-5 gap-y-2 text-[13px] text-gris">
        <div>
          {detalle
            ? `Etapas de ${tramo.anio}. Los pines son lugares y fotos de ese año; − para volver a la península.`
            : `Mapa general: el recuadro marca el tramo de ${tramo.anio}. Tócalo o usa + para acercar.`}
          {porCarretera && <span className="block">Recorrido aproximado por carretera: el Camino rara vez va por la calzada.</span>}
          {fuentesPie.length > 0 && <span className="block">Recorrido a pie: {fuentesPie.join(' · ')}</span>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {[...caminos.values()].map((c) => (
            <span key={c.slug} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-[5px] w-4 rounded-[3px]" style={{ background: c.color }} />
              {c.nombre.replace(/^Camino /, '')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BotonVista({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-10 cursor-pointer rounded-full border-0 px-[18px] text-sm font-semibold ${
        activo ? 'bg-bosque text-white' : 'bg-transparent text-bosque'
      }`}
    >
      {children}
    </button>
  );
}

/** Recuadro punteado alrededor del tramo, con un tamaño mínimo para que se pueda pulsar */
function RecuadroTramo({ mapa, zoom, limites, onClick }: { mapa: L.Map; zoom: number; limites: Limites; onClick: () => void }) {
  const [[sur, oeste], [norte, este]] = limites;
  const a = mapa.project([norte, oeste], zoom);
  const b = mapa.project([sur, este], zoom);
  const ancho = Math.max(b.x - a.x + 24, 44);
  const alto = Math.max(b.y - a.y + 24, 44);
  const icon = L.divIcon({
    className: 'recuadro-tramo',
    iconSize: [ancho, alto],
    html: '<span class="recuadro-tramo__caja"><span class="recuadro-tramo__rotulo">Zoom al tramo</span></span>',
  });
  return (
    <Marker
      position={[(sur + norte) / 2, (oeste + este) / 2]}
      icon={icon}
      title="Acercar al tramo"
      keyboard={false}
      eventHandlers={{ click: onClick }}
    />
  );
}

/** Miniatura de la foto de un lugar o sitio dentro de su ventana del mapa */
function FotoFicha({ tramo, id }: { tramo: TramoDetalle; id: string | null }) {
  const foto = id ? tramo.fotos.find((f) => f.id === id) : undefined;
  if (!foto) return null;
  return <img src={foto.urlMini} alt={foto.pie ?? ''} className="mt-2 block h-auto w-60 max-w-full rounded-lg" />;
}

function Ficha({
  rotulo,
  titulo,
  subtitulo,
  texto,
  children,
}: {
  rotulo: string;
  titulo: string | null;
  subtitulo?: string;
  texto?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-[260px]">
      <div className="text-xs font-bold uppercase tracking-[.08em] text-bosque">{rotulo}</div>
      {titulo && <div className="mt-0.5 font-serif text-[20px] leading-tight font-semibold">{titulo}</div>}
      {subtitulo && <div className="text-sm text-gris">{subtitulo}</div>}
      {texto && <p className="mt-2 mb-0 text-sm">{texto}</p>}
      {children}
    </div>
  );
}
