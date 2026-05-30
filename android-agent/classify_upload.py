#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

from ultralytics import YOLO

ALLOWED_CLASSES = {
    "deer",
    "elephant",
    "leopard",
    "macaque",
    "peacock",
    "rhino",
    "tiger",
    "wildboar",
}


def normalize_label(label: str) -> str:
    if label == "macaque":
        return "rhesus_monkey"
    if label == "wildboar":
        return "wild_boar"
    return label


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing_image_path"}))
        return 1

    image_path = Path(sys.argv[1]).resolve()
    model_path = Path(
        os.getenv(
            "MODEL_PATH",
            r"C:\Users\tejas\Desktop_Backup\tejaswi\ForestGuardAI\ml\model\best.pt",
        )
    ).resolve()
    conf_min = float(os.getenv("UPLOAD_CONFIDENCE_MIN", "0.25"))

    if not image_path.exists():
        print(json.dumps({"ok": False, "error": "image_not_found"}))
        return 1
    if not model_path.exists():
        print(json.dumps({"ok": False, "error": "model_not_found", "model_path": str(model_path)}))
        return 1

    try:
        model = YOLO(str(model_path))
        result = model.predict(str(image_path), verbose=False, conf=conf_min)[0]
    except Exception as err:
        print(json.dumps({"ok": False, "error": "inference_failed", "message": str(err)}))
        return 1

    best_by_label: dict[str, float] = {}
    for box in result.boxes:
        class_id = int(box.cls[0])
        label = str(model.names[class_id])
        if label not in ALLOWED_CLASSES:
            continue
        normalized = normalize_label(label)
        confidence = float(box.conf[0])
        prev = best_by_label.get(normalized)
        if prev is None or confidence > prev:
            best_by_label[normalized] = confidence

    detections = [
        {"label": label, "confidence": round(conf, 4)}
        for label, conf in sorted(best_by_label.items(), key=lambda item: item[1], reverse=True)
    ]

    top_label = detections[0]["label"] if detections else None
    top_confidence = detections[0]["confidence"] if detections else None

    print(
        json.dumps(
            {
                "ok": True,
                "model_path": str(model_path),
                "labels": [
                    "deer",
                    "elephant",
                    "leopard",
                    "rhesus_monkey",
                    "peacock",
                    "rhino",
                    "tiger",
                    "wild_boar",
                ],
                "topLabel": top_label,
                "topConfidence": top_confidence,
                "detections": detections,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
