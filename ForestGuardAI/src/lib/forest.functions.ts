import { createServerFn } from "@tanstack/react-start";
import {
  getStore,
  ingestCameraData,
  verifyReport,
  reviewReportDecision,
  checkOfflineCameras,
  type Detection,
} from "./forest-store.server";

type CapturedImage = {
  id: string;
  species: string;
  filename: string;
  url: string;
  capturedAt?: string;
  confidence?: number;
};

async function getCapturedImagesRoot(): Promise<string | null> {
  const [{ stat }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const configured = typeof process !== "undefined" ? process.env?.CAPTURED_IMAGES_DIR : undefined;
  const candidates = [
    configured,
    path.resolve(process.cwd(), "../android-agent/images_captured"),
    path.resolve(process.cwd(), "android-agent/images_captured"),
    path.resolve(process.cwd(), "../images_captured"),
    path.resolve(process.cwd(), "../../android-agent/images_captured"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) return path.resolve(candidate);
    } catch {
      // Try the next likely local project layout.
    }
  }
  return null;
}

function parseCapturedImageMeta(filename: string): Pick<CapturedImage, "capturedAt" | "confidence"> {
  const match = filename.match(/_(\d{8})_(\d{6})_(\d{3})_conf(\d+)\.(?:jpe?g|png|webp)$/i);
  if (!match) return {};
  const [, date, time, millis, conf] = match;
  const capturedAt = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8)),
    Number(time.slice(0, 2)),
    Number(time.slice(2, 4)),
    Number(time.slice(4, 6)),
    Number(millis),
  ).toISOString();
  return { capturedAt, confidence: Number(conf) };
}

export const getCapturedImages = createServerFn({ method: "GET" }).handler(async () => {
  const [{ readdir, stat }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const root = await getCapturedImagesRoot();
  if (!root) return { root: null as string | null, images: [] as CapturedImage[] };

  const speciesDirs = await readdir(root, { withFileTypes: true });
  const images: CapturedImage[] = [];

  for (const dir of speciesDirs) {
    if (!dir.isDirectory()) continue;
    const species = dir.name;
    const dirPath = path.join(root, species);
    const files = await readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !/\.(jpe?g|png|webp)$/i.test(file.name)) continue;
      const filePath = path.join(dirPath, file.name);
      const info = await stat(filePath);
      const id = encodeURIComponent(`${species}/${file.name}`);
      const meta = parseCapturedImageMeta(file.name);
      images.push({
        id,
        species,
        filename: file.name,
        url: `/api/captured-images/file?id=${id}`,
        capturedAt: meta.capturedAt ?? info.mtime.toISOString(),
        confidence: meta.confidence,
      });
    }
  }

  return {
    root,
    images: images.sort((a, b) => new Date(b.capturedAt ?? 0).getTime() - new Date(a.capturedAt ?? 0).getTime()),
  };
});

export const postCameraData = createServerFn({ method: "POST" })
  .inputValidator((d: {
    camera_id: string;
    detections: Detection[];
    battery: number;
    battery_source?: "phone" | "fallback" | "simulated" | "unknown";
    timestamp?: string;
    source?: "real" | "simulated";
  }) => d)
  .handler(async ({ data }) => ingestCameraData(data));

export const postCommunityReport = createServerFn({ method: "POST" })
  .inputValidator((d: {
    userId: string; userName: string; species: string;
    description: string; location: string; hasImage: boolean;
    imageDataUrl?: string;
    imageName?: string;
    imageMimeType?: string;
  }) => d)
  .handler(async ({ data }) => await verifyReport(data));

export const reviewCommunityReport = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; decision: "approve" | "reject"; officialName?: string }) => d)
  .handler(async ({ data }) => reviewReportDecision(data));

export const getDashboardSummary = createServerFn({ method: "GET" }).handler(async () => {
  checkOfflineCameras();
  const s = getStore();
  const cams = Array.from(s.cameras.values());
  const last24 = Date.now() - 1000 * 60 * 60 * 24;
  const recentEvents = s.events.filter(e => new Date(e.timestamp).getTime() > last24);
  const speciesCount: Record<string, number> = {};
  for (const e of recentEvents) for (const d of e.detections) {
    if (d.object === "human") continue;
    speciesCount[d.object] = (speciesCount[d.object] ?? 0) + 1;
  }
  const zoneActivity: Record<string, number> = {};
  for (const e of recentEvents) zoneActivity[e.zone] = (zoneActivity[e.zone] ?? 0) + 1;
  return {
    cameras: { total: cams.length, online: cams.filter(c => c.online).length, lowBattery: cams.filter(c => c.battery < 30).length },
    alerts: { total: s.alerts.filter(a => !a.resolved).length, critical: s.alerts.filter(a => !a.resolved && a.level === "critical").length },
    events24h: recentEvents.length,
    intrusions24h: recentEvents.filter(e => e.detections.some(d => d.object === "human")).length,
    speciesCount,
    zoneActivity,
    reports: { total: s.reports.length, pending: s.reports.filter(r => r.reviewStatus === "pending").length, approved: s.reports.filter(r => r.reviewStatus === "approved").length },
    realEventCount: s.realEventCount,
    simEventCount: s.simEventCount,
  };
});

export const getCameras = createServerFn({ method: "GET" }).handler(async () => {
  checkOfflineCameras();
  return Array.from(getStore().cameras.values());
});

export const getAlerts = createServerFn({ method: "GET" }).handler(async () => {
  return getStore().alerts.slice(0, 50);
});

export const getRecentEvents = createServerFn({ method: "GET" }).handler(async () => {
  return getStore().events.slice(0, 30);
});

export const getCommunity = createServerFn({ method: "GET" }).handler(async () => {
  const s = getStore();
  return {
    pending: s.reports.filter(r => r.reviewStatus === "pending"),
    reviewed: s.reports.filter(r => r.reviewStatus !== "pending").slice(0, 30),
    leaderboard: Array.from(s.users.values()).sort((a, b) => b.points - a.points),
  };
});

export const getCitizenView = createServerFn({ method: "GET" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const s = getStore();
    const user = s.users.get(data.userId);
    const myReports = s.reports.filter(r => r.userId === data.userId).slice(0, 30);
    const leaderboard = Array.from(s.users.values()).sort((a, b) => b.points - a.points);
    const rank = leaderboard.findIndex(u => u.id === data.userId) + 1 || null;
    return { user: user ?? null, reports: myReports, leaderboard: leaderboard.slice(0, 5), rank };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const s = getStore();
    const a = s.alerts.find(x => x.id === data.id);
    if (a && !a.resolved) { a.resolved = true; a.resolvedAt = new Date().toISOString(); }
    return { ok: true };
  });

// Returns the most recent event for a specific camera (for live feed overlay)
export const getLatestCameraEvent = createServerFn({ method: "GET" })
  .inputValidator((d: { cameraId: string }) => d)
  .handler(async ({ data }) => {
    const s = getStore();
    const ev = s.events.find(e => e.cameraId === data.cameraId);
    return ev ?? null;
  });
