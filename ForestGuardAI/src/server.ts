import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { ingestCameraData } from "./lib/forest-store.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// ── Camera Data API ───────────────────────────────────────────────────────────
// Intercept POST /api/camera-data before TanStack router touches it.
// This is needed because createAPIFileRoute doesn't work in Cloudflare Worker mode.
const CAMERA_SECRET = (typeof process !== "undefined" && process.env?.CAMERA_SECRET)
  ? process.env.CAMERA_SECRET
  : "forestguard-dev-secret";

async function handleCameraData(request: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-camera-secret",
      },
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = request.headers.get("x-camera-secret");
  if (secret !== CAMERA_SECRET) {
    console.warn("[/api/camera-data] Unauthorized — bad secret:", secret);
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    camera_id: string;
    detections: { object: string; confidence: number; box?: { x: number; y: number; w: number; h: number } }[];
    battery: number;
    battery_source?: "phone" | "fallback" | "simulated" | "unknown";
    timestamp?: string;
    source?: "real" | "simulated";
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.camera_id || !Array.isArray(body.detections)) {
    return json({ error: "Missing camera_id or detections" }, 400);
  }

  try {
    const result = ingestCameraData({ ...body, source: body.source ?? "real" });
    console.log(`[/api/camera-data] cam=${body.camera_id} dets=${body.detections.length} result=${JSON.stringify(result)}`);
    return json(result);
  } catch (err) {
    console.error("[/api/camera-data] ingestCameraData error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}

// ── Events API ────────────────────────────────────────────────────────────────
// GET /api/events?camera_id=cam_01&limit=1
async function handleEvents(request: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(request.url);
  const cameraId = url.searchParams.get("camera_id");
  const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);

  // Lazy import to avoid circular deps
  const { getStore } = await import("./lib/forest-store.server");
  const s = getStore();
  let events = s.events;
  if (cameraId) events = events.filter(e => e.cameraId === cameraId);
  return json(events.slice(0, limit));
}

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

async function listCapturedImages(root: string): Promise<CapturedImage[]> {
  const [{ readdir, stat }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
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

  return images.sort((a, b) => new Date(b.capturedAt ?? 0).getTime() - new Date(a.capturedAt ?? 0).getTime());
}

async function handleCapturedImages(request: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const root = await getCapturedImagesRoot();
  if (!root) return json({ root: null, images: [] });

  try {
    const images = await listCapturedImages(root);
    return json({ root, images });
  } catch (err) {
    console.error("[/api/captured-images] error:", err);
    return json({ error: "Unable to read captured images", images: [] }, 500);
  }
}

async function handleCapturedImageFile(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [{ readFile, stat }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const root = await getCapturedImagesRoot();
  if (!root) return new Response("Captured images folder not found", { status: 404 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing image id", { status: 400 });

  const [species, filename] = decodeURIComponent(id).split("/");
  if (!species || !filename || species.includes("..") || filename.includes("..")) {
    return new Response("Invalid image id", { status: 400 });
  }

  const filePath = path.resolve(root, species, filename);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!filePath.startsWith(rootWithSep)) {
    return new Response("Invalid image path", { status: 400 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const bytes = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // Intercept API routes before TanStack router
    if (url.pathname === "/api/camera-data") {
      return handleCameraData(request);
    }
    if (url.pathname === "/api/events") {
      return handleEvents(request);
    }
    if (url.pathname === "/api/captured-images") {
      return handleCapturedImages(request);
    }
    if (url.pathname === "/api/captured-images/file") {
      return handleCapturedImageFile(request);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
