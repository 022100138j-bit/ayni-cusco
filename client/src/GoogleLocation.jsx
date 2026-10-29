import { useEffect, useRef, useState } from "react";
let loading;
export function loadGoogle() {
  if (window.google?.maps?.importLibrary)
    return Promise.resolve(window.google.maps);
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
    return Promise.reject(
      Error(
        "Configura la clave de Google Maps para activar el mapa y la búsqueda de lugares.",
      ),
    );
  if (!loading)
    loading = new Promise((resolve, reject) => {
      window.ayniMapsReady = () => resolve(window.google.maps);
      window.gm_authFailure = () =>
        reject(
          Error(
            "Google rechazó la clave. Comprueba las APIs y las restricciones de tu proyecto.",
          ),
        );
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)}&loading=async&libraries=places,marker&callback=ayniMapsReady&language=es&region=PE&v=weekly`;
      script.async = true;
      script.onerror = () =>
        reject(Error("No se pudo conectar con Google Maps."));
      document.head.appendChild(script);
    });
  return loading;
}
export default function GoogleLocation({ value = {}, onChange }) {
  const mapEl = useRef(null),
    searchEl = useRef(null),
    callback = useRef(onChange),
    instance = useRef(null);
  callback.current = onChange;
  const [error, setError] = useState("");
  const editable = !!onChange;
  useEffect(() => {
    let cancelled = false,
      widget,
      marker,
      map,
      clickListener;
    loadGoogle()
      .then(async (maps) => {
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          maps.importLibrary("maps"),
          maps.importLibrary("marker"),
        ]);
        if (cancelled) return;
        const hasCoords =
          Number.isFinite(value.lat) && Number.isFinite(value.lng);
        const center = hasCoords
          ? { lat: value.lat, lng: value.lng }
          : { lat: -13.53195, lng: -71.96746 };
        map = new Map(mapEl.current, {
          center,
          zoom: hasCoords ? 16 : 13,
          mapId: import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID",
          streetViewControl: false,
          mapTypeControl: false,
        });
        marker = new AdvancedMarkerElement({
          map: hasCoords ? map : null,
          position: center,
          gmpDraggable: editable,
        });
        instance.current = { map, marker };
        const change = (lat, lng, extra = {}) => {
          marker.map = map;
          marker.position = { lat, lng };
          callback.current?.({ lat, lng, placeId: "", ...extra });
        };
        if (editable) {
          const { PlaceAutocompleteElement } =
            await maps.importLibrary("places");
          if (cancelled) return;
          widget = new PlaceAutocompleteElement({
            includedRegionCodes: ["pe"],
            locationBias: {
              center: { lat: -13.53195, lng: -71.96746 },
              radius: 50000,
            },
          });
          widget.setAttribute("aria-label", "Buscar dirección con Google");
          searchEl.current.replaceChildren(widget);
          widget.addEventListener("gmp-select", async ({ placePrediction }) => {
            try {
              const place = placePrediction.toPlace();
              await place.fetchFields({
                fields: ["formattedAddress", "location", "displayName"],
              });
              if (cancelled || !place.location) return;
              const lat = place.location.lat(),
                lng = place.location.lng();
              map.setCenter({ lat, lng });
              map.setZoom(16);
              change(lat, lng, {
                lugar: place.formattedAddress || place.displayName,
                placeId: place.id,
              });
            } catch {
              setError("No se pudo obtener ese lugar. Inténtalo de nuevo.");
            }
          });
          widget.addEventListener("gmp-error", () =>
            setError(
              "Google no pudo buscar lugares. Verifica la clave y Places API (New).",
            ),
          );
          clickListener = map.addListener("click", (e) =>
            change(e.latLng.lat(), e.latLng.lng()),
          );
          marker.addListener("dragend", (e) =>
            change(e.latLng.lat(), e.latLng.lng()),
          );
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      clickListener?.remove();
      widget?.remove();
      if (marker) marker.map = null;
      instance.current = null;
    };
    // Initialize only on mount. Subsequent coordinates are synchronized below.
  }, [editable]);
  useEffect(() => {
    if (!instance.current) return;
    if (Number.isFinite(value.lat) && Number.isFinite(value.lng)) {
      const p = { lat: value.lat, lng: value.lng };
      instance.current.marker.map = instance.current.map;
      instance.current.marker.position = p;
      instance.current.map.setCenter(p);
    } else {
      instance.current.marker.map = null;
    }
  }, [value.lat, value.lng]);
  const coordinates = Number.isFinite(value.lat) && Number.isFinite(value.lng);
  const destination = coordinates ? `${value.lat},${value.lng}` : value.lugar;
  return (
    <section className="location">
      <div ref={searchEl} />
      {editable && (
        <p className="muted">
          Busca el lugar o toca el mapa para marcar la ubicación exacta.
        </p>
      )}
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      <div ref={mapEl} className="google-map" hidden={!!error} />
      {coordinates && (
        <small>
          Coordenadas: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </small>
      )}
      {!coordinates && !editable && (
        <p>
          Este evento todavía no tiene un punto exacto. Puedes buscar su
          dirección en Google Maps.
        </p>
      )}
      {destination && (
        <a
          className="link-map"
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${value.placeId ? "&destination_place_id=" + encodeURIComponent(value.placeId) : ""}`}
          target="_blank"
          rel="noreferrer"
        >
          Cómo llegar con Google Maps ↗
        </a>
      )}
    </section>
  );
}
