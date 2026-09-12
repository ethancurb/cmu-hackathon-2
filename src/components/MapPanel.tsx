import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Criteria, EvaluatedHome, Home, Snapshot } from '../domain/schema.js';
import { destinationName, minute, routeForHome, title } from '../lib/view.js';

type Props = { snapshot: Snapshot; criteria: Criteria; ordered: { home: Home; result: EvaluatedHome }[]; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void; onPinDestination: (lat: number, lon: number) => void; pinMode: boolean };

export function MapPanel({ snapshot, criteria, ordered, selectedId, hoveredId, onSelect, onPinDestination, pinMode }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickHandler = useRef(onSelect);
  const destinationHandler = useRef(onPinDestination);
  const pinModeRef = useRef(pinMode);
  const allBounds = useRef<L.LatLngBounds | null>(null);
  const viewKey = useRef('');
  const [tileError, setTileError] = useState(false);
  const [sizeRevision, setSizeRevision] = useState(0);
  clickHandler.current = onSelect;
  destinationHandler.current = onPinDestination;
  pinModeRef.current = pinMode;

  useEffect(() => {
    if (!host.current || map.current) return;
    const dest = criteria.destination.coordinate;
    const instance = L.map(host.current, { zoomControl: false, scrollWheelZoom: false }).setView([dest.lat, dest.lon], 15, { animate: false });
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>', maxZoom: 19 }).on('tileerror', () => setTileError(true)).on('tileload', () => setTileError(false)).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => { if (pinModeRef.current) destinationHandler.current(event.latlng.lat, event.latlng.lng); });
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    let wasHidden = host.current.getBoundingClientRect().width === 0;
    const resize = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === 0) { wasHidden = true; return; }
      if (wasHidden) { wasHidden = false; instance.invalidateSize(); viewKey.current = ''; setSizeRevision(revision => revision + 1); }
    });
    resize.observe(host.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; layer.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) return;
    group.clearLayers();
    const dest = criteria.destination.coordinate;
    const points: L.LatLngExpression[] = [[dest.lat, dest.lon]];
    const destHtml = document.createElement('span'); destHtml.className = 'destination-content';
    const destSquare = document.createElement('span'); destSquare.className = 'destination-square';
    const destLabel = document.createElement('span'); destLabel.className = 'destination-label'; destLabel.textContent = destinationName(criteria);
    destHtml.append(destSquare, destLabel);
    const destIcon = L.divIcon({ className: 'destination-marker', html: destHtml, iconSize: [132, 28], iconAnchor: [10, 14] });
    const popup = document.createElement('div'); popup.textContent = `${criteria.destination.label} · mapped point ${dest.lat.toFixed(6)}, ${dest.lon.toFixed(6)}`;
    L.marker([dest.lat, dest.lon], { icon: destIcon, keyboard: true, title: `${criteria.destination.label}, mapped point` }).addTo(group).bindPopup(popup);
    ordered.forEach(({ home, result }, index) => {
      const coordinate = home.coordinate.value;
      if (!coordinate) return;
      points.push([coordinate.lat, coordinate.lon]);
      const chosen = home.id === selectedId;
      const hovered = home.id === hoveredId;
      const marker = L.divIcon({ className: `home-marker fit-${result.fit} ${chosen ? 'is-selected' : ''} ${hovered ? 'is-hovered' : ''} ${selectedId && !chosen ? 'is-dimmed' : ''}`, html: `<span>${index + 1}</span>`, iconSize: [30,30], iconAnchor: [15,15] });
      L.marker([coordinate.lat, coordinate.lon], { icon: marker, keyboard: true, title: `${index + 1}. ${title(home)} · ${minute(routeForHome(snapshot, home, criteria)?.durationSeconds)}` }).on('click', () => clickHandler.current(home.id)).addTo(group);
    });
    ordered.forEach(({ home }) => {
      const route = routeForHome(snapshot, home, criteria);
      if (home.id !== selectedId && route?.status === 'ok' && route.geometry?.coordinates?.length) L.polyline(route.geometry.coordinates.map(([lon, lat]): [number,number] => [lat, lon]), { color: '#606b70', weight: 2, opacity: .48, interactive: false }).addTo(group).bringToBack();
    });
    if (selectedId) {
      const home = snapshot.homes.find(h => h.id === selectedId);
      const route = home && routeForHome(snapshot, home, criteria);
      if (route?.status === 'ok' && route.geometry?.coordinates?.length) {
        L.polyline(route.geometry.coordinates.map(([lon, lat]): [number, number] => [lat, lon]), { className: 'selected-foot-route', color: '#2456a8', weight: 4, opacity: .94 }).addTo(group);
      }
    }
    allBounds.current = points.length > 1 ? L.latLngBounds(points) : null;
    const nextViewKey = `${criteria.destination.version}|${selectedId ?? ''}|${ordered.map(x => x.home.id).join(',')}`;
    if (nextViewKey !== viewKey.current) {
      viewKey.current = nextViewKey;
      const selected = selectedId && snapshot.homes.find(h => h.id === selectedId)?.coordinate.value;
      if (selected) {
        const selectedHome = snapshot.homes.find(h => h.id === selectedId);
        const selectedRoute = selectedHome && routeForHome(snapshot, selectedHome, criteria);
        const path = selectedRoute?.geometry?.coordinates.map(([lon,lat]): [number,number] => [lat,lon]) || [];
        instance.fitBounds(L.latLngBounds(path.length ? path : [[dest.lat,dest.lon],[selected.lat,selected.lon]]), { padding: [72, 72], maxZoom: 15, animate: false });
      }
      else instance.setView([dest.lat, dest.lon], 15, { animate: false });
    }
    requestAnimationFrame(() => instance.invalidateSize());
  }, [snapshot, criteria, ordered, selectedId, hoveredId, sizeRevision]);

  const selected = selectedId ? snapshot.homes.find(h => h.id === selectedId) : undefined;
  const route = selected && routeForHome(snapshot, selected, criteria);
  return <section className={`map-pane ${pinMode ? 'pin-mode' : ''}`} aria-label="Housing map">
    <div ref={host} className="leaflet-host" role="application" aria-label="Map of homes and destination" />
    {tileError && <div className="basemap-fallback" role="status">Basemap unavailable. Housing and saved route details remain in the list.</div>}
    {pinMode && <div className="map-pin-instruction">Choose a point for the new destination</div>}
    <div className="map-caption">
      <span className="map-caption-dot" /> <strong>{destinationName(criteria)}</strong><span className="muted"> mapped entrance</span>
      {selected && <div className="map-route-summary">{route?.status === 'ok' ? `${minute(route.durationSeconds)} computed foot walk · ${route.distanceMeters == null ? 'distance unknown' : `${(route.distanceMeters / 1000).toFixed(1)} km`}` : 'Walking route unavailable or needs review'}</div>}
      <button className="map-show-all" onClick={() => { if (map.current && allBounds.current) map.current.fitBounds(allBounds.current, { padding: [56,56], maxZoom: 15, animate: false }); }}>Show all {ordered.filter(x => x.home.coordinate.value).length} mapped options</button>
    </div>
  </section>;
}
