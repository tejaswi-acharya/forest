import { createFileRoute } from "@tanstack/react-router";
import { CameraGrid, EventsFeed } from "@/components/dashboard";
import { useState } from "react";

export const Route = createFileRoute("/cameras")({
  head: () => ({
    meta: [
      { title: "Camera Grid · ForestGuard AI" },
      { name: "description", content: "Edge AI camera nodes across Nepal's conservation zones with adaptive coordination." },
    ],
  }),
  component: CamerasPage,
});

const TABS = ["Demo Mode", "Android Phone", "Multiple Cameras"] as const;
type Tab = (typeof TABS)[number];

const CODE: Record<Tab, string> = {
  "Demo Mode": `# No phone needed — posts real JSON to your backend
cd android-agent
pip install -r requirements.txt

DEMO_MODE=true CAMERA_ID=cam_01 python camera_agent.py

# The agent will:
# → generate realistic detections every 4s
# → POST JSON to /api/camera-data (via HTTP, not browser)
# → Dashboard updates live in real time
# → Alerts fire for human detections`,

  "Android Phone": `# 1. Install "IP Webcam" from Play Store (by Pavel Khlebovich)
# 2. Open app → scroll down → tap "Start server"
# 3. Note the IP shown on screen (e.g. 192.168.1.105)
# 4. Both phone and laptop must be on the same WiFi

PHONE_URL=http://192.168.1.105:8080/shot.jpg \\
CAMERA_ID=cam_02 \\
SERVER_URL=https://your-app.workers.dev/api/camera-data \\
python android-agent/camera_agent.py

# The agent will:
# → pull JPEG frames from your phone every 4s
# → run YOLOv8n inference locally (~50ms/frame)
# → map COCO classes → ForestGuard species names
# → send only JSON to backend (no raw video ever)
# → buffer to SQLite if connectivity drops`,

  "Multiple Cameras": `# Run each in a separate terminal window
# All cameras appear on the map and grid simultaneously

# Terminal 1 — demo mode
DEMO_MODE=true CAMERA_ID=cam_01 python camera_agent.py

# Terminal 2 — real Android phone
PHONE_URL=http://192.168.1.105:8080/shot.jpg \\
CAMERA_ID=cam_02 python camera_agent.py

# Terminal 3 — second phone (different IP)
PHONE_URL=http://192.168.1.200:8080/shot.jpg \\
CAMERA_ID=cam_03 python camera_agent.py

# All 3 appear as live nodes with independent detection streams`,
};

function AgentStatusPanel() {
  const [tab, setTab] = useState<Tab>("Demo Mode");
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(CODE[tab]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">Android Agent Connection</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Run the Python agent to connect a real camera or stream realistic demo data to this dashboard
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
          <span className="pulse-dot" style={{ width: 8, height: 8 }} />
          Listening on /api/camera-data
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 h-8 rounded-md text-xs transition-colors ${
              tab === t
                ? "bg-primary/15 text-foreground border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="p-4">
        <div className="relative">
          <pre className="text-[11px] font-mono bg-[oklch(0.13_0.010_160)] border border-border rounded-md p-4 overflow-x-auto text-muted-foreground leading-relaxed whitespace-pre">
            {CODE[tab]}
          </pre>
          <button
            onClick={copyCode}
            className="absolute top-2 right-2 h-7 px-2.5 rounded border border-border bg-panel text-[11px] font-mono hover:bg-secondary transition-colors"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        {tab === "Android Phone" && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: "What the phone does", items: ["Streams JPEG over WiFi", "No AI, no code needed", "Just IP Webcam app"] },
              { title: "What the agent does", items: ["YOLOv8n inference (~50ms)", "Maps COCO → species", "Buffers if offline"] },
              { title: "What's never sent", items: ["Raw video frames", "Personal data", "Only: JSON detections"] },
            ].map(col => (
              <div key={col.title} className="rounded-md border border-border bg-secondary/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{col.title}</div>
                <ul className="space-y-1">
                  {col.items.map(item => (
                    <li key={item} className="text-[11px] flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CamerasPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Camera Network</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Offline edge AI inference · Empty frames suppressed · Adaptive boost activates neighboring cameras on important detections
        </p>
      </div>
      <AgentStatusPanel />
      <CameraGrid />
      <EventsFeed limit={30} />
    </div>
  );
}
