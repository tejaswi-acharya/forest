import { createFileRoute } from "@tanstack/react-router";
import { LiveCameraFeed } from "@/components/live-camera-feed";

export const Route = createFileRoute("/live-camera")({
  head: () => ({
    meta: [
      { title: "Live Feed · ForestGuard AI" },
      { name: "description", content: "Real-time edge AI camera feed with YOLOv8 detection overlay. Connect any Android phone via IP Webcam." },
    ],
  }),
  component: LiveCameraPage,
});

function LiveCameraPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Edge Camera</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time feed with on-device YOLOv8 detection overlay · Zero raw video transmitted
          </p>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground border border-border rounded-md px-3 py-1.5 bg-panel/60">
          EDGE AI · MobileNet / YOLOv8n
        </div>
      </div>
      <LiveCameraFeed />
    </div>
  );
}
