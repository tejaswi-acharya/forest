// src/routes/api/events.ts
// Public GET endpoint returning latest detection events.
// Used by the live camera feed component to poll for overlay data.

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getStore } from "@/lib/forest-store.server";

export const APIRoute = createAPIFileRoute("/api/events")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "30", 10));
    const cameraId = url.searchParams.get("camera_id");
    const s = getStore();
    let events = s.events.slice(0, limit);
    if (cameraId) events = events.filter(e => e.cameraId === cameraId).slice(0, 10);
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
