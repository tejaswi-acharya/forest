import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "System Architecture · ForestGuard AI" },
      { name: "description", content: "How ForestGuard AI's edge cameras, central brain, dashboard, and community rewards connect." },
    ],
  }),
  component: AboutPage,
});

const ENDPOINTS = [
  { m: "POST", p: "/camera-data", d: "Edge AI device pushes filtered detections (JSON only — no raw video)." },
  { m: "POST", p: "/community-report", d: "Citizen sighting submitted; AI returns verdict + eSewa-style points." },
  { m: "GET",  p: "/alerts", d: "Live alerts: human intrusion, anomalies, camera offline." },
  { m: "GET",  p: "/cameras", d: "Camera health: battery, online status, adaptive boost." },
  { m: "GET",  p: "/dashboard-summary", d: "Aggregated stats: detections, intrusions, species heatmap." },
  { m: "POST", p: "/verify-report", d: "Internal AI verification, exposed for audits." },
];

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-secondary">{children}</span>;
}

function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Architecture</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          ForestGuard AI is a four-part ecosystem: edge AI camera traps, a central brain (this server),
          a command dashboard, and a community reporting module with reward incentives.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-2">Edge AI model card</h2>
          <div className="text-xs text-muted-foreground mb-3">
            On-device wildlife classifier for camera-trap frames. Runs offline; only JSON detections are sent.
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Architecture</div>
              <div className="mt-1">MobileNetV3-Small · 224×224 · INT8</div>
              <div className="text-[10px] text-muted-foreground mt-1">~3.4M params · 12ms/frame on edge</div>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Training data</div>
              <div className="mt-1">60k labeled camera-trap images</div>
              <div className="text-[10px] text-muted-foreground mt-1">Nepal parks + global wildlife set</div>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Precision/Recall</div>
              <div className="mt-1">Precision 92% · Recall 88%</div>
              <div className="text-[10px] text-muted-foreground mt-1">False positive rate ~3%</div>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Update mechanism</div>
              <div className="mt-1">Quarterly model refresh</div>
              <div className="text-[10px] text-muted-foreground mt-1">Edge devices OTA when idle</div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-3">
            Alert threshold: <span className="text-foreground font-mono">≥ 70%</span> confidence; human in restricted zones triggers CRITICAL.
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-2">End-to-end data flow</h2>
          <div className="rounded-md border border-border bg-secondary/40 p-3 overflow-hidden">
            <svg viewBox="0 0 720 200" className="w-full h-auto">
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6" fill="oklch(0.74 0.16 150)" />
                </marker>
              </defs>
              <rect x="10" y="26" width="120" height="60" rx="10" fill="oklch(0.28 0.018 160)" stroke="oklch(0.32 0.015 160)" />
              <text x="70" y="55" textAnchor="middle" fontSize="11" fill="oklch(0.94 0.01 150)">Camera</text>
              <text x="70" y="70" textAnchor="middle" fontSize="9" fill="oklch(0.68 0.02 155)">Edge AI</text>

              <rect x="160" y="26" width="120" height="60" rx="10" fill="oklch(0.28 0.018 160)" stroke="oklch(0.32 0.015 160)" />
              <text x="220" y="55" textAnchor="middle" fontSize="11" fill="oklch(0.94 0.01 150)">Cloud</text>
              <text x="220" y="70" textAnchor="middle" fontSize="9" fill="oklch(0.68 0.02 155)">Dedup + Alerts</text>

              <rect x="310" y="26" width="120" height="60" rx="10" fill="oklch(0.28 0.018 160)" stroke="oklch(0.32 0.015 160)" />
              <text x="370" y="55" textAnchor="middle" fontSize="11" fill="oklch(0.94 0.01 150)">Officer</text>
              <text x="370" y="70" textAnchor="middle" fontSize="9" fill="oklch(0.68 0.02 155)">Dashboard</text>

              <rect x="460" y="26" width="120" height="60" rx="10" fill="oklch(0.28 0.018 160)" stroke="oklch(0.32 0.015 160)" />
              <text x="520" y="55" textAnchor="middle" fontSize="11" fill="oklch(0.94 0.01 150)">Community</text>
              <text x="520" y="70" textAnchor="middle" fontSize="9" fill="oklch(0.68 0.02 155)">AI review</text>

              <rect x="610" y="26" width="100" height="60" rx="10" fill="oklch(0.28 0.018 160)" stroke="oklch(0.32 0.015 160)" />
              <text x="660" y="55" textAnchor="middle" fontSize="11" fill="oklch(0.94 0.01 150)">eSewa</text>
              <text x="660" y="70" textAnchor="middle" fontSize="9" fill="oklch(0.68 0.02 155)">Payout</text>

              <line x1="130" y1="56" x2="160" y2="56" stroke="oklch(0.74 0.16 150)" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="280" y1="56" x2="310" y2="56" stroke="oklch(0.74 0.16 150)" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="430" y1="56" x2="460" y2="56" stroke="oklch(0.74 0.16 150)" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="580" y1="56" x2="610" y2="56" stroke="oklch(0.74 0.16 150)" strokeWidth="2" markerEnd="url(#arrow)" />

              <rect x="110" y="120" width="180" height="46" rx="8" fill="oklch(0.22 0.014 160)" stroke="oklch(0.32 0.015 160)" />
              <text x="200" y="148" textAnchor="middle" fontSize="10" fill="oklch(0.78 0.02 155)">Detections (JSON only)</text>

              <line x1="220" y1="86" x2="200" y2="120" stroke="oklch(0.74 0.16 150)" strokeWidth="1.5" markerEnd="url(#arrow)" />
            </svg>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            Camera → Edge AI → Cloud → Officer review → Community rewards → eSewa payout.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-2">Pipeline</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>Camera captures frames; on-device model filters empty / leaf / wind frames.</li>
            <li>Only useful detections are serialized as JSON and pushed to <span className="font-mono text-foreground">/camera-data</span>.</li>
            <li>Backend dedupes (12s window), classifies anomalies, raises alerts.</li>
            <li>Adaptive coordination boosts cameras within ~15km of an event.</li>
            <li>Dashboard polls live; community reports flow through AI verification.</li>
            <li>Reward engine adjusts points + trust score per reporter.</li>
          </ol>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-2">API Surface</h2>
          <ul className="space-y-2 text-sm">
            {ENDPOINTS.map(e => (
              <li key={e.p} className="flex gap-3 items-start">
                <Pill>{e.m}</Pill>
                <div>
                  <div className="font-mono text-sm">{e.p}</div>
                  <div className="text-xs text-muted-foreground">{e.d}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-3">
            Implemented as TanStack server functions in <span className="font-mono">src/lib/forest.functions.ts</span>; in-memory store mirrors a FastAPI service.
          </p>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-2">Example camera payload</h2>
          <pre className="text-[11px] font-mono bg-secondary/60 border border-border rounded-md p-3 overflow-x-auto">{`{
  "camera_id": "cam_01",
  "timestamp": "2026-05-09T03:14:22Z",
  "detections": [
    { "object": "deer",  "confidence": 0.91 },
    { "object": "human", "confidence": 0.88 }
  ],
  "battery": 78
}`}</pre>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-2">Demo flow</h2>
          <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal pl-5">
            <li>Watch the Edge AI simulator stream events into <em>Detection Stream</em>.</li>
            <li>When a human appears in a restricted zone, a CRITICAL alert pops in real time.</li>
            <li>Neighboring cameras gain an <em>ADAPTIVE</em> boost on the map.</li>
            <li>Open <em>Community</em>, submit a sighting, watch AI verdict + points award instantly.</li>
            <li>Submit a low-quality report (no image, exotic species) — see it scored <em>likely_fake</em>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
