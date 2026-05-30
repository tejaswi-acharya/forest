// Client-side Edge AI simulator. Mimics on-device inference and posts only
// structured JSON to the backend (no raw video).
// Tags all events as source: "simulated" so the dashboard can distinguish
// them from real Android camera agent data.
export let simulatorEnabled = true; // flip to false to kill it
import { postCameraData } from "./forest.functions";

const CAMERAS = [
  { id: "cam_01", restricted: true,  battery: 82 },
  { id: "cam_02", restricted: false, battery: 67 },
  { id: "cam_03", restricted: true,  battery: 91 },
  { id: "cam_04", restricted: false, battery: 54 },
  { id: "cam_05", restricted: false, battery: 38 },
];

const ANIMALS = ["deer","wild_boar","rhesus_monkey","peacock","leopard","tiger","elephant","rhino"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function conf() { return Math.round((0.6 + Math.random() * 0.39) * 100) / 100; }

function simulateFrame(camId: string, restricted: boolean) {
  void camId; void restricted;
  if (Math.random() < 0.55) return null; // empty frames suppressed
  const detections: { object: string; confidence: number }[] = [];
  if (Math.random() < 0.18) detections.push({ object: "human", confidence: conf() });
  const animalCount = 1 + Math.floor(Math.random() * (Math.random() < 0.1 ? 3 : 1));
  for (let i = 0; i < animalCount; i++) detections.push({ object: pick(ANIMALS), confidence: conf() });
  return detections;
}

let timer: ReturnType<typeof setInterval> | null = null;
let batteryDrain = 0;

export function startEdgeAI(onTick?: () => void) {
  if (timer) return;
  timer = setInterval(async () => {
    batteryDrain += 0.05;
    for (const cam of CAMERAS) {
      if (Math.random() < 0.4) continue;
      const dets = simulateFrame(cam.id, cam.restricted);
      if (!dets) continue;
      try {
        await postCameraData({
          data: {
            camera_id: cam.id,
            detections: dets,
            battery: Math.max(5, Math.round(cam.battery - batteryDrain)),
            timestamp: new Date().toISOString(),
            source: "simulated",
          },
        });
      } catch { /* tolerate transient errors */ }
    }
    onTick?.();
  }, 4000);
}

export function stopEdgeAI() {
  if (timer) { clearInterval(timer); timer = null; }
}
