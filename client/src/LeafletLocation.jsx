import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Corrige el ícono por defecto de Leaflet (problema conocido con Vite/webpack)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Centro de Cusco como referencia por defecto
const CUSCO = [-13.53195, -71.96746];

// Componente interno: sincroniza el centro del mapa cuando cambian las coordenadas
function MapSync({ lat, lng }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (prev.current?.lat === lat && prev.current?.lng === lng) return;
    prev.current = { lat, lng };
    map.setView([lat, lng], map.getZoom() < 15 ? 16 : map.getZoom());
  }, [lat, lng, map]);
  return null;
}

// Componente interno: captura clics en el mapa (solo en modo editable)
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Busca lugares con Nominatim (OpenStreetMap, 100% gratuito)
async function buscarLugar(texto) {
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    new URLSearchParams({
      q: texto,
      format: "json",
      addressdetails: 1,
      limit: 5,
      countrycodes: "pe",
      "accept-language": "es",
    });
  const res = await fetch(url, {
    headers: { "Accept-Language": "es" },
  });
  if (!res.ok) throw new Error("Error al buscar el lugar");
  return res.json();
}

export default function LeafletLocation({ value = {}, onChange }) {
  const editable = !!onChange;
  const hasCoords =
    Number.isFinite(value.lat) && Number.isFinite(value.lng);

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const debounceRef = useRef(null);

  const handleMapClick = useCallback(
    (lat, lng) => {
      onChange?.({ lat, lng, lugar: value.lugar || "", placeId: "" });
    },
    [onChange, value.lugar],
  );

  const handleMarkerDrag = useCallback(
    (e) => {
      const { lat, lng } = e.target.getLatLng();
      onChange?.({ lat, lng, lugar: value.lugar || "", placeId: "" });
    },
    [onChange, value.lugar],
  );

  const handleSelectResult = useCallback(
    (item) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const lugar =
        item.display_name.split(",").slice(0, 3).join(", ") ||
        item.display_name;
      onChange?.({ lat, lng, lugar, placeId: item.place_id?.toString() || "" });
      setQuery(lugar);
      setResultados([]);
    },
    [onChange],
  );

  const handleQueryChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setErrorBusqueda("");
    clearTimeout(debounceRef.current);
    if (v.trim().length < 3) {
      setResultados([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const data = await buscarLugar(v.trim() + " Cusco Perú");
        setResultados(data);
        if (data.length === 0)
          setErrorBusqueda("No se encontraron resultados. Intenta con otro nombre.");
      } catch {
        setErrorBusqueda("No se pudo buscar. Revisa tu conexión a internet.");
      } finally {
        setBuscando(false);
      }
    }, 500);
  };

  const center = hasCoords ? [value.lat, value.lng] : CUSCO;
  const destination = hasCoords
    ? `${value.lat},${value.lng}`
    : value.lugar || "";

  return (
    <section className="location">
      {editable && (
        <div className="leaflet-search">
          <input
            type="text"
            className="leaflet-search-input"
            placeholder="Buscar dirección o lugar en Cusco…"
            value={query}
            onChange={handleQueryChange}
            aria-label="Buscar dirección con OpenStreetMap"
            autoComplete="off"
          />
          {buscando && <p className="muted">Buscando…</p>}
          {errorBusqueda && (
            <p className="notice" role="status">
              {errorBusqueda}
            </p>
          )}
          {resultados.length > 0 && (
            <ul className="leaflet-search-results" role="listbox">
              {resultados.map((item) => (
                <li
                  key={item.place_id}
                  role="option"
                  tabIndex={0}
                  onClick={() => handleSelectResult(item)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSelectResult(item)
                  }
                >
                  {item.display_name}
                </li>
              ))}
            </ul>
          )}
          <p className="muted">
            Busca el lugar, haz clic en el mapa o arrastra el marcador para
            ajustar la ubicación exacta.
          </p>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={hasCoords ? 16 : 13}
        className="leaflet-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSync lat={value.lat} lng={value.lng} />
        {editable && <ClickHandler onMapClick={handleMapClick} />}
        {hasCoords && (
          <Marker
            position={[value.lat, value.lng]}
            draggable={editable}
            eventHandlers={editable ? { dragend: handleMarkerDrag } : {}}
          />
        )}
      </MapContainer>

      {hasCoords && (
        <small className="muted">
          Coordenadas: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </small>
      )}

      {!hasCoords && !editable && (
        <p>
          Este evento todavía no tiene un punto exacto. Puedes buscar su
          dirección en Google Maps.
        </p>
      )}

      {destination && (
        <a
          className="link-map"
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}
          target="_blank"
          rel="noreferrer"
        >
          Cómo llegar con Google Maps ↗
        </a>
      )}
    </section>
  );
}
