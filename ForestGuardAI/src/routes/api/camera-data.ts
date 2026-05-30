// src/routes/api/camera-data.ts
// This HTTP endpoint lets the Python Android camera agent POST detections
// directly without going through TanStack server functions.
// Secured by x-camera-secret header.

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { ingestCameraData } from "@/lib/forest-store.server";

const SECRET = (typeof process !== "undefined" && process.env?.CAMERA_SECRET)
  ? process.env.CAMERA_SECRET
  : "forestguard-dev-secret";

export const APIRoute = createAPIFileRoute("/api/camera-data")({
  POST: async ({ request }) => {
    const secret = request.headers.get("x-camera-secret");
    if (secret !== SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    try {
      const body = await request.json() as {
        camera_id: string;
        detections: { object: string; confidence: number }[];
        battery: number;
        battery_source?: "phone" | "fallback" | "simulated" | "unknown";
        timestamp?: string;
        source?: "real" | "simulated";
      };
      const result = ingestCameraData({ ...body, source: body.source ?? "real" });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[/api/camera-data] error:", err);
      return new Response(JSON.stringify({ error: "Bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
