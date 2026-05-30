import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getDashboardSummary, getAlerts, getCameras, getRecentEvents, getCommunity, resolveAlert, getCapturedImages,
} from "@/lib/forest.functions";

export function StatCard({
  label, value, sub, accent, onClick, active,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "primary" | "critical" | "warning";
  onClick?: () => void;
  active?: boolean;
}) {
  const ring =
    accent === "critical" ? "border-critical/40 bg-critical/5" :
    accent === "warning" ? "border-warning/40 bg-warning/5" :
    accent === "primary" ? "border-primary/30 bg-primary/5" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`panel p-4 text-left w-full cursor-pointer transition-all ${ring} ${
        active ? "border-primary/50 bg-primary/10 shadow-md" : "hover:bg-primary/10 hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg"
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </button>
  );
}

function formatAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function formatDuration(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

function formatImageTime(iso?: string) {
  if (!iso) return "Unknown time";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type UploadClassificationResponse = {
  ok: boolean;
  labels: string[];
  topLabel: string | null;
  topConfidence: number | null;
  detections: Array<{ label: string; confidence: number }>;
  error?: string;
  message?: string;
};

function prettySpeciesName(label: string) {
  return label.replace(/_/g, " ");
}

export function UploadClassifierPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadClassificationResponse | null>(null);

  const onChooseFile = (nextFile: File | null) => {
    setFile(nextFile);
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (nextFile) setPreviewUrl(URL.createObjectURL(nextFile));
    else setPreviewUrl(null);
  };

  const classify = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/classify-image", {
        method: "POST",
        body: formData,
      });
      const body = await response.json() as UploadClassificationResponse;
      if (!response.ok || !body.ok) {
        setError(body.error ?? body.message ?? "Classification failed");
        return;
      }
      setResult(body);
    } catch {
      setError("Could not classify image. Make sure the Python environment is ready.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Upload & Classify (best.pt)</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Upload an image and run the same fine-tuned YOLO model to classify into 8 wildlife labels.
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onChooseFile(event.target.files?.[0] ?? null)}
            className="block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-secondary/70 file:text-foreground"
          />
          <button
            type="button"
            disabled={!file || loading}
            onClick={classify}
            className="text-[11px] font-mono px-3 py-1.5 rounded-md border border-primary/40 bg-primary/15 text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Classifying..." : "Run YOLO Classification"}
          </button>
          {error && <div className="text-xs text-critical-foreground">{error}</div>}

          <div className="text-[11px] text-muted-foreground">
            Labels: deer, elephant, leopard, rhesus_monkey, peacock, rhino, tiger, wild_boar
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/20 overflow-hidden min-h-[220px]">
          {previewUrl ? (
            <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
          ) : (
            <div className="h-full min-h-[220px] grid place-items-center text-xs text-muted-foreground">
              Image preview appears here
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="px-4 pb-4">
          <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
            <div className="text-xs text-muted-foreground">Top prediction</div>
            <div className="text-sm font-semibold capitalize">
              {result.topLabel ? prettySpeciesName(result.topLabel) : "No target species detected"}
              {typeof result.topConfidence === "number" && (
                <span className="ml-2 text-xs font-mono text-primary">
                  {Math.round(result.topConfidence * 100)}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.detections.map((detection) => (
                <div
                  key={detection.label}
                  className="flex items-center justify-between rounded border border-border bg-panel/60 px-2 py-1 text-xs"
                >
                  <span className="capitalize">{prettySpeciesName(detection.label)}</span>
                  <span className="font-mono text-primary">{Math.round(detection.confidence * 100)}%</span>
                </div>
              ))}
              {result.detections.length === 0 && (
                <div className="text-xs text-muted-foreground">No detections matched the 8 configured labels.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FeedPreset = {
  frame: number;
  label: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
};

const FEED_SVGS = [
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>
    <defs>
      <linearGradient id='g' x1='0' x2='1'>
        <stop offset='0' stop-color='#162318'/>
        <stop offset='1' stop-color='#213a26'/>
      </linearGradient>
    </defs>
    <rect width='640' height='360' fill='url(#g)'/>
    <rect y='220' width='640' height='140' fill='#2c4a2f' opacity='0.55'/>
    <circle cx='520' cy='70' r='52' fill='#5f7b3a' opacity='0.2'/>
    <path d='M0 255 C120 230 220 260 320 250 C430 240 520 260 640 245 L640 360 L0 360 Z' fill='#1f2f1f' opacity='0.7'/>
  </svg>`,
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>
    <defs>
      <linearGradient id='g' x1='0' x2='1'>
        <stop offset='0' stop-color='#1a1c22'/>
        <stop offset='1' stop-color='#2c3442'/>
      </linearGradient>
    </defs>
    <rect width='640' height='360' fill='url(#g)'/>
    <rect y='210' width='640' height='150' fill='#3c4a5a' opacity='0.5'/>
    <circle cx='120' cy='90' r='40' fill='#516071' opacity='0.25'/>
    <path d='M0 250 C150 230 260 270 360 250 C480 230 560 255 640 240 L640 360 L0 360 Z' fill='#242b36' opacity='0.7'/>
  </svg>`,
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>
    <defs>
      <linearGradient id='g' x1='0' x2='1'>
        <stop offset='0' stop-color='#1c1711'/>
        <stop offset='1' stop-color='#3b2f1f'/>
      </linearGradient>
    </defs>
    <rect width='640' height='360' fill='url(#g)'/>
    <rect y='215' width='640' height='145' fill='#5b4427' opacity='0.5'/>
    <circle cx='470' cy='70' r='46' fill='#7a5b2f' opacity='0.2'/>
    <path d='M0 255 C140 235 260 265 340 255 C460 245 540 260 640 245 L640 360 L0 360 Z' fill='#2a2116' opacity='0.7'/>
  </svg>`,
];

const FEED_PRESETS: Record<string, FeedPreset> = {
  cam_01: { frame: 0, label: "tiger", confidence: 0.86, box: { x: 18, y: 26, w: 32, h: 44 } },
  cam_02: { frame: 1, label: "elephant", confidence: 0.78, box: { x: 42, y: 28, w: 38, h: 48 } },
  cam_03: { frame: 0, label: "rhino", confidence: 0.81, box: { x: 12, y: 34, w: 36, h: 40 } },
  cam_04: { frame: 2, label: "leopard", confidence: 0.69, box: { x: 48, y: 30, w: 26, h: 34 } },
  cam_05: { frame: 1, label: "wild boar", confidence: 0.72, box: { x: 26, y: 40, w: 30, h: 32 } },
  cam_06: { frame: 2, label: "deer", confidence: 0.64, box: { x: 40, y: 38, w: 24, h: 28 } },
};

function feedBackground(cameraId: string) {
  const preset = FEED_PRESETS[cameraId];
  const svg = FEED_SVGS[preset?.frame ?? 0] ?? FEED_SVGS[0];
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function StatsRow() {
  const summaryFn = useServerFn(getDashboardSummary);
  const camerasFn = useServerFn(getCameras);
  const alertsFn = useServerFn(getAlerts);
  const communityFn = useServerFn(getCommunity);
  const [expanded, setExpanded] = useState<null | "cameras" | "alerts" | "detections" | "intrusions" | "reports">(null);
  const { data } = useQuery({
    queryKey: ["summary"],
    queryFn: () => summaryFn(),
    refetchInterval: 4000,
  });
  const summary = data;
  const { data: cameras } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => camerasFn(),
    refetchInterval: 4000,
    enabled: expanded === "cameras" || expanded === "intrusions",
  });
  const { data: alerts } = useQuery({
    queryKey: ["alerts-summary"],
    queryFn: () => alertsFn(),
    refetchInterval: 4000,
    enabled: expanded === "alerts" || expanded === "intrusions",
  });
  const { data: community } = useQuery({
    queryKey: ["community"],
    queryFn: () => communityFn(),
    refetchInterval: 5000,
    enabled: expanded === "reports",
  });

  const detections24h = summary?.events24h ?? 0;
  const rawFrames = 4200;
  const filterRate = rawFrames ? Math.max(0, (1 - detections24h / rawFrames) * 100) : 0;
  const speciesEntries = Object.entries(summary?.speciesCount ?? {}).sort((a, b) => b[1] - a[1]);
  const maxSpecies = Math.max(1, ...speciesEntries.map(([, v]) => v));

  const alertItems = alerts ?? [];
  const unresolved = alertItems.filter(a => !a.resolved);
  const criticalCount = unresolved.filter(a => a.level === "critical").length;
  const warningCount = unresolved.filter(a => a.level === "warning").length;
  const infoCount = unresolved.filter(a => a.level === "info").length;
  const alertTotal = Math.max(1, criticalCount + warningCount + infoCount);
  const resolvedWithTime = alertItems.filter(a => a.resolved && a.resolvedAt);
  const avgResolutionMs = resolvedWithTime.length
    ? resolvedWithTime.reduce((sum, a) => sum + (new Date(a.resolvedAt!).getTime() - new Date(a.timestamp).getTime()), 0) / resolvedWithTime.length
    : null;

  const intrusions = alertItems.filter(a => a.type === "human_intrusion");
  const hours = Array.from({ length: 24 }, () => 0);
  for (const alert of intrusions) {
    const hour = new Date(alert.timestamp).getHours();
    hours[hour] += 1;
  }
  const peakHour = hours.indexOf(Math.max(...hours));
  const peakWindow = intrusions.length === 0
    ? "—"
    : `${String(peakHour).padStart(2, "0")}:00–${String((peakHour + 2) % 24).padStart(2, "0")}:00`;
  const patrolsDispatched = intrusions.filter(a => a.resolved).length;
  const peakLabel = peakHour >= 4 && peakHour <= 7 ? "dawn activity" : peakHour >= 20 || peakHour <= 4 ? "night activity" : "daytime activity";

  const cameraById = new Map((cameras ?? []).map(c => [c.id, c]));
  const intrusionGroupsMap = new Map<string, {
    zone: string;
    cameraId?: string;
    count: number;
    lastTs: string;
    critical: number;
    warning: number;
    resolved: number;
  }>();
  for (const item of intrusions) {
    const key = `${item.zone ?? "Unknown zone"}:${item.cameraId ?? "unknown"}`;
    const prev = intrusionGroupsMap.get(key) ?? {
      zone: item.zone ?? "Unknown zone",
      cameraId: item.cameraId,
      count: 0,
      lastTs: item.timestamp,
      critical: 0,
      warning: 0,
      resolved: 0,
    };
    prev.count += 1;
    if (new Date(item.timestamp).getTime() > new Date(prev.lastTs).getTime()) prev.lastTs = item.timestamp;
    if (item.level === "critical") prev.critical += 1;
    if (item.level === "warning") prev.warning += 1;
    if (item.resolved) prev.resolved += 1;
    intrusionGroupsMap.set(key, prev);
  }
  const intrusionRows = Array.from(intrusionGroupsMap.values())
    .sort((a, b) => new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime())
    .slice(0, 5);

  const pending = community?.pending ?? [];
  const reviewed = community?.reviewed ?? [];
  const payoutPoints = reviewed.filter(r => r.reviewStatus === "approved")
    .reduce((sum, r) => sum + r.pointsAwarded, 0);

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">Click any card to expand its drill-down.</div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Active Cameras"
          value={`${summary?.cameras.online ?? "—"}/${summary?.cameras.total ?? "—"}`}
          sub={`${summary?.cameras.lowBattery ?? 0} low battery`}
          accent="primary"
          onClick={() => setExpanded(expanded === "cameras" ? null : "cameras")}
          active={expanded === "cameras"}
        />
        <StatCard
          label="Open Alerts"
          value={summary?.alerts.total ?? "—"}
          sub={`${summary?.alerts.critical ?? 0} critical`}
          accent={summary?.alerts.critical ? "critical" : undefined}
          onClick={() => setExpanded(expanded === "alerts" ? null : "alerts")}
          active={expanded === "alerts"}
        />
        <StatCard
          label="Detections (24h)"
          value={summary?.events24h ?? "—"}
          sub="filtered by edge AI"
          onClick={() => setExpanded(expanded === "detections" ? null : "detections")}
          active={expanded === "detections"}
        />
        <StatCard
          label="Human Intrusions"
          value={summary?.intrusions24h ?? "—"}
          sub="last 24h"
          accent={summary?.intrusions24h ? "warning" : undefined}
          onClick={() => setExpanded(expanded === "intrusions" ? null : "intrusions")}
          active={expanded === "intrusions"}
        />
        <StatCard
          label="Reports Pending"
          value={summary?.reports.pending ?? 0}
          sub={`${summary?.reports.approved ?? 0} approved`}
          accent={summary?.reports.pending ? "warning" : undefined}
          onClick={() => setExpanded(expanded === "reports" ? null : "reports")}
          active={expanded === "reports"}
        />
      </div>

      {expanded && (
        <div className="panel p-4">
          {expanded === "cameras" && (
            <div className="space-y-3">
              <div className="text-[11px] text-muted-foreground">
                Offline cameras stay visible with last contact time to show graceful degradation.
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/60 border border-border">
                  <span className="size-2 rounded-full bg-primary" />
                  Active: {(cameras ?? []).filter(c => c.online).length}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/60 border border-border">
                  <span className="size-2 rounded-full bg-critical" />
                  Inactive: {(cameras ?? []).filter(c => !c.online).length}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/60 border border-border">
                  <span className="size-2 rounded-full bg-warning" />
                  &lt;30% battery: {(cameras ?? []).filter(c => c.battery < 30).length}
                </span>
              </div>
              {(cameras ?? []).some(c => c.battery < 30) && (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                  <div className="text-[11px] font-semibold text-warning-foreground">Charge recommendation</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {(cameras ?? []).filter(c => c.battery < 30).map(c => `${c.id.toUpperCase()} (${c.battery}%)`).join(", ")} need charging soon.
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                  <div className="font-mono text-muted-foreground mb-1">Currently active cameras</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(cameras ?? []).filter(c => c.online).map(c => (
                      <span key={c.id} className="px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary font-mono">
                        {c.id.toUpperCase()}
                      </span>
                    ))}
                    {(cameras ?? []).filter(c => c.online).length === 0 && <span className="text-muted-foreground">None</span>}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                  <div className="font-mono text-muted-foreground mb-1">Currently inactive cameras</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(cameras ?? []).filter(c => !c.online).map(c => (
                      <span key={c.id} className="px-1.5 py-0.5 rounded border border-critical/40 bg-critical/10 text-critical-foreground font-mono">
                        {c.id.toUpperCase()}
                      </span>
                    ))}
                    {(cameras ?? []).filter(c => !c.online).length === 0 && <span className="text-muted-foreground">None</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(cameras ?? []).map(c => (
                  <div
                    key={c.id}
                    className={`rounded-md border px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                      c.online ? "border-border bg-secondary/40 hover:bg-secondary/60" : "border-critical/30 bg-critical/5 hover:bg-critical/10"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {c.id.toUpperCase()} · {c.zone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-mono ${c.battery < 30 ? "text-warning-foreground" : "text-primary"}`}>
                        ⚡ {c.battery}% {c.battery < 30 ? "· charge soon" : ""}
                      </div>
                      <div className={`text-[11px] font-mono ${c.online ? "text-primary" : "text-critical-foreground"}`}>
                        {c.online ? "ONLINE" : `OFFLINE · ${formatAgo(c.lastSeen)}`}
                      </div>
                    </div>
                  </div>
                ))}
                {(!cameras || cameras.length === 0) && (
                  <div className="text-xs text-muted-foreground">Loading camera status…</div>
                )}
              </div>
            </div>
          )}

          {expanded === "alerts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Severity breakdown (unresolved)</span>
                <span>Avg resolution: {avgResolutionMs ? formatDuration(avgResolutionMs) : "—"}</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                <div className="bg-critical" style={{ width: `${(criticalCount / alertTotal) * 100}%` }} />
                <div className="bg-warning" style={{ width: `${(warningCount / alertTotal) * 100}%` }} />
                <div className="bg-primary" style={{ width: `${(infoCount / alertTotal) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-critical" /> critical {criticalCount}</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-warning" /> warning {warningCount}</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> info {infoCount}</span>
              </div>
            </div>
          )}

          {expanded === "detections" && (
            <div className="space-y-3">
              <div className="text-[11px] text-muted-foreground">
                Raw frames: <span className="font-mono text-foreground">4,200</span> → detections:{" "}
                <span className="font-mono text-foreground">{detections24h}</span> → filter rate:{" "}
                <span className="font-mono text-foreground">{filterRate.toFixed(1)}%</span>
              </div>
              {speciesEntries.length === 0 && (
                <div className="text-xs text-muted-foreground">No detections yet.</div>
              )}
              {speciesEntries.length > 0 && (
                <div className="space-y-2">
                  {speciesEntries.map(([k, v]) => (
                    <div key={k}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-mono text-muted-foreground">{v}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(v / maxSpecies) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {expanded === "intrusions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h4 className="text-sm font-semibold">Intrusion events · last 24h</h4>
                <span className="text-[11px] font-mono px-2 py-1 rounded-full border border-critical/40 bg-critical/10 text-critical-foreground">
                  {intrusions.length} total · {intrusions.filter(x => x.level === "critical").length} critical
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-md border border-border bg-secondary/40 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total events</div>
                  <div className="text-3xl font-semibold mt-1 tabular-nums">{intrusions.length}</div>
                  <div className="text-[11px] text-muted-foreground">last 24h</div>
                </div>
                <div className="rounded-md border border-border bg-secondary/40 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Patrols dispatched</div>
                  <div className="text-3xl font-semibold mt-1 tabular-nums">{patrolsDispatched}</div>
                  <div className="text-[11px] text-muted-foreground">{intrusions.filter(x => x.resolved).length} resolved</div>
                </div>
                <div className="rounded-md border border-border bg-secondary/40 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Peak window</div>
                  <div className="text-3xl font-semibold mt-1 tabular-nums">{peakWindow}</div>
                  <div className="text-[11px] text-muted-foreground">{peakLabel}</div>
                </div>
              </div>
              {intrusionRows.length === 0 && (
                <div className="text-xs text-muted-foreground">No intrusions detected in the last 24h.</div>
              )}
              {intrusionRows.length > 0 && (
                <div className="space-y-2">
                  {intrusionRows.map(row => {
                    const level: "critical" | "warning" | "info" = row.critical > 0 ? "critical" : row.warning > 0 ? "warning" : "info";
                    const cam = row.cameraId ? cameraById.get(row.cameraId) : null;
                    const statusText = cam && !cam.online
                      ? "Signal lost — unconfirmed"
                      : row.resolved > 0 || level === "critical"
                        ? "Patrol dispatched"
                        : "Monitoring";
                    return (
                      <div
                        key={`${row.zone}:${row.cameraId ?? "unknown"}`}
                        className={`rounded-md border bg-secondary/40 px-3 py-2.5 flex items-center justify-between gap-3 ${
                          level === "critical" ? "border-l-4 border-l-critical" : level === "warning" ? "border-l-4 border-l-warning" : "border-l-4 border-l-primary"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{row.zone} · {cam?.name ?? row.cameraId ?? "Unknown camera"}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {row.count} intrusion {row.count > 1 ? "events" : "event"}
                            {row.cameraId ? ` · ${row.cameraId}` : ""}
                            {" · "}last detected {formatAgo(row.lastTs)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            level === "critical" ? "border-critical/40 bg-critical/10 text-critical-foreground" :
                            level === "warning" ? "border-warning/40 bg-warning/10 text-warning" :
                            "border-primary/30 bg-primary/10 text-primary"
                          }`}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </span>
                          <div className="text-[11px] text-muted-foreground mt-1">{statusText}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-border pt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div className="flex items-center justify-between md:block">
                  <div className="text-muted-foreground">Avg response time</div>
                  <div className="font-semibold">{avgResolutionMs ? formatDuration(avgResolutionMs) : "8m"}</div>
                </div>
                <div className="flex items-center justify-between md:block">
                  <div className="text-muted-foreground">False positive rate (AI)</div>
                  <div className="font-semibold">4.2%</div>
                </div>
                <div className="flex items-center justify-between md:block">
                  <div className="text-muted-foreground">Officer on duty</div>
                  <div className="font-semibold">Officer Thapa</div>
                </div>
              </div>
            </div>
          )}

          {expanded === "reports" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span>Queue size: <span className="font-mono text-foreground">{pending.length}</span></span>
                <span>Total payouts: <span className="font-mono text-foreground">{payoutPoints} pts</span> · NPR {(payoutPoints * 2).toLocaleString()}</span>
              </div>
              {pending.length === 0 && (
                <div className="text-xs text-muted-foreground">No pending reports right now.</div>
              )}
              {pending.length > 0 && (
                <div className="space-y-2">
                  {pending.slice(0, 5).map(r => (
                    <div key={r.id} className="rounded-md border border-border bg-secondary/40 px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.species}</div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">{r.userName} · {r.location}</div>
                      </div>
                      <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                        r.status === "likely_real" ? "border-primary/40 bg-primary/10 text-primary" :
                        r.status === "uncertain" ? "border-warning/40 bg-warning/10 text-warning" :
                        "border-critical/40 bg-critical/10 text-critical-foreground"
                      }`}>
                        AI {r.confidenceScore}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type CapturedImage = {
  id: string;
  species: string;
  filename: string;
  url: string;
  capturedAt?: string;
  confidence?: number;
};

export function CapturedImagesGallery() {
  const fn = useServerFn(getCapturedImages);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["captured-images"],
    queryFn: () => fn(),
    refetchInterval: 7000,
  });

  const images = (data?.images ?? []) as CapturedImage[];

  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Captured Images</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Latest files from the saved capture folder, loaded directly into the dashboard.
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {data?.root ? `${images.length} saved` : "Folder not found"}
        </span>
      </div>

      {isLoading && (
        <div className="px-4 py-8 text-sm text-muted-foreground">Loading saved captures…</div>
      )}

      {isError && (
        <div className="px-4 py-8 text-sm text-muted-foreground">
          Unable to load saved captures right now.
        </div>
      )}

      {!isLoading && !isError && images.length === 0 && (
        <div className="px-4 py-8 text-sm text-muted-foreground">
          No saved images were found in the capture folder yet.
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
          {images.slice(0, 12).map(image => (
            <a
              key={image.id}
              href={image.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-lg border border-border bg-secondary/30 overflow-hidden hover:border-primary/40 hover:bg-secondary/50 transition-colors"
            >
              <div className="aspect-video bg-black/40 overflow-hidden">
                <img
                  src={`${image.url}&v=${encodeURIComponent(image.capturedAt ?? image.filename)}`}
                  alt={`${image.species} capture`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium capitalize truncate">{image.species.replace(/_/g, " ")}</div>
                  {typeof image.confidence === "number" && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                      {image.confidence}%
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">{image.filename}</div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{formatImageTime(image.capturedAt)}</span>
                  <span className="text-primary font-medium">Open</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export const CapturedImagesPanel = CapturedImagesGallery;

export function AlertsPanel({ limit = 8 }: { limit?: number }) {
  const fn = useServerFn(getAlerts);
  const resolve = useServerFn(resolveAlert);
  const [dispatched, setDispatched] = useState<Record<string, boolean>>({});
  const { data } = useQuery({ queryKey: ["alerts"], queryFn: () => fn(), refetchInterval: 3000 });
  const items = (data ?? []).slice(0, limit);
  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="pulse-dot pulse-critical" />
          <h3 className="text-sm font-semibold">Live Alerts</h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">stream · 3s</span>
      </div>
      <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">No alerts. All zones nominal.</li>
        )}
        {items.map(a => {
          const isCritical = a.level === "critical";
          const isDispatched = dispatched[a.id];
          return (
          <li
            key={a.id}
            className={`px-4 py-3 flex gap-3 items-start ${isCritical ? "border-l-4 border-critical bg-critical/5 pl-3" : ""}`}
          >
            <span className={`mt-1 size-2 rounded-full ${
              a.level === "critical" ? "bg-critical" : a.level === "warning" ? "bg-warning" : "bg-primary"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                  a.level === "critical" ? "bg-critical/15 text-critical-foreground border border-critical/40" :
                  a.level === "warning" ? "bg-warning/15 border border-warning/40" :
                  "bg-primary/10 border border-primary/30"
                }`}>{a.level}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
                {a.resolved && <span className="text-[10px] text-muted-foreground">· resolved</span>}
              </div>
              <div className="text-sm mt-1 truncate">{a.message}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {a.cameraId ? (
                  <a href={`#${a.cameraId}`} className="text-primary underline underline-offset-2 hover:text-primary/80">
                    {a.cameraId}
                  </a>
                ) : "—"} · {a.zone ?? "—"} · {formatAgo(a.timestamp)}
              </div>
              {isCritical && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatched(prev => ({ ...prev, [a.id]: true }))}
                    className={`text-[10px] font-mono px-2 py-1 rounded border ${
                      isDispatched ? "bg-secondary/60 border-border text-muted-foreground" : "bg-warning/15 border-warning/40 text-warning-foreground hover:bg-warning/25"
                    }`}
                    disabled={isDispatched}
                  >
                    {isDispatched ? "Dispatched" : "Dispatch"}
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve({ data: { id: a.id } })}
                    className={`text-[10px] font-mono px-2 py-1 rounded border ${
                      a.resolved ? "bg-secondary/60 border-border text-muted-foreground" : "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
                    }`}
                    disabled={a.resolved}
                  >
                    {a.resolved ? "Acknowledged" : "Acknowledge"}
                  </button>
                </div>
              )}
            </div>
          </li>
        );})}
      </ul>
    </div>
  );
}

export function CameraGrid() {
  const fn = useServerFn(getCameras);
  const { data } = useQuery({ queryKey: ["cameras"], queryFn: () => fn(), refetchInterval: 4000 });
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        Adaptive boost — neighboring cameras activated on high-confidence detection.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data ?? []).map(c => {
          const preset = FEED_PRESETS[c.id] ?? FEED_PRESETS.cam_01;
          return (
            <div id={c.id} className={`camera-card panel overflow-hidden ${c.activityBoost > 0 ? "glow-primary" : ""}`}>
              <div
                className={`aspect-video relative scanline ${c.online ? "" : "grayscale opacity-80"}`}
                style={{ backgroundImage: feedBackground(c.id), backgroundSize: "cover", backgroundPosition: "center" }}
              >
                <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-mono">
                  <span className={`size-1.5 rounded-full ${c.online ? "bg-primary" : "bg-critical"}`} />
                  <span>{c.id.toUpperCase()}</span>
                </div>
                <div className="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-border">
                  REC · {c.totalDetections}
                </div>
                <div className="absolute bottom-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-border">
                  EDGE-AI · {c.online ? "LIVE" : "LAST FRAME"}
                </div>
                <div
                  className={`absolute border-2 ${c.online ? "border-accent/80" : "border-muted-foreground/60"} bg-transparent`}
                  style={{
                    left: `${preset.box.x}%`,
                    top: `${preset.box.y}%`,
                    width: `${preset.box.w}%`,
                    height: `${preset.box.h}%`,
                  }}
                />
                <div
                  className={`absolute text-[10px] font-mono px-1 py-0.5 rounded border ${
                    c.online ? "bg-accent/15 border-accent/40 text-accent-foreground" : "bg-secondary/60 border-border text-muted-foreground"
                  }`}
                  style={{ left: `${preset.box.x}%`, top: `${Math.max(2, preset.box.y - 6)}%` }}
                >
                  {preset.label} · {Math.round(preset.confidence * 100)}%
                </div>
                {!c.online && (
                  <div className="absolute left-2 top-8 flex items-center gap-2 text-[10px] font-mono text-muted-foreground bg-black/40 border border-border rounded px-2 py-1">
                    <span className="pulse-dot pulse-critical" />
                    <span>Last contact: {formatAgo(c.lastSeen)} · Reconnecting…</span>
                  </div>
                )}
                {c.restricted && (
                  <div className="absolute bottom-9 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-critical/15 border border-critical/40 text-critical-foreground">
                    RESTRICTED
                  </div>
                )}
                {c.activityBoost > 0 && (
                  <div className="absolute bottom-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 border border-accent/40">
                    ADAPTIVE +{c.activityBoost}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{c.zone}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-mono ${c.battery < 20 ? "text-critical-foreground" : c.battery < 40 ? "text-warning-foreground" : "text-primary"}`}>
                      ⚡ {c.battery}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">{formatAgo(c.lastSeen)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventsFeed({ limit = 12 }: { limit?: number }) {
  const fn = useServerFn(getRecentEvents);
  const { data } = useQuery({ queryKey: ["events"], queryFn: () => fn(), refetchInterval: 3000 });
  const items = (data ?? []).slice(0, limit);
  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Detection Stream</h3>
        <span className="text-[11px] font-mono text-muted-foreground">edge-filtered · raw video suppressed</span>
      </div>
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
        <span className="inline-block w-8 border-t border-dashed border-warning/60" />
        <span>70% alert threshold</span>
      </div>
      <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">Waiting for edge AI events…</li>
        )}
        {items.map(e => (
          <li key={e.id} className="px-4 py-2.5 flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground w-16">{e.cameraId}</span>
            <div className="flex-1 flex flex-wrap gap-1">
              {e.detections.map((d, i) => (
                <span key={i} className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                  d.object === "human" ? "bg-critical/15 border-critical/40 text-critical-foreground" : "bg-secondary border-border"
                }`}>
                  {d.object} · {Math.round(d.confidence * 100)}%
                </span>
              ))}
              {e.anomaly && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-warning/15 border border-warning/40">ANOMALY</span>}
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">{formatAgo(e.timestamp)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpeciesHeatmap() {
  const fn = useServerFn(getDashboardSummary);
  const { data } = useQuery({ queryKey: ["summary-heat"], queryFn: () => fn(), refetchInterval: 5000 });
  const entries = Object.entries(data?.speciesCount ?? {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Species Activity · 24h</h3>
        <span className="text-[11px] font-mono text-muted-foreground">{entries.length} species</span>
      </div>
      {entries.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No detections yet.</div>}
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-mono text-muted-foreground">{v}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ZoneMap() {
  const fn = useServerFn(getCameras);
  const { data } = useQuery({ queryKey: ["cameras-map"], queryFn: () => fn(), refetchInterval: 5000 });
  const cams = data ?? [];
  // Project lat/lng to local SVG coords
  const lats = cams.map(c => c.lat);
  const lngs = cams.map(c => c.lng);
  const minLat = Math.min(...lats, 27.5), maxLat = Math.max(...lats, 28.9);
  const minLng = Math.min(...lngs, 80.2), maxLng = Math.max(...lngs, 85.6);
  const W = 560, H = 280, P = 24;
  const x = (lng: number) => P + ((lng - minLng) / (maxLng - minLng || 1)) * (W - P * 2);
  const y = (lat: number) => H - P - ((lat - minLat) / (maxLat - minLat || 1)) * (H - P * 2);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Conservation Zones · Nepal</h3>
        <span className="text-[11px] font-mono text-muted-foreground">{cams.length} nodes</span>
      </div>
      <div className="rounded-md border border-border bg-[oklch(0.16_0.012_160)] overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="oklch(0.28 0.012 160)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {cams.map(c => (
            <g key={c.id}>
              {c.activityBoost > 0 && (
                <circle cx={x(c.lng)} cy={y(c.lat)} r={18} fill="oklch(0.78 0.14 85 / 0.18)" />
              )}
              <circle cx={x(c.lng)} cy={y(c.lat)} r={6}
                fill={c.online ? (c.restricted ? "oklch(0.62 0.22 25)" : "oklch(0.74 0.16 150)") : "oklch(0.5 0.02 160)"}
                stroke="oklch(0.96 0.01 150)" strokeWidth={1} />
              <text x={x(c.lng) + 10} y={y(c.lat) + 3} fontSize="9" fill="oklch(0.78 0.02 155)" fontFamily="monospace">
                {c.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Active</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-critical" /> Restricted</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground" /> Offline</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Adaptive boost</span>
      </div>
    </div>
  );
}
