import 'leaflet/dist/leaflet.css';
import '../../components/TripMap/mapa.css';
import { useEffect, useRef, useState } from 'react';
import { AttributionControl, CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { type Limites, PENINSULA } from '../../lib/geo';
import { ATRIBUCION, TESELAS } from '../../components/TripMap/teselas';
import { Boton } from './ui';

interface Props {
  titulo: string;
  zona: Limites | null;
  onElegir: (lat: number, lon: number) => void;
  onCerrar: () => void;
}

function AlPulsar({ onPulsar }: { onPulsar: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPulsar(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Diálogo con un mapa para elegir un punto pulsando sobre él */
export default function MapaSelector({ titulo, zona, onElegir, onCerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [punto, setPunto] = useState<[number, number] | null>(null);

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      aria-label={`Elegir ${titulo.toLowerCase()} en el mapa`}
      onClose={onCerrar}
      className="m-auto w-[min(92vw,900px)] max-w-none rounded-2xl border-0 bg-white p-4 text-tinta"
    >
      <p className="mt-0 mb-3 text-sm text-musgo">Acerca el mapa y pulsa en el lugar exacto de {titulo.toLowerCase()}.</p>
      <MapContainer bounds={zona ?? PENINSULA} attributionControl={false} className="h-[60dvh] w-full rounded-xl">
        <TileLayer url={TESELAS} attribution={ATRIBUCION} />
        <AttributionControl position="bottomright" prefix={false} />
        <AlPulsar onPulsar={(lat, lon) => setPunto([lat, lon])} />
        {punto && <CircleMarker center={punto} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1E4D3A', fillOpacity: 1 }} />}
      </MapContainer>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        {punto && (
          <span className="mr-auto text-sm text-gris tabular-nums">
            {punto[0].toFixed(5)}, {punto[1].toFixed(5)}
          </span>
        )}
        <Boton variante="sutil" onClick={() => dialogo.current?.close()}>
          Cancelar
        </Boton>
        <Boton variante="primario" disabled={!punto} onClick={() => punto && onElegir(punto[0], punto[1])}>
          Usar este punto
        </Boton>
      </div>
    </dialog>
  );
}
