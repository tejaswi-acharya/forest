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