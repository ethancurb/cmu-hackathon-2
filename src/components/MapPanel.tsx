import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Criteria, EvaluatedHome, Home, Snapshot } from '../domain/schema.js';
import { minute, routeForHome, title } from '../lib/view.js';

type Props = { snapshot: Snapshot; criteria: Criteria; ordered: { home: Home; result: EvaluatedHome }[]; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void; onPinDestination: (lat: number, lon: number) => void; pinMode: boolean };

export function MapPanel({ snapshot, criteria, ordered, selectedId, hoveredId, onSelect, onPinDestination, pinMode }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickHandler = useRef(onSelect);
  const destinationHandler = useRef(onPinDestination);
  const pinModeRef = useRef(pinMode);
  const [tileError, setTileError] = useState(false);
  clickHandler.current = onSelect;
  destinationHandler.current = onPinDestination;
  pinModeRef.current = pinMode;

  useEffect(() => {
    if (!host.current || map.current) return;
    const dest = criteria.destination.coordinate;
    const instance = L.map(host.current, { zoomControl: false, scrollWheelZoom: false }).setView([dest.lat, dest.lon], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>', maxZoom: 19 }).on('tileerror', () => setTileError(true)).on('tileload', () => setTileError(false)).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => { if (pinModeRef.current) destinationHandler.current(event.latlng.lat, event.latlng.lng); });
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    return () => { instance.remove(); map.current = null; layer.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) return;
    group.clearLayers();
    const dest = criteria.destination.coordinate;
    const points: L.LatLngExpression[] = [[dest.lat, dest.lon]];
    const destIcon = L.divIcon({ className: 'destination-marker', html: '<span class="destination-square"></span><span class="destination-label">Gates Hillman</span>', iconSize: [132, 28], iconAnchor: [10, 14] });
    L.marker([dest.lat, dest.lon], { icon: destIcon, keyboard: true, title: `${criteria.destination.label}, mapped entrance` }).addTo(group).bindPopup(`${criteria.destination.label}<br>Mapped entrance · ${dest.lat.toFixed(6)}, ${dest.lon.toFixed(6)}`);
    ordered.forEach(({ home, result }, index) => {
      const coordinate = home.coordinate.value;
      if (!coordinate) return;
      points.push([coordinate.lat, coordinate.lon]);
      const chosen = home.id === selectedId;
      const hovered = home.id === hoveredId;
      const marker = L.divIcon({ className: `home-marker ${chosen ? 'is-selected' : ''} ${hovered ? 'is-hovered' : ''} ${result.fit === 'matches' ? '' : 'is-unconfirmed'} ${selectedId && !chosen ? 'is-dimmed' : ''}`, html: `<span>${index + 1}</span>`, iconSize: [30,30], iconAnchor: [15,15] });
      L.marker([coordinate.lat, coordinate.lon], { icon: marker, keyboard: true, title: `${index + 1}. ${title(home)} · ${minute(routeForHome(snapshot, home, criteria)?.durationSeconds)}` }).on('click', () => clickHandler.current(home.id)).addTo(group);
    });
    if (selectedId) {
      const home = snapshot.homes.find(h => h.id === selectedId);
      const route = home && routeForHome(snapshot, home, criteria);
      if (route?.status === 'ok' && route.geometry?.coordinates?.length) {
        L.polyline(route.geometry.coordinates.map(([lon, lat]): [number, number] => [lat, lon]), { color: '#2456a8', weight: 4, opacity: .94 }).addTo(group);
      }
    }
    if (points.length > 1) instance.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15 });
    else instance.setView([dest.lat, dest.lon], 14);
    requestAnimationFrame(() => instance.invalidateSize());
  }, [snapshot, criteria, ordered, selectedId, hoveredId]);

  const selected = selectedId ? snapshot.homes.find(h => h.id === selectedId) : undefined;
  const route = selected && routeForHome(snapshot, selected, criteria);
  return <section className={`map-pane ${pinMode ? 'pin-mode' : ''}`} aria-label="Housing map">
    <div ref={host} className="leaflet-host" role="application" aria-label="Map of homes and destination" />
    {tileError && <div className="basemap-fallback" role="status">Basemap unavailable. Housing and saved route details remain in the list.</div>}
    {pinMode && <div className="map-pin-instruction">Choose a point for the new destination</div>}
    <div className="map-caption">
      <span className="map-caption-dot" /> <strong>{criteria.destination.label}</strong><span className="muted"> mapped entrance</span>
      {selected && <div className="map-route-summary">{route?.status === 'ok' ? `${minute(route.durationSeconds)} computed walk · ${route.provider} · ${route.distanceMeters == null ? 'distance unknown' : `${(route.distanceMeters / 1000).toFixed(1)} km`}` : 'Walking route unavailable or needs review'}</div>}
    </div>
  </section>;
}
