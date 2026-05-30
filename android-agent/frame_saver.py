"""
ForestGuard AI — Frame Saver Module
=====================================
Add this to your project root alongside camera_agent.py.
It handles saving detected frames to organized folders.
 
Folder structure created automatically:
  images_captured/
    tiger/
      tiger_20260530_143022_conf87.jpg
      tiger_20260530_143045_conf91.jpg
    elephant/
      elephant_20260530_143101_conf76.jpg
    human/
      human_20260530_143210_conf94.jpg
    ...
"""
 
import cv2
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
 
# ── CONFIG ────────────────────────────────────────────────
SAVE_DIR        = "images_captured"   # root folder
MIN_CONFIDENCE  = 0.60                # only save if conf > 50%
MAX_SAVES_PER_CLASS = 500             # prevent disk overflow
# ─────────────────────────────────────────────────────────
 
 
def save_detected_frame(
    frame,
    detections: List[Dict[str, Any]],
) -> List[str]:
    """
    For each detection above MIN_CONFIDENCE,
    saves the frame to images_captured/<class>/<filename>.jpg
 
    Returns list of saved file paths.
    """
    if frame is None or not detections:
        return []
 
    saved_paths = []
    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:19]
 
    # Track which classes we already saved this frame for
    # (avoid saving same frame 3x if 3 tigers detected)
    saved_classes_this_frame = set()
 
    for det in detections:
        cls_name = det["object"]
        conf     = det["confidence"]
 
        # Skip if below confidence threshold
        if conf < MIN_CONFIDENCE:
            continue
 
        # Skip if already saved this class for this frame
        if cls_name in saved_classes_this_frame:
            continue
 
        # Create folder for this class if it doesn't exist
        class_folder = Path(SAVE_DIR) / cls_name
        class_folder.mkdir(parents=True, exist_ok=True)
 
        # Check if we've hit the max saves for this class
        existing = list(class_folder.glob("*.jpg"))
        if len(existing) >= MAX_SAVES_PER_CLASS:
            print(f"[saver] {cls_name}/ folder full ({MAX_SAVES_PER_CLASS} images) — skipping")
            continue
 
        # Build filename: tiger_20260530_143022_conf87.jpg
        conf_pct  = round(conf * 100)
        filename  = f"{cls_name}_{timestamp}_conf{conf_pct}.jpg"
        filepath  = class_folder / filename
 
        # Save the frame
        success = cv2.imwrite(str(filepath), frame)
 
        if success:
            saved_paths.append(str(filepath))
            saved_classes_this_frame.add(cls_name)
            print(f"[saver] 📸 Saved: {filepath}")
        else:
            print(f"[saver] ❌ Failed to save: {filepath}")
 
    return saved_paths
 
 
def get_save_stats() -> Dict[str, int]:
    """Returns count of saved images per class."""
    stats = {}
    save_root = Path(SAVE_DIR)
    if not save_root.exists():
        return stats
    for class_folder in sorted(save_root.iterdir()):
        if class_folder.is_dir():
            count = len(list(class_folder.glob("*.jpg")))
            stats[class_folder.name] = count
    return stats
 
 
def print_save_stats():
    """Prints a summary of saved images."""
    stats = get_save_stats()
    if not stats:
        print("[saver] No images saved yet.")
        return
    print("\n[saver] Images captured so far:")
    total = 0
    for cls, count in stats.items():
        print(f"  {cls:<25} {count:>4} images")
        total += count
    print(f"  {'TOTAL':<25} {total:>4} images")
    print(f"  Folder: {Path(SAVE_DIR).resolve()}\n")
