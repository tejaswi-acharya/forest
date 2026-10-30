# Forest

Forest is an AI-powered wildlife monitoring and alert platform built collaboratively for the **eSewa x WWF Hackathon 2026**. The project focuses on conservation and protected-area surveillance by combining a web dashboard, a Python-based camera detection agent, and YOLO-based object recognition to monitor forest activity in real time.

The project is designed for scenarios where a field team wants to:

- Monitor live camera feeds for wildlife and human activity
- Detect incidents and suspicious movement in real time
- Visualize alerts from multiple camera sources
- Test the system in demo mode without hardware

## Project Overview

This repository contains two main components:

- `ForestGuardAI/` — a React + TanStack dashboard for live monitoring, event visualization, and camera administration.
- `android-agent/` — a Python agent that captures frames from an Android phone/IP Webcam feed and runs YOLOv8 object detection.

Together, they create a lightweight monitoring pipeline for forest surveillance and wildlife observation.

## Features

- Live camera monitoring dashboard
- AI-based detection using YOLOv8
- Alert generation for human activity and wildlife sightings
- Support for multiple camera sources
- Demo mode for local testing without a physical camera
- Event feed and camera status visualization
- Browser-based dashboard for quick deployment and testing

## Repository Structure

```text
forest/
├── ForestGuardAI/
│   ├── src/
│   ├── ml/
│   ├── package.json
│   ├── README.md
│   └── ...
├── android-agent/
│   ├── camera_agent.py
│   ├── frame_saver.py
│   ├── classify_upload.py
│   ├── requirements.txt
│   └── ...
├── tejaswi.zip
└── README.md
```
