"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { IncidentFeedPanel } from "@/components/IncidentFeedPanel";
import { IncidentDetailsPanel } from "@/components/IncidentDetailsPanel";
import { useIntelStore } from "@/store/intel-store";
import { useRealtimeSocket } from "@/lib/use-realtime-socket";
import { getPriorityLevel, matchesSearch } from "@/lib/event-utils";

const IntelMapCanvas = dynamic(
  () => import("@/components/IntelMapCanvas").then((module) => module.IntelMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400">
        Loading map...
      </div>
    )
  }
);

const scenarioModes = ["baseline", "crisis", "extreme"];

export default function HomePage() {
  const socket = useRealtimeSocket();

  const connected = useIntelStore((state) => state.connected);
  const events = useIntelStore((state) => state.events);
  const risks = useIntelStore((state) => state.risks);
  const macroIndicators = useIntelStore((state) => state.macroIndicators);
  const predictions = useIntelStore((state) => state.predictions);
  const scenario = useIntelStore((state) => state.scenario);
  const updatedAt = useIntelStore((state) => state.updatedAt);
  const setScenario = useIntelStore((state) => state.setScenario);

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [hoursWindow, setHoursWindow] = useState(48);
  const [autoFit, setAutoFit] = useState(true);
  const [paused, setPaused] = useState(false);
  const [pausedSnapshot, setPausedSnapshot] = useState([]);
  const [enabledPriorities, setEnabledPriorities] = useState({
    high: true,
    medium: true,
    normal: true
  });

  useEffect(() => {
    let active = true;

    const loadBootstrap = async () => {
      try {
        const response = await fetch("/api/bootstrap", { cache: "no-store" });
        const payload = await response.json();
        if (active) {
          useIntelStore.getState().bootstrap(payload);
        }
      } catch {
      }
    };

    loadBootstrap();

    return () => {
      active = false;
    };
  }, []);

  const sourceEvents = paused ? pausedSnapshot : events;

  const regionOptions = useMemo(
    () => [...new Set(sourceEvents.map((event) => event.region).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [sourceEvents]
  );

  const categoryOptions = useMemo(
    () => [...new Set(sourceEvents.map((event) => event.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [sourceEvents]
  );

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const oldestTimestamp = now - hoursWindow * 3600000;

    return sourceEvents
      .filter((event) => new Date(event.timestamp).getTime() >= oldestTimestamp)
      .filter((event) => matchesSearch(event, searchQuery))
      .filter((event) => (selectedRegion === "all" ? true : event.region === selectedRegion))
      .filter((event) => (selectedCategory === "all" ? true : event.category === selectedCategory))
      .filter((event) => enabledPriorities[getPriorityLevel(event)])
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sourceEvents, hoursWindow, searchQuery, selectedRegion, selectedCategory, enabledPriorities]);

  useEffect(() => {
    if (!filteredEvents.length) {
      setSelectedEventId((current) => (current === null ? current : null));
      return;
    }

    const stillPresent = filteredEvents.some((event) => event.id === selectedEventId);
    if (!stillPresent) {
      const fallbackId = filteredEvents[0].id;
      setSelectedEventId((current) => (current === fallbackId ? current : fallbackId));
    }
  }, [filteredEvents, selectedEventId]);

  const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) || null;

  const onScenarioChange = async (nextScenario) => {
    setScenario(nextScenario);

    if (socket?.connected) {
      socket.emit("scenario_set", { scenario: nextScenario });
      return;
    }

    await fetch("/api/scenario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ scenario: nextScenario })
    });
  };

  const togglePriority = (level) => {
    setEnabledPriorities((current) => ({
      ...current,
      [level]: !current[level]
    }));
  };

  const togglePaused = () => {
    setPaused((current) => {
      if (!current) {
        setPausedSnapshot(events);
      }
      return !current;
    });
  };

  return (
    <main className="h-screen overflow-hidden bg-slate-950 px-3 py-3 text-slate-100 md:px-4">
      <header className="mb-3 rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Geo Political Intelligence System</h1>
            <p className="text-sm text-slate-400">Real-time geopolitical monitoring with verified live feeds, map intelligence, and risk signals</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 font-semibold ${connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {connected ? "Connected" : "Reconnecting"}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
              {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "syncing..."}
            </span>
            <button
              type="button"
              onClick={() => setAutoFit((current) => !current)}
              className={`rounded-full px-2 py-1 font-semibold ${
                autoFit ? "bg-sky-100 text-sky-700" : "bg-slate-800 text-slate-300"
              }`}
            >
              {autoFit ? "Auto-fit On" : "Auto-fit Off"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {scenarioModes.map((mode) => {
            const active = mode === scenario;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onScenarioChange(mode)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  active ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </header>

      <section className="grid h-[calc(100vh-132px)] min-h-0 grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="min-h-0 lg:col-span-3">
          <IncidentFeedPanel
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={(eventId) => {
              setSelectedEventId(eventId);
              setAutoFit(false);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            hoursWindow={hoursWindow}
            onHoursWindowChange={setHoursWindow}
            enabledPriorities={enabledPriorities}
            onPriorityToggle={togglePriority}
            regionOptions={regionOptions}
            categoryOptions={categoryOptions}
            paused={paused}
            onPauseToggle={togglePaused}
          />
        </div>

        <div className="min-h-0 lg:col-span-6">
          <IntelMapCanvas
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={(eventId) => {
              setSelectedEventId(eventId);
              setAutoFit(false);
            }}
            autoFit={autoFit}
          />
        </div>

        <div className="min-h-0 lg:col-span-3">
          <IncidentDetailsPanel
            event={selectedEvent}
            macroIndicators={macroIndicators}
            risks={risks}
            predictions={predictions}
            onFocusMap={() => {
              if (selectedEvent) {
                setSelectedEventId(selectedEvent.id);
              }
              setAutoFit(false);
            }}
            onSelectEvidence={(eventId) => {
              if (!eventId) return;
              setSelectedEventId(eventId);
              setAutoFit(false);
            }}
          />
        </div>
      </section>
    </main>
  );
}
