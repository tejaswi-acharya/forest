import { createFileRoute } from "@tanstack/react-router";
import { AlertsPanel, CameraGrid, EventsFeed, SpeciesHeatmap, StatsRow, ZoneMap } from "@/components/dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations · ForestGuard AI" },
      { name: "description", content: "Real-time wildlife monitoring overview, alerts, and edge AI detections." },
    ],
  }),
  component: Overview,
});

function Overview() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edge AI · Adaptive camera coordination · Community-assisted protection
          </p>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground border border-border rounded-md px-3 py-1.5 bg-panel/60">
          THREAT LEVEL · <span className="text-warning">ELEVATED</span>
        </div>
      </div>

      <StatsRow />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ZoneMap />
          <EventsFeed />
        </div>
        <div className="space-y-4">
          <AlertsPanel />
          <SpeciesHeatmap />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2 mt-2">Active Camera Nodes</h2>
        <CameraGrid />
      </div>
    </div>
  );
}
