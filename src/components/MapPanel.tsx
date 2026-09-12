import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Criteria, EvaluatedHome, Home, NicheAssessment, Snapshot } from '../domain/schema.js';
import { destinationName, dollars, minute, routeForHome, title } from '../lib/view.js';

type Props = { snapshot: Snapshot; criteria: Criteria; ordered: { home: Home; result: EvaluatedHome }[]; nicheById?: Map<string, NicheAssessment>; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void; onViewDetails?: () => void; onPinDestination: (lat: number, lon: number) => void; pinMode: boolean; cameraResetKey: number };

export function MapPanel({ snapshot, criteria, ordered, nicheById, selectedId, hoveredId, onSelect, onViewDetails, onPinDestination, pinMode, cameraResetKey }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickHandler = useRef(onSelect);
  const destinationHandler = useRef(onPinDestination);
  const pinModeRef = useRef(pinMode);
  const allBounds = useRef<L.LatLngBounds | null>(null);
  const markerByHomeId = useRef(new Map<string, L.Marker>());
  const viewKey = useRef('');
  const [tileError, setTileError] = useState(false);
  const [sizeRevision, setSizeRevision] = useState(0);
  clickHandler.current = onSelect;
  destinationHandler.current = onPinDestination;
  pinModeRef.current = pinMode;

  const citedPlaceIds = selectedId ? (nicheById?.get(selectedId)?.citedPlaceIds || []) : [];
  const citedPlaceKey = citedPlaceIds.join('|');
  const focusMap = () => {
    const instance = map.current;
    if (!instance) return;
    const dest = criteria.destination.coordinate;
    const home = selectedId ? snapshot.homes.find(item => item.id === selectedId) : undefined;
    const origin = home?.coordinate.value;
    if (!home || !origin) { instance.setView([dest.lat, dest.lon], 15, { animate: false }); return; }
    const route = routeForHome(snapshot, home, criteria);
    const path: [number, number][] = route?.status === 'ok' && route.geometry ? route.geometry.coordinates.map(([lon, lat]) => [lat, lon]) : [[origin.lat, origin.lon], [dest.lat, dest.lon]];
    for (const placeId of citedPlaceIds) {
      const place = home.nearby.find(item => item.id === placeId);
      if (place) path.push([place.coordinate.lat, place.coordinate.lon]);
    }
    const size = instance.getSize();
    const captionHeight = host.current?.parentElement?.querySelector<HTMLElement>('.map-caption')?.offsetHeight ?? 0;
    const topPadding = Math.min(Math.max(72, captionHeight + 20), Math.max(72, Math.floor(size.y * .4)));
    const rightPadding = citedPlaceIds.length ? Math.min(150, Math.max(72, Math.floor(size.x * .3))) : 72;
    instance.fitBounds(L.latLngBounds(path), { paddingTopLeft: [72, topPadding], paddingBottomRight: [rightPadding, 72], maxZoom: 15, animate: false });
  };

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
      instance.invalidateSize({ animate: false });
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
    L.marker([dest.lat, dest.lon], { icon: destIcon, keyboard: true, title: `${criteria.destination.label}, mapped point`, bubblingMouseEvents: false }).addTo(group).bindPopup(popup);
    const locations = new Map<string, { coordinate: { lat: number; lon: number }; items: { home: Home; result: EvaluatedHome; ordinal: number }[] }>();
    ordered.forEach(({ home, result }, index) => {
      const coordinate = home.coordinate.value;
      if (!coordinate) return;
      const key = `${coordinate.lat},${coordinate.lon}`;
      const location = locations.get(key) || { coordinate, items: [] };
      location.items.push({ home, result, ordinal: index + 1 });
      locations.set(key, location);
    });
    markerByHomeId.current.clear();
    for (const { coordinate, items } of locations.values()) {
      points.push([coordinate.lat, coordinate.lon]);
      const selectedItem = items.find(item => item.home.id === selectedId);
      const displayItem = selectedItem || items[0]!;
      const iconHtml = document.createElement('span');
      const number = document.createElement('span'); number.textContent = String(displayItem.ordinal);
      iconHtml.append(number);
      if (items.length > 1) { const count = document.createElement('small'); count.className = 'home-pin-count'; count.textContent = String(items.length); iconHtml.append(count); }
      const isNiche = selectedItem ? nicheById?.has(selectedItem.home.id) : items.some(item => nicheById?.has(item.home.id));
      const icon = L.divIcon({ className: `home-marker fit-${displayItem.result.fit} ${isNiche ? 'is-niche' : ''} ${selectedItem ? 'is-selected' : ''} ${selectedId && !selectedItem ? 'is-dimmed' : ''}`, html: iconHtml, iconSize: [30, 30], iconAnchor: [15, 15] });
      const label = items.length === 1 ? `${displayItem.ordinal}. ${title(displayItem.home)} · ${minute(routeForHome(snapshot, displayItem.home, criteria)?.durationSeconds)}` : `${items.length} researched options at this location; choose a listing`;
      const marker = L.marker([coordinate.lat, coordinate.lon], { icon, keyboard: true, title: label, bubblingMouseEvents: false, riseOnHover: true, zIndexOffset: selectedItem ? 1000 : 0 }).addTo(group);
      for (const item of items) markerByHomeId.current.set(item.home.id, marker);
      if (items.length === 1) marker.on('click', () => { if (!pinModeRef.current) clickHandler.current(displayItem.home.id); });
      else {
        const choices = document.createElement('div'); choices.className = 'map-choice-list';
        const heading = document.createElement('strong'); heading.textContent = `${items.length} options at this location`; choices.append(heading);
        for (const item of items) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'map-choice';
          const share = item.result.cost.personalBaseRent == null ? 'share unknown' : `${dollars(item.result.cost.personalBaseRent)} share / month`;
          button.textContent = `${item.ordinal}. ${title(item.home)} · ${share}`;
          button.addEventListener('click', () => { map.current?.closePopup(); clickHandler.current(item.home.id); });
          choices.append(button);
        }
        const popup = L.popup({ autoPan: true }).setContent(choices);
        marker.on('click', () => { if (pinModeRef.current) return; popup.setLatLng(marker.getLatLng()).openOn(instance); });
      }
    }
    if (selectedId) {
      const home = snapshot.homes.find(h => h.id === selectedId);
      const route = home && routeForHome(snapshot, home, criteria);
      if (route?.status === 'ok' && route.geometry?.coordinates?.length) {
        L.polyline(route.geometry.coordinates.map(([lon, lat]): [number, number] => [lat, lon]), { className: 'selected-foot-route', color: '#2456a8', weight: 4, opacity: .94 }).addTo(group);
      }
    }
    if (selectedId && nicheById?.has(selectedId)) {
      const home = snapshot.homes.find(h => h.id === selectedId);
      const assessment = nicheById.get(selectedId)!;
      for (const placeId of assessment.citedPlaceIds) {
        const place = home?.nearby.find(p => p.id === placeId);
        if (!place || !home?.coordinate.value) continue;
        const placeHtml = document.createElement('span'); placeHtml.className = 'niche-place-content';
        const dot = document.createElement('span'); dot.className = 'niche-place-dot';
        const label = document.createElement('span'); label.className = 'niche-place-label'; label.textContent = `${place.name} · ${Math.round(place.distanceMeters)} m ${place.distanceBasis === 'walking_route' ? 'walking distance' : 'straight-line'}`;
        placeHtml.append(dot, label);
        L.marker([place.coordinate.lat, place.coordinate.lon], { icon: L.divIcon({ className: 'niche-place-marker', html: placeHtml, iconSize: [150, 24], iconAnchor: [8, 12] }), keyboard: false, interactive: false }).addTo(group);
        if (place.distanceBasis === 'straight_line') L.polyline([[home.coordinate.value.lat, home.coordinate.value.lon], [place.coordinate.lat, place.coordinate.lon]], { className: 'niche-tie', dashArray: '4 5', weight: 2, opacity: .85, interactive: false }).addTo(group);
      }
    }
    allBounds.current = points.length > 1 ? L.latLngBounds(points) : null;
    const nextViewKey = `${criteria.destination.version}|${selectedId ?? ''}|${ordered.map(x => x.home.id).join(',')}|${citedPlaceKey}|${cameraResetKey}`;
    if (nextViewKey !== viewKey.current) {
      viewKey.current = nextViewKey;
      focusMap();
    }
    requestAnimationFrame(() => instance.invalidateSize());
  }, [snapshot, criteria, ordered, nicheById, selectedId, citedPlaceKey, cameraResetKey, sizeRevision]);

  useEffect(() => {
    const hoveredMarker = hoveredId ? markerByHomeId.current.get(hoveredId) : undefined;
    for (const marker of new Set(markerByHomeId.current.values())) marker.getElement()?.classList.toggle('is-hovered', marker === hoveredMarker);
  }, [hoveredId, snapshot, ordered, nicheById, selectedId, citedPlaceKey, cameraResetKey, sizeRevision]);

  useEffect(() => { if (pinMode) map.current?.closePopup(); }, [pinMode]);

  const selected = selectedId ? snapshot.homes.find(h => h.id === selectedId) : undefined;
  const selectedResult = selectedId ? ordered.find(item => item.home.id === selectedId)?.result : undefined;
  const route = selected && routeForHome(snapshot, selected, criteria);
  return <section className={`map-pane ${pinMode ? 'pin-mode' : ''}`} aria-label="Housing map">
    <div ref={host} className="leaflet-host" role="application" aria-label="Map of homes and destination" />
    {tileError && <div className="basemap-fallback" role="status">Basemap unavailable. Housing and saved route details remain in the list.</div>}
    {pinMode && <div className="map-pin-instruction">Choose a point for the new destination</div>}
    <div className="map-caption">
      <span className="map-caption-dot" /> <strong>{destinationName(criteria)}</strong><span className="muted"> mapped entrance</span>
      {selected && <div className="map-caption-home"><strong>{title(selected)}</strong><span>{selectedResult?.cost.personalBaseRent == null ? 'Personal share unknown' : `${dollars(selectedResult.cost.personalBaseRent)} personal share / month`}</span></div>}
      {selected && <div className="map-route-summary">{route?.status === 'ok' ? `${minute(route.durationSeconds)} walk · ${route.distanceMeters == null ? 'distance unknown' : `${(route.distanceMeters / 1000).toFixed(1)} km`}` : 'Walking route unavailable or needs review'}</div>}
      <div className="map-controls"><button className="map-show-all" onClick={() => { if (map.current && allBounds.current) map.current.fitBounds(allBounds.current, { padding: [56,56], maxZoom: 15, animate: false }); }}>Show all {ordered.filter(x => x.home.coordinate.value).length} mapped options</button><button className="map-focus" onClick={focusMap}>{selected ? 'Focus selected route' : 'Focus destination'}</button></div>
      {selected && onViewDetails && <button className="map-details-button" onClick={onViewDetails} aria-label={`View details for ${title(selected)}`}>View details</button>}
    </div>
  </section>;
}
