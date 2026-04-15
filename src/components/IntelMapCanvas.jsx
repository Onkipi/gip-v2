"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getPriorityLevel, priorityStyles, formatEventTime } from "@/lib/event-utils";

const DEFAULT_CENTER = [24, 18];
const DEFAULT_ZOOM = 2;

const FitToEvents = ({ events, selectedEventId, autoFit }) => {
  const map = useMap();

  useEffect(() => {
    if (!events.length) return;
    const selected = selectedEventId ? events.find((event) => event.id === selectedEventId) : null;
    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 5), {
        duration: 0.7
      });
      return;
    }

    if (!autoFit) return;

    const bounds = events.map((event) => [event.latitude, event.longitude]);
    map.fitBounds(bounds, {
      maxZoom: 6,
      padding: [40, 40],
      animate: true
    });
  }, [events, selectedEventId, autoFit, map]);

  return null;
};

export const IntelMapCanvas = ({ events, selectedEventId, onSelectEvent, autoFit }) => {
  const safeEvents = useMemo(
    () =>
      events.filter(
        (event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
      ),
    [events]
  );

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-900 shadow-2xl">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        worldCopyJump
        zoomControl
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToEvents events={safeEvents} selectedEventId={selectedEventId} autoFit={autoFit} />

        {safeEvents.map((event) => {
          const level = getPriorityLevel(event);
          const style = priorityStyles[level];
          const selected = event.id === selectedEventId;

          return (
            <CircleMarker
              key={event.id}
              center={[event.latitude, event.longitude]}
              radius={selected ? 9 : 6}
              pathOptions={{
                color: style.marker,
                fillColor: style.marker,
                fillOpacity: 0.7,
                weight: selected ? 3 : 1.5
              }}
              eventHandlers={{
                click: () => onSelectEvent(event.id)
              }}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <p className="text-xs font-semibold text-slate-500">
                    {event.location_label || event.region} • {formatEventTime(event.timestamp)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{event.headline}</p>
                  {event.summary ? (
                    <p className="mt-1 text-xs text-slate-700">
                      {event.summary.slice(0, 180)}
                      {event.summary.length > 180 ? "..." : ""}
                    </p>
                  ) : null}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};
