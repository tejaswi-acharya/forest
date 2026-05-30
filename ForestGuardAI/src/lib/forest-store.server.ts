// In-memory "backend brain" — module singleton on the server.
// Persists for the lifetime of the server process (resets on dev reload).

export type Detection = { object: string; confidence: number };

export type CameraStatus = {
  id: string;
  name: string;
  zone: string;
  restricted: boolean;
  lat: number;
  lng: number;
  battery: number;
  online: boolean;
  lastSeen: string;
  totalDetections: number;
  activityBoost: number;
  source: "real" | "simulated" | "none"; // tracks latest data source
  batterySource: "phone" | "fallback" | "simulated" | "unknown" | "none";
};

export type DetectionEvent = {
  id: string;
  cameraId: string;
  zone: string;
  timestamp: string;
  detections: Detection[];
  battery: number;
  anomaly: boolean;
  source: "real" | "simulated"; // real = from Android agent, simulated = browser
};

export type Alert = {
  id: string;
  level: "critical" | "warning" | "info";
  type: "human_intrusion" | "anomaly" | "wildlife" | "camera_offline";
  cameraId?: string;
  zone?: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
};

export type CommunityReport = {
  id: string;
  userId: string;
  userName: string;
  species: string;
  description: string;
  location: string;
  hasImage: boolean;
  timestamp: string;
  confidenceScore: number;
  status: "likely_real" | "uncertain" | "likely_fake";
  aiSuggestion: "approve" | "reject";
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  pointsAwarded: number;
};

export type CommunityUser = {
  id: string;
  name: string;
  points: number;
  reportsCount: number;
  trustScore: number;
};

type Store = {
  cameras: Map<string, CameraStatus>;
  events: DetectionEvent[];
  alerts: Alert[];
  reports: CommunityReport[];
  users: Map<string, CommunityUser>;
  recent: Map<string, number>;
  realEventCount: number;   // events from real cameras
  simEventCount: number;    // events from simulator
};

const g = globalThis as unknown as { __forestStore?: Store };

function seed(): Store {
  const cameras: CameraStatus[] = [
    { id: "cam_01", name: "Chitwan Buffer · North Gate",  zone: "Zone A (Restricted)", restricted: true,  lat: 27.53, lng: 84.45, battery: 82, online: true,  lastSeen: new Date().toISOString(), totalDetections: 0, activityBoost: 0, source: "none", batterySource: "none" },
    { id: "cam_02", name: "Sauraha River Bend",           zone: "Zone B",              restricted: false, lat: 27.58, lng: 84.49, battery: 67, online: true,  lastSeen: new Date().toISOString(), totalDetections: 0, activityBoost: 0, source: "none", batterySource: "none" },
    { id: "cam_03", name: "Bardia Tiger Corridor",        zone: "Zone C (Restricted)", restricted: true,  lat: 28.38, lng: 81.50, battery: 91, online: true,  lastSeen: new Date().toISOString(), totalDetections: 0, activityBoost: 0, source: "none", batterySource: "none" },
    { id: "cam_04", name: "Karnali Watch Post",           zone: "Zone C",              restricted: false, lat: 28.42, lng: 81.48, battery: 54, online: true,  lastSeen: new Date().toISOString(), totalDetections: 0, activityBoost: 0, source: "none", batterySource: "none" },
    { id: "cam_05", name: "Shuklaphanta Grasslands",      zone: "Zone D",              restricted: false, lat: 28.85, lng: 80.22, battery: 38, online: true,  lastSeen: new Date().toISOString(), totalDetections: 0, activityBoost: 0, source: "none", batterySource: "none" },
    { id: "cam_06", name: "Langtang Ridge Trail",         zone: "Zone E (Restricted)", restricted: true,  lat: 28.21, lng: 85.55, battery: 12, online: false, lastSeen: new Date(Date.now() - 1000 * 60 * 47).toISOString(), totalDetections: 0, activityBoost: 0, source: "none", batterySource: "none" },
  ];

  const users: CommunityUser[] = [
    { id: "u_ram",    name: "Ram Bahadur Tamang", points: 240, reportsCount: 18, trustScore: 88 },
    { id: "u_sita",   name: "Sita Chaudhary",     points: 175, reportsCount: 12, trustScore: 81 },
    { id: "u_min",    name: "Min Gurung",          points: 95,  reportsCount: 9,  trustScore: 64 },
    { id: "u_anjali", name: "Anjali Magar",        points: 60,  reportsCount: 5,  trustScore: 70 },
  ];

  const reports: CommunityReport[] = [
    { id: "r_001", userId: "u_ram",    userName: "Ram Bahadur Tamang", species: "Bengal Tiger",         description: "Pugmarks near eastern fence line, fresh.", location: "Bardia · Sector 4", hasImage: true,  timestamp: new Date(Date.now() - 1000*60*22).toISOString(),  confidenceScore: 86, status: "likely_real", aiSuggestion: "approve", reviewStatus: "approved", reviewedBy: "Officer Thapa", reviewedAt: new Date(Date.now()-1000*60*18).toISOString(), pointsAwarded: 10 },
    { id: "r_002", userId: "u_sita",   userName: "Sita Chaudhary",     species: "Asian Elephant Herd",  description: "Herd of ~6 crossing into farmland.",      location: "Sauraha · Buffer",  hasImage: false, timestamp: new Date(Date.now() - 1000*60*65).toISOString(),  confidenceScore: 78, status: "likely_real", aiSuggestion: "approve", reviewStatus: "approved", reviewedBy: "Officer Thapa", reviewedAt: new Date(Date.now()-1000*60*60).toISOString(), pointsAwarded: 10 },
    { id: "r_003", userId: "u_min",    userName: "Min Gurung",          species: "Snow Leopard",         description: "Sighted on ridge.",                       location: "Langtang",          hasImage: false, timestamp: new Date(Date.now() - 1000*60*180).toISOString(), confidenceScore: 31, status: "likely_fake", aiSuggestion: "reject",  reviewStatus: "rejected", reviewedBy: "Officer Rai",   reviewedAt: new Date(Date.now()-1000*60*170).toISOString(), pointsAwarded: -5 },
    { id: "r_004", userId: "u_anjali", userName: "Anjali Magar",        species: "Bengal Tiger",         description: "i saw a tiger going towards neighbours house", location: "Chitwan · Buffer N", hasImage: true, timestamp: new Date(Date.now() - 1000*60*8).toISOString(), confidenceScore: 84, status: "likely_real", aiSuggestion: "approve", reviewStatus: "pending", pointsAwarded: 0 },
    { id: "r_005", userId: "u_min",    userName: "Min Gurung",          species: "Tiger",                description: "Heard roar last night.",                  location: "Langtang Ridge",    hasImage: false, timestamp: new Date(Date.now() - 1000*60*14).toISOString(), confidenceScore: 38, status: "likely_fake", aiSuggestion: "reject",  reviewStatus: "pending", pointsAwarded: 0 },
  ];

  const alerts: Alert[] = [
    { id: "a_seed_1", level: "warning", type: "camera_offline", cameraId: "cam_06", zone: "Zone E (Restricted)", message: "Camera cam_06 offline for 47m · battery 12%", timestamp: new Date(Date.now() - 1000*60*47).toISOString(), resolved: false },
  ];

  return {
    cameras: new Map(cameras.map(c => [c.id, c])),
    events: [],
    alerts,
    reports,
    users: new Map(users.map(u => [u.id, u])),
    recent: new Map(),
    realEventCount: 0,
    simEventCount: 0,
  };
}

export function getStore(): Store {
  if (!g.__forestStore) g.__forestStore = seed();
  return g.__forestStore;
}

export function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const KNOWN_ANIMALS = ["deer","wild_boar","rhesus_monkey","leopard","tiger","elephant","rhino","sloth_bear","peacock"];

export function ingestCameraData(input: {
  camera_id: string;
  timestamp?: string;
  detections: Detection[];
  battery: number;
  source?: "real" | "simulated";
  battery_source?: "phone" | "fallback" | "simulated" | "unknown";
}) {
  const s = getStore();
  const cam = s.cameras.get(input.camera_id);
  if (!cam) return { ok: false, error: "unknown_camera" as const };

  const source = input.source ?? "simulated";
  const batterySource = source === "simulated"
    ? "simulated"
    : (input.battery_source ?? "unknown");
  const ts = input.timestamp ?? new Date().toISOString();
  cam.lastSeen = ts;
  cam.online = true;
  cam.battery = Math.max(0, Math.min(100, input.battery));
  cam.source = source;
  cam.batterySource = batterySource;

  const useful = input.detections.filter(d => d.confidence >= 0.35);
  if (useful.length === 0) return { ok: true, suppressed: "no_useful_detections" as const };

  const primary = useful[0].object;
  const key = `${cam.id}:${primary}`;
  const last = s.recent.get(key) ?? 0;
  const now = new Date(ts).getTime();
  if (now - last < 12_000) return { ok: true, suppressed: "duplicate" as const };
  s.recent.set(key, now);

  cam.totalDetections += 1;
  if (source === "real") s.realEventCount += 1;
  else s.simEventCount += 1;

  const hasHuman = useful.some(d => d.object === "human");
  const distinctSpecies = new Set(useful.map(d => d.object)).size;
  const hour = new Date(ts).getUTCHours();
  const anomaly = (hasHuman && (hour < 5 || hour > 19)) || distinctSpecies >= 3;

  const ev: DetectionEvent = {
    id: rid("e"),
    cameraId: cam.id,
    zone: cam.zone,
    timestamp: ts,
    detections: useful,
    battery: cam.battery,
    anomaly,
    source,
  };
  s.events.unshift(ev);
  if (s.events.length > 200) s.events.length = 200;

  if (hasHuman || anomaly) {
    for (const other of s.cameras.values()) {
      if (other.id === cam.id) continue;
      const d = Math.hypot(other.lat - cam.lat, other.lng - cam.lng);
      if (d < 0.15) other.activityBoost = Math.min(100, other.activityBoost + 25);
    }
  }

  if (hasHuman && cam.restricted) {
    s.alerts.unshift({ id: rid("a"), level: "critical", type: "human_intrusion", cameraId: cam.id, zone: cam.zone, message: `Human intrusion detected in ${cam.zone} via ${cam.name}`, timestamp: ts, resolved: false });
  } else if (anomaly) {
    s.alerts.unshift({ id: rid("a"), level: "warning", type: "anomaly", cameraId: cam.id, zone: cam.zone, message: `Unusual activity at ${cam.name} · ${useful.map(d => d.object).join(", ")}`, timestamp: ts, resolved: false });
  } else {
    const top = useful[0];
    if (["tiger","elephant","rhino","leopard"].includes(top.object)) {
      s.alerts.unshift({ id: rid("a"), level: "info", type: "wildlife", cameraId: cam.id, zone: cam.zone, message: `${top.object.toUpperCase()} sighted at ${cam.name} (${Math.round(top.confidence * 100)}%)`, timestamp: ts, resolved: false });
    }
  }
  if (s.alerts.length > 100) s.alerts.length = 100;

  return { ok: true, event: ev };
}

export function verifyReport(input: {
  userId: string; userName: string; species: string;
  description: string; location: string; hasImage: boolean;
}): CommunityReport {
  const s = getStore();
  const user = s.users.get(input.userId) ?? { id: input.userId, name: input.userName, points: 0, reportsCount: 0, trustScore: 50 };
  let score = 40;
  if (input.hasImage) score += 25;
  if (input.description.length > 30) score += 10;
  if (KNOWN_ANIMALS.some(a => input.species.toLowerCase().includes(a))) score += 15;
  if (/snow leopard|yeti|unicorn/i.test(input.species) && !input.hasImage) score -= 25;
  score += Math.round((user.trustScore - 50) * 0.3);
  score = Math.max(0, Math.min(100, score + Math.round((Math.random() - 0.5) * 10)));
  const status: CommunityReport["status"] = score >= 70 ? "likely_real" : score >= 45 ? "uncertain" : "likely_fake";
  const aiSuggestion: CommunityReport["aiSuggestion"] = score >= 60 ? "approve" : "reject";
  user.reportsCount += 1;
  s.users.set(user.id, user);
  const report: CommunityReport = {
    id: rid("r"), userId: user.id, userName: user.name, species: input.species,
    description: input.description, location: input.location, hasImage: input.hasImage,
    timestamp: new Date().toISOString(), confidenceScore: score, status, aiSuggestion,
    reviewStatus: "pending", pointsAwarded: 0,
  };
  s.reports.unshift(report);
  if (s.reports.length > 100) s.reports.length = 100;
  return report;
}

export function reviewReportDecision(input: {
  id: string; decision: "approve" | "reject"; officialName?: string;
}): { ok: boolean; report?: CommunityReport; error?: string } {
  const s = getStore();
  const r = s.reports.find(x => x.id === input.id);
  if (!r) return { ok: false, error: "not_found" };
  if (r.reviewStatus !== "pending") return { ok: false, error: "already_reviewed" };
  const user = s.users.get(r.userId);
  if (!user) return { ok: false, error: "unknown_user" };
  if (input.decision === "approve") {
    const pts = user.trustScore > 80 ? 15 : 10;
    r.pointsAwarded = pts; r.reviewStatus = "approved";
    user.points = Math.max(0, user.points + pts);
    user.trustScore = Math.min(100, user.trustScore + 2);
  } else {
    r.pointsAwarded = -5; r.reviewStatus = "rejected";
    user.points = Math.max(0, user.points - 5);
    user.trustScore = Math.max(0, user.trustScore - 4);
  }
  r.reviewedBy = input.officialName ?? "Forest Official";
  r.reviewedAt = new Date().toISOString();
  s.users.set(user.id, user);
  return { ok: true, report: r };
}

export function checkOfflineCameras() {
  const s = getStore();
  const now = Date.now();
  for (const cam of s.cameras.values()) {
    const stale = now - new Date(cam.lastSeen).getTime() > 1000 * 60 * 5;
    if (stale && cam.online) {
      cam.online = false;
      s.alerts.unshift({ id: rid("a"), level: "warning", type: "camera_offline", cameraId: cam.id, zone: cam.zone, message: `Camera ${cam.name} went offline`, timestamp: new Date().toISOString(), resolved: false });
    }
    cam.activityBoost = Math.max(0, cam.activityBoost - 5);
  }
}