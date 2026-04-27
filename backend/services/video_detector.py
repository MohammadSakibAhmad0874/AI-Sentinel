import os
import tempfile
from typing import Dict, List
from services.image_detector import detect_image

MAX_DURATION_SEC = 120   # 2 minutes
MAX_FILE_BYTES   = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXTS     = {'mp4', 'mov', 'webm'}
FRAME_INTERVAL   = 2     # seconds between sampled frames


def _get_ext(filename: str) -> str:
    return filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''


def _validate(file_bytes: bytes, filename: str) -> Dict:
    """Return {"valid": True/False, "error": str}."""
    if len(file_bytes) > MAX_FILE_BYTES:
        return {"valid": False,
                "error": "File size exceeds 100 MB limit. Please upload a smaller video."}

    ext = _get_ext(filename)
    if ext not in ALLOWED_EXTS:
        return {"valid": False,
                "error": f"Unsupported format '.{ext}'. Only mp4, mov, and webm are allowed."}

    return {"valid": True}


def _write_tmp(file_bytes: bytes, ext: str) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False)
    tmp.write(file_bytes)
    tmp.close()
    return tmp.name


def detect_video(file_bytes: bytes, filename: str) -> Dict:
    """
    Detect AI-generated content in a video.
    Max length: 2 minutes. Max size: 100 MB.
    """
    validation = _validate(file_bytes, filename)
    if not validation["valid"]:
        return {"valid": False, "error": validation["error"]}

    ext = _get_ext(filename)
    tmp_path = _write_tmp(file_bytes, ext)

    try:
        import cv2

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return {"valid": False, "error": "Could not open video file. It may be corrupted."}

        fps         = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        duration    = frame_count / fps

        # Enforce 2-minute cap
        if duration > MAX_DURATION_SEC:
            cap.release()
            minutes = int(duration // 60)
            seconds = int(duration % 60)
            return {
                "valid": False,
                "error": (
                    f"Video must be 2 minutes or less. "
                    f"Your video is {minutes}m {seconds}s long. "
                    f"Please trim it and try again."
                )
            }

        # Extract and analyse frames
        frame_results: List[Dict] = []
        current_sec = 0.0

        while current_sec <= duration:
            cap.set(cv2.CAP_PROP_POS_MSEC, current_sec * 1000)
            ret, frame = cap.read()
            if not ret:
                break

            # Encode frame as JPEG
            _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            result  = detect_image(buf.tobytes(), f"frame_{int(current_sec)}.jpg")

            frame_results.append({
                "timestamp":  round(current_sec, 1),
                "ai_percent": result.get("ai_percent", 0),
                "is_ai":      result.get("is_ai", False),
                "method":     result.get("method", "")
            })
            current_sec += FRAME_INTERVAL

        cap.release()

        if not frame_results:
            return {"valid": False, "error": "No frames could be extracted from this video."}

        ai_frames      = [f for f in frame_results if f["is_ai"]]
        ai_frame_pct   = round(len(ai_frames) / len(frame_results) * 100, 1)
        avg_ai_conf    = round(sum(f["ai_percent"] for f in frame_results) / len(frame_results), 1)
        flagged_stamps = [f["timestamp"] for f in frame_results if f["is_ai"]]

        return {
            "valid":              True,
            "duration":           round(duration, 1),
            "frames_analyzed":    len(frame_results),
            "ai_percent":         avg_ai_conf,
            "human_percent":      round(100 - avg_ai_conf, 1),
            "ai_frame_percent":   ai_frame_pct,
            "flagged_timestamps": flagged_stamps,
            "frame_results":      frame_results,
            "disclaimer": (
                "Video AI detection is based on per-frame image analysis. "
                "Detection accuracy depends on video quality and content type."
            )
        }

    except ImportError:
        return {
            "valid": False,
            "error": "OpenCV (cv2) is not installed. Run: pip install opencv-python-headless"
        }
    except Exception as e:
        return {"valid": False, "error": f"Video processing error: {str(e)}"}
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
