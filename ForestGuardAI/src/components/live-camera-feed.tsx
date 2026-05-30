import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef, useCallback } from "react";
import { getCameras, postCameraData, getAlerts } from "@/lib/forest.functions";

const CAMERA_OPTIONS = [
  { id: "cam_01", name: "Chitwan Buffer · North Gate",  zone: "Zone A (Restricted)", restricted: true  },
  { id: "cam_02", name: "Sauraha River Bend",           zone: "Zone B",              restricted: false },
  { id: "cam_03", name: "Bardia Tiger Corridor",        zone: "Zone C (Restricted)", restricted: true  },
  { id: "cam_04", name: "Karnali Watch Post",           zone: "Zone C",              restricted: false },
  { id: "cam_05", name: "Shuklaphanta Grasslands",      zone: "Zone D",              restricted: false },
];

const DEMO_ANIMALS = ["deer","wild_boar","rhesus_monkey","peacock","leopard","tiger","elephant","rhino","sloth_bear"];

const FEED_SVGS = [
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#162318'/><stop offset='1' stop-color='#213a26'/></linearGradient></defs><rect width='640' height='360' fill='url(#g)'/><rect y='220' width='640' height='140' fill='#2c4a2f' opacity='0.55'/><circle cx='520' cy='70' r='52' fill='#5f7b3a' opacity='0.2'/><path d='M0 255 C120 230 220 260 320 250 C430 240 520 260 640 245 L640 360 L0 360 Z' fill='#1f2f1f' opacity='0.7'/></svg>`,
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#1a1c22'/><stop offset='1' stop-color='#2c3442'/></linearGradient></defs><rect width='640' height='360' fill='url(#g)'/><rect y='210' width='640' height='150' fill='#3c4a5a' opacity='0.5'/><circle cx='120' cy='90' r='40' fill='#516071' opacity='0.25'/><path d='M0 250 C150 230 260 270 360 250 C480 230 560 255 640 240 L640 360 L0 360 Z' fill='#242b36' opacity='0.7'/></svg>`,
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#1c1711'/><stop offset='1' stop-color='#3b2f1f'/></linearGradient></defs><rect width='640' height='360' fill='url(#g)'/><rect y='215' width='640' height='145' fill='#5b4427' opacity='0.5'/><circle cx='470' cy='70' r='46' fill='#7a5b2f' opacity='0.2'/><path d='M0 255 C140 235 260 265 340 255 C460 245 540 260 640 245 L640 360 L0 360 Z' fill='#2a2116' opacity='0.7'/></svg>`,
];

type BoundingBox = { x: number; y: number; w: number; h: number };

type DetectionBox = {
  object: string;
  confidence: number;
  box: BoundingBox;   // normalized 0-100% coords from YOLO
};

type ConnStatus = "disconnected" | "connecting" | "live" | "error";

function formatAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function BatteryBar({ pct }: { pct: number }) {
  const color = pct < 20 ? "bg-critical" : pct < 40 ? "bg-warning" : "bg-primary";
  const label = pct < 20 ? "text-critical-foreground" : pct < 40 ? "text-warning" : "text-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-mono tabular-nums ${label}`}>{pct}%</span>
    </div>
  );
}

function batterySourceText(source?: string) {
  if (source === "phone") return "Phone battery (real)";
  if (source === "fallback") return "Fallback battery";
  if (source === "simulated") return "Simulated battery";
  if (source === "unknown") return "Battery source unknown";
  return "No battery source";
}

function batterySourceChip(source?: string) {
  if (source === "phone") {
    return {
      label: "REAL",
      className: "border-primary/40 bg-primary/10 text-primary",
    };
  }
  if (source === "fallback") {
    return {
      label: "FALLBACK",
      className: "border-warning/40 bg-warning/10 text-warning",
    };
  }
  if (source === "simulated") {
    return {
      label: "SIM",
      className: "border-warning/40 bg-warning/10 text-warning",
    };
  }
  return {
    label: "UNKNOWN",
    className: "border-border bg-secondary text-muted-foreground",
  };
}

export function LiveCameraFeed() {
  const camerasFn = useServerFn(getCameras);
  const alertsFn = useServerFn(getAlerts);
  const postFn = useServerFn(postCameraData);
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState("cam_01");
  const [phoneIp, setPhoneIp] = useState("192.168.1.105:8080");
  const [connStatus, setConnStatus] = useState<ConnStatus>("disconnected");
  const [demoMode, setDemoMode] = useState(true);
  const [detectionBoxes, setDetectionBoxes] = useState<DetectionBox[]>([]);
  const [humanDetected, setHumanDetected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [lastDetection, setLastDetection] = useState<{ label: string; ts: string } | null>(null);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [imgError, setImgError] = useState(false);
  const frameTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const batteryDrain = useRef(0);

  const selected = CAMERA_OPTIONS.find(c => c.id === selectedId)!;

  const { data: cameras } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => camerasFn(),
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsFn(),
    refetchInterval: 3000,
  });

  const camStatus = cameras?.find(c => c.id === selectedId);
  const recentAlerts = (alerts ?? []).filter(a => a.cameraId === selectedId && !a.resolved).slice(0, 3);

  // Poll for latest events for this camera (used in real mode for overlay)
  const { data: latestEvents } = useQuery({
    queryKey: ["live-events", selectedId],
    queryFn: async () => {
      const r = await fetch(`/api/events?camera_id=${selectedId}&limit=1`);
      if (!r.ok) return [];
      return r.json() as Promise<Array<{ detections: { object: string; confidence: number }[]; timestamp: string; anomaly: boolean }>>;
    },
    refetchInterval: 2000,
    enabled: connStatus === "live" && !demoMode,
  });

  // When real events arrive, update detection overlay
  useEffect(() => {
    if (!latestEvents?.length || demoMode) return;
    const ev = latestEvents[0];
    const boxes: DetectionBox[] = ev.detections.map((d, i) => ({
      object: d.object,
      confidence: d.confidence,
      // Use real YOLO bounding box if available, else fall back to a sensible estimate
      box: (d as any).box ?? {
        x: 10 + (i * 22) % 55,
        y: 20 + (i * 15) % 45,
        w: d.object === "elephant" ? 38 : d.object === "human" ? 14 : 24,
        h: d.object === "elephant" ? 48 : d.object === "human" ? 40 : 32,
      },
    }));
    setDetectionBoxes(boxes);
    const hasHuman = ev.detections.some(d => d.object === "human");
    setHumanDetected(hasHuman);
    if (ev.detections.length) {
      setLastDetection({ label: ev.detections[0].object, ts: ev.timestamp });
    }
    if (hasHuman) {
      setTimeout(() => setHumanDetected(false), 8000);
    }
  }, [latestEvents, demoMode]);

  // Frame refresh loop for real camera
  const refreshFrame = useCallback(() => {
    if (demoMode) return;
    const t0 = Date.now();
    const url = `http://${phoneIp}/shot.jpg?t=${Date.now()}`;
    setImgSrc(url);
    setLatency(Date.now() - t0);
    setFrameCount(c => c + 1);
  }, [phoneIp, demoMode]);

  // Demo mode loop — simulates detections and posts to backend
  const runDemo = useCallback(async () => {
    if (Math.random() < 0.45) return; // empty frame
    batteryDrain.current += 0.08;
    const dets: { object: string; confidence: number }[] = [];
    if (Math.random() < 0.15) dets.push({ object: "human", confidence: Math.round((0.65 + Math.random() * 0.3) * 100) / 100 });
    const animal = DEMO_ANIMALS[Math.floor(Math.random() * DEMO_ANIMALS.length)];
    dets.push({ object: animal, confidence: Math.round((0.6 + Math.random() * 0.39) * 100) / 100 });

    const boxes: DetectionBox[] = dets.map((d, i) => ({
      object: d.object,
      confidence: d.confidence,
      // Use box from payload if present (matches Python agent format), else estimate
      box: (d as any).box ?? {
        x: 8 + (i * 28) % 60,
        y: 15 + (i * 18) % 50,
        w: d.object === "human" ? 12 : d.object === "elephant" ? 36 : 22,
        h: d.object === "human" ? 38 : d.object === "elephant" ? 46 : 30,
      },
    }));
    setDetectionBoxes(boxes);
    const hasHuman = dets.some(d => d.object === "human");
    if (hasHuman) {
      setHumanDetected(true);
      setTimeout(() => setHumanDetected(false), 7000);
    } else {
      setHumanDetected(false);
    }
    setLastDetection({ label: dets[0].object, ts: new Date().toISOString() });
    setFrameCount(c => c + 1);

    try {
      await postFn({
        data: {
          camera_id: selectedId,
          detections: dets,
          battery: Math.max(5, Math.round((camStatus?.battery ?? 75) - batteryDrain.current)),
          battery_source: "simulated",
          timestamp: new Date().toISOString(),
          source: "simulated",
        },
      });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    } catch { /* tolerate */ }
  }, [selectedId, camStatus, postFn, qc]);

  // Start/stop camera connection
  const connect = useCallback(() => {
    if (demoMode) {
      setConnStatus("live");
      setImgError(false);
      // Pick SVG background for demo
      const svgIdx = CAMERA_OPTIONS.findIndex(c => c.id === selectedId) % FEED_SVGS.length;
      setImgSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(FEED_SVGS[svgIdx])}`);
    } else {
      setConnStatus("connecting");
      setImgError(false);
      const url = `http://${phoneIp}/shot.jpg?t=${Date.now()}`;
      setImgSrc(url);
      setTimeout(() => {
        if (!imgError) setConnStatus("live");
      }, 2000);
    }
  }, [demoMode, phoneIp, selectedId, imgError]);

  const disconnect = useCallback(() => {
    setConnStatus("disconnected");
    setDetectionBoxes([]);
    setHumanDetected(false);
    setFrameCount(0);
    setLatency(null);
    if (frameTimer.current) { clearInterval(frameTimer.current); frameTimer.current = null; }
    if (demoTimer.current) { clearInterval(demoTimer.current); demoTimer.current = null; }
  }, []);

  // Manage timers based on connStatus
  useEffect(() => {
    if (connStatus !== "live") {
      if (frameTimer.current) { clearInterval(frameTimer.current); frameTimer.current = null; }
      if (demoTimer.current) { clearInterval(demoTimer.current); demoTimer.current = null; }
      return;
    }
    if (demoMode) {
      demoTimer.current = setInterval(runDemo, 4000);
      return () => { if (demoTimer.current) clearInterval(demoTimer.current); };
    } else {
      frameTimer.current = setInterval(refreshFrame, 2000);
      return () => { if (frameTimer.current) clearInterval(frameTimer.current); };
    }
  }, [connStatus, demoMode, refreshFrame, runDemo]);

  // Reset on camera change
  useEffect(() => {
    disconnect();
    batteryDrain.current = 0;
  }, [selectedId, disconnect]);

  const connBadge =
    connStatus === "live"        ? "border-primary/50 bg-primary/15 text-primary"  :
    connStatus === "connecting"  ? "border-warning/50 bg-warning/15 text-warning"  :
    connStatus === "error"       ? "border-critical/50 bg-critical/15 text-critical-foreground" :
    "border-border bg-secondary text-muted-foreground";

  const svgIdx = CAMERA_OPTIONS.findIndex(c => c.id === selectedId) % FEED_SVGS.length;

  return (
    <div className="space-y-4">
      {/* ── Connection Panel ── */}
      <div className="panel p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">Android Camera Connection</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Connect any Android phone running IP Webcam app as a real edge AI camera
            </p>
          </div>
          <div className={`text-[10px] uppercase font-mono px-2.5 py-1 rounded border flex items-center gap-2 ${connBadge}`}>
            {connStatus === "live" && <span className="pulse-dot" />}
            {connStatus === "connecting" && <span className="inline-block w-2 h-2 rounded-full bg-warning animate-pulse" />}
            {connStatus === "disconnected" && <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />}
            {connStatus === "error" && <span className="pulse-dot pulse-critical" />}
            {connStatus.toUpperCase()}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* Camera selector */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Camera Node</label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={connStatus !== "disconnected"}
              className="mt-1 w-full bg-input border border-border rounded-md h-10 px-3 text-sm disabled:opacity-50"
            >
              {CAMERA_OPTIONS.map(c => (
                <option key={c.id} value={c.id}>{c.id} · {c.name}</option>
              ))}
            </select>
          </div>

          {/* Phone IP */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Phone IP Address {demoMode && <span className="text-muted-foreground/60">(demo: not used)</span>}
            </label>
            <input
              type="text"
              value={phoneIp}
              onChange={e => setPhoneIp(e.target.value)}
              disabled={demoMode || connStatus !== "disconnected"}
              placeholder="192.168.1.105:8080"
              className="mt-1 w-full bg-input border border-border rounded-md h-10 px-3 text-sm font-mono disabled:opacity-40"
            />
          </div>

          {/* Controls */}
          <div className="flex items-end gap-2">
            {connStatus === "disconnected" || connStatus === "error" ? (
              <button
                onClick={connect}
                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Connect Camera
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="flex-1 h-10 rounded-md border border-critical/40 bg-critical/10 text-sm hover:bg-critical/20"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Demo mode toggle */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div>
            <div className="text-sm font-medium">Demo mode</div>
            <div className="text-[11px] text-muted-foreground">No phone needed — simulates realistic AI detections and posts to the backend</div>
          </div>
          <button
            onClick={() => { disconnect(); setDemoMode(d => !d); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border ${
              demoMode ? "bg-primary/20 border-primary/40" : "bg-secondary border-border"
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-primary transition-transform ${demoMode ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* IP Webcam instructions (shown when not demo) */}
        {!demoMode && (
          <div className="mt-3 rounded-md border border-border bg-secondary/40 p-3 text-[11px] text-muted-foreground font-mono space-y-1">
            <div className="text-foreground font-semibold mb-1.5">IP Webcam setup (Android):</div>
            <div>1. Install "IP Webcam" from Play Store (by Pavel Khlebovich)</div>
            <div>2. Open app → scroll down → tap <span className="text-primary">"Start server"</span></div>
            <div>3. Note the IP shown, e.g. <span className="text-primary">192.168.1.105:8080</span></div>
            <div>4. Enter it above — both devices must be on the same WiFi</div>
            <div>5. For YOLOv8 inference, also run the Python agent on your laptop:</div>
            <div className="mt-1 bg-panel/60 border border-border rounded p-2">
              PHONE_URL=http://{phoneIp}/shot.jpg CAMERA_ID={selectedId} python android-agent/camera_agent.py
            </div>
          </div>
        )}
      </div>

      {/* ── Main Feed + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Live Feed */}
        <div className="lg:col-span-3">
          <div className="panel overflow-hidden">
            {/* Feed header */}
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-panel/60">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">{selectedId.toUpperCase()}</span>
                <span className="text-[11px] font-mono text-muted-foreground">·</span>
                <span className="text-[11px] font-mono">{selected.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {connStatus === "live" && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary flex items-center gap-1.5">
                    <span className="pulse-dot w-1.5 h-1.5" />
                    LIVE · EDGE AI
                  </span>
                )}
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${selected.restricted ? "border-critical/40 bg-critical/10 text-critical-foreground" : "border-primary/30 bg-primary/10 text-primary"}`}>
                  {selected.restricted ? "RESTRICTED" : "OPEN ZONE"}
                </span>
              </div>
            </div>

            {/* Video area */}
            <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
              {/* Human detection banner */}
              {humanDetected && (
                <div className="absolute top-0 left-0 right-0 z-20 bg-critical/90 text-critical-foreground text-sm font-bold text-center py-2 flex items-center justify-center gap-2 animate-pulse">
                  <span>⚠</span>
                  <span>HUMAN DETECTED — {selected.zone}</span>
                  <span>⚠</span>
                </div>
              )}

              {/* Frame */}
              {connStatus === "live" ? (
                <div className="relative w-full h-full">
                  {demoMode ? (
                    // Demo: SVG background
                    <div
                      className="w-full h-full scanline"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(FEED_SVGS[svgIdx])}")`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                  ) : (
                    // Real: img from phone
                    <img
                      src={imgSrc}
                      alt="Live camera feed"
                      className="w-full h-full object-cover scanline"
                      onError={() => { setImgError(true); setConnStatus("error"); }}
                      onLoad={() => { setImgError(false); if (connStatus !== "live") setConnStatus("live"); }}
                    />
                  )}

                  {/* Detection boxes overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    {detectionBoxes.map((d, i) => {
                      const isHuman = d.object === "human";
                      return (
                        <div
                          key={i}
                          className="absolute border-2 transition-all duration-500"
                          style={{
                            left: `${d.box.x}%`,
                            top: `${d.box.y}%`,
                            width: `${d.box.w}%`,
                            height: `${d.box.h}%`,
                            borderColor: isHuman ? "var(--color-critical)" : "var(--color-primary)",
                            boxShadow: isHuman
                              ? "0 0 12px color-mix(in oklab, var(--critical) 60%, transparent)"
                              : "0 0 8px color-mix(in oklab, var(--primary) 50%, transparent)",
                          }}
                        >
                          <div
                            className="absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap"
                            style={{
                              background: isHuman ? "var(--color-critical)" : "var(--color-primary)",
                              color: isHuman ? "var(--color-critical-foreground)" : "var(--color-primary-foreground)",
                            }}
                          >
                            {d.object} {Math.round(d.confidence * 100)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Corner overlays */}
                  <div className="absolute bottom-2 left-2 text-[10px] font-mono text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
                    {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
                  </div>
                  <div className="absolute bottom-2 right-2 text-[10px] font-mono text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
                    {demoMode ? "DEMO" : `FRAME #${frameCount}`}
                    {latency != null && !demoMode && ` · ${latency}ms`}
                  </div>
                  <div className="absolute top-2 left-2 text-[10px] font-mono text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
                    {selected.id.toUpperCase()}
                  </div>
                </div>
              ) : (
                // Disconnected placeholder
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <svg viewBox="0 0 24 24" className="size-10 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M15 10l4.553-2.069A1 1 0 0121 8.882V15.12a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  <div className="text-sm">
                    {connStatus === "error" ? (
                      <span className="text-critical-foreground">Cannot reach camera · Check IP and WiFi</span>
                    ) : connStatus === "connecting" ? (
                      "Connecting to camera…"
                    ) : (
                      "Camera disconnected · Click Connect to start"
                    )}
                  </div>
                  {connStatus === "error" && (
                    <div className="text-[11px] font-mono text-muted-foreground text-center max-w-xs">
                      Tried: http://{phoneIp}/shot.jpg<br />
                      Make sure IP Webcam is running and both devices are on the same WiFi
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Detection log below feed */}
            {connStatus === "live" && detectionBoxes.length > 0 && (
              <div className="px-3 py-2 border-t border-border bg-panel/40 flex flex-wrap gap-2 items-center">
                <span className="text-[11px] text-muted-foreground font-mono">Latest frame:</span>
                {detectionBoxes.map((d, i) => (
                  <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    d.object === "human"
                      ? "border-critical/40 bg-critical/10 text-critical-foreground"
                      : "border-primary/30 bg-primary/10 text-primary"
                  }`}>
                    {d.object} · {Math.round(d.confidence * 100)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar stats */}
        <div className="space-y-3">
          {/* Camera Stats */}
          <div className="panel p-4 space-y-3">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">Camera Stats</h3>

            <div>
              <div className="text-[11px] text-muted-foreground">Battery</div>
              <BatteryBar pct={camStatus?.battery ?? 75} />
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${batterySourceChip(camStatus?.batterySource).className}`}>
                  {batterySourceChip(camStatus?.batterySource).label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {batterySourceText(camStatus?.batterySource)}
                </span>
              </div>
              {camStatus?.batterySource === "fallback" && (
                <div className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-[10px] font-mono text-warning">
                  Battery endpoint not reachable. Showing fallback value from agent.
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground">Zone</div>
              <div className={`mt-0.5 text-[11px] font-mono px-1.5 py-0.5 rounded border inline-block ${
                selected.restricted
                  ? "border-critical/40 bg-critical/10 text-critical-foreground"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}>
                {selected.restricted ? "⚠ RESTRICTED" : "✓ OPEN ZONE"}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground">Status</div>
              <div className={`mt-0.5 text-[11px] font-mono flex items-center gap-1.5 ${camStatus?.online ? "text-primary" : "text-muted-foreground"}`}>
                <span className={`pulse-dot ${!camStatus?.online ? "bg-muted-foreground" : ""}`} style={{ width: 8, height: 8 }} />
                {camStatus?.online ? "ONLINE" : "OFFLINE"}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground">Total Detections</div>
              <div className="text-2xl font-semibold tabular-nums mt-0.5">{camStatus?.totalDetections ?? 0}</div>
            </div>

            {(camStatus?.activityBoost ?? 0) > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-[11px] font-mono text-warning">
                ↑ ADAPTIVE +{camStatus?.activityBoost}
                <div className="text-[10px] text-muted-foreground mt-0.5">Boost from nearby event</div>
              </div>
            )}

            {lastDetection && (
              <div>
                <div className="text-[11px] text-muted-foreground">Last Detection</div>
                <div className="text-sm font-medium mt-0.5 capitalize">{lastDetection.label}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{formatAgo(lastDetection.ts)}</div>
              </div>
            )}

            {latency != null && !demoMode && (
              <div>
                <div className="text-[11px] text-muted-foreground">Frame Latency</div>
                <div className="text-sm font-mono tabular-nums mt-0.5">{latency} ms</div>
              </div>
            )}
          </div>

          {/* Recent alerts for this camera */}
          <div className="panel">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">Camera Alerts</h3>
            </div>
            <ul className="divide-y divide-border">
              {recentAlerts.length === 0 ? (
                <li className="px-4 py-3 text-[11px] text-muted-foreground">No active alerts</li>
              ) : recentAlerts.map(a => (
                <li key={a.id} className="px-4 py-2.5">
                  <div className={`text-[10px] font-mono uppercase ${a.level === "critical" ? "text-critical-foreground" : a.level === "warning" ? "text-warning" : "text-primary"}`}>
                    {a.level}
                  </div>
                  <div className="text-[11px] mt-0.5">{a.message}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatAgo(a.timestamp)}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* Data source indicator */}
          <div className="panel p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Data Source</div>
            <div className={`text-[11px] font-mono px-2 py-1.5 rounded border ${
              demoMode
                ? "border-warning/30 bg-warning/10 text-warning"
                : connStatus === "live"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
            }`}>
              {demoMode
                ? "🔵 Browser simulator"
                : connStatus === "live"
                  ? "🟢 Android IP Webcam + Python agent"
                  : "⚫ No connection"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              {demoMode
                ? "Running built-in simulator. Switch off demo mode and connect a phone for real YOLOv8 inference."
                : "Real frames from Android phone. Python agent runs YOLOv8 inference and posts JSON to backend."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
