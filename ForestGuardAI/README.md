# ForestGuard AI — Wildlife Command Dashboard

AI-powered wildlife monitoring dashboard for Nepal's conservation areas.
Built for the eSewa × WWF Hackathon 2026.

---

## Stack

- **Frontend + Backend**: TanStack Start (React + server functions), running via Cloudflare Worker mode
- **AI Inference**: YOLOv8n (via `ultralytics` Python package)
- **Camera Agent**: Python script that grabs frames from an Android phone and runs YOLO
- **Camera App**: IP Webcam (Android) by Pavel Khlebovich

---

## Running the Dashboard

```bash
npm install
npm run dev
```

Dashboard opens at **http://localhost:3000**

---

## Running the Camera Agent (Real Detection)

### 1. Set up IP Webcam on Android

1. Install **IP Webcam** from Play Store (by Pavel Khlebovich)
2. Open the app → scroll to bottom → tap **Start server**
3. Note the IP shown, e.g. `192.168.1.105:8080`
4. Open `http://192.168.1.105:8080/shot.jpg` in your PC browser to verify it shows a photo
5. Both phone and PC must be on the **same WiFi**

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

`requirements.txt` includes `ultralytics`, `opencv-python`, `requests`, `numpy`.

### 3. Run the agent

```bash
# Replace with your phone's IP
PHONE_URL=http://192.168.1.105:8080/shot.jpg \
SERVER_URL=http://localhost:3000/api/camera-data \
CAMERA_ID=cam_01 \
python camera_agent.py
```

**Windows (PowerShell):**
```powershell
$env:PHONE_URL="http://192.168.1.105:8080/shot.jpg"
$env:SERVER_URL="http://localhost:3000/api/camera-data"
$env:CAMERA_ID="cam_01"
python camera_agent.py
```

### 4. What you should see in the terminal

```
[agent] Loading YOLOv8n...
[agent] Model loaded.
[agent] Starting. Posting every 4s...

[yolo] Raw detections (1):
       person: 71% conf
[agent] ✓ Detected: human (71%) | battery: 84%
[agent]   → Accepted: event_id=evt_abc123
```

The Live Feed page will show a red bounding box with **HUMAN DETECTED** banner.

---

## Running in Demo Mode (No Phone Needed)

```bash
DEMO_MODE=true CAMERA_ID=cam_01 python camera_agent.py
```

Or toggle **Demo Mode** on in the Live Feed page in the browser — this uses
a browser-side simulator (no Python agent needed).

---

## Multiple Cameras

Open a separate terminal for each camera:

```bash
# Terminal 1
PHONE_URL=http://192.168.1.105:8080/shot.jpg CAMERA_ID=cam_01 python camera_agent.py

# Terminal 2 (another phone)
PHONE_URL=http://192.168.1.106:8080/shot.jpg CAMERA_ID=cam_02 python camera_agent.py

# Terminal 3 (demo)
DEMO_MODE=true CAMERA_ID=cam_03 python camera_agent.py
```

---

## Environment Variables (camera_agent.py)

| Variable | Default | Description |
|---|---|---|
| `PHONE_URL` | `http://192.168.1.105:8080/shot.jpg` | IP Webcam snapshot URL — must be `/shot.jpg` not `/video` |
| `SERVER_URL` | `http://localhost:3000/api/camera-data` | Backend API endpoint |
| `CAMERA_ID` | `cam_01` | Must be `cam_01` through `cam_06` |
| `CAMERA_SECRET` | `forestguard-dev-secret` | Auth secret — must match server |
| `POLL_INTERVAL` | `4` | Seconds between frames |
| `CONFIDENCE_MIN` | `0.35` | Minimum YOLO confidence (0.0–1.0) |
| `DEMO_MODE` | `false` | Set to `true` to run without a phone |

---

## Detected Species

YOLOv8 is trained on COCO classes. ForestGuard maps them to wildlife:

| COCO class | ForestGuard label |
|---|---|
| person | human ⚠ (triggers alert) |
| bird | peacock |
| elephant | elephant |
| bear | sloth_bear |
| deer | deer |
| cow | wild_boar |
| horse | deer |

All other classes (cat, dog, car, etc.) are ignored.
To add a class, edit `COCO_TO_FOREST` in `camera_agent.py`.

---

## Key Files

| File | Purpose |
|---|---|
| `src/server.ts` | Cloudflare Worker entry — intercepts `/api/camera-data` and `/api/events` |
| `src/lib/forest-store.server.ts` | In-memory store — cameras, events, alerts (resets on restart) |
| `src/lib/forest.functions.ts` | TanStack server functions for frontend queries |
| `src/routes/live-camera.tsx` | Live Feed page |
| `src/routes/api/camera-data.ts` | API route file (not used in Worker mode — handled by server.ts) |
| `camera_agent.py` | Python agent — grabs frames, runs YOLOv8, POSTs to backend |

---

## Known Limitations

- **Store is in-memory** — all detection history resets when the dev server restarts
- **`/api/camera-data` route** uses `server.ts` interception, not `createAPIFileRoute`, because Cloudflare Worker mode doesn't support TanStack API file routes
- **Camera Grid** shows live data only — no historical persistence across restarts
- **YOLOv8n** (nano model) has lower accuracy than larger models; confidence scores for humans indoors are often 40–70%