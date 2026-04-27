import os
import io
import time
import requests
from PIL import Image
from typing import Dict

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
IMAGE_MODEL = "umm-maybe/AI-image-detector"
API_URL     = f"https://api-inference.huggingface.co/models/{IMAGE_MODEL}"

# AI metadata markers left by generation tools
AI_METADATA_MARKERS = [
    'stable diffusion', 'midjourney', 'dall-e', 'dall·e', 'ai generated',
    'comfyui', 'automatic1111', 'invokeai', 'dream', 'nai diffusion',
    'waifu diffusion', 'runwayml', 'adobe firefly', 'ideogram', 'leonardo.ai'
]


def _headers() -> dict:
    return {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}


def _call_hf_image(image_bytes: bytes, retries: int = 3) -> float | None:
    """Call HF image detector API. Returns AI probability or None on failure."""
    for attempt in range(retries):
        try:
            r = requests.post(API_URL, headers=_headers(), data=image_bytes, timeout=40)

            if r.status_code == 503:
                time.sleep(min(20, 7 * (attempt + 1)))
                continue

            if r.status_code == 200:
                data = r.json()
                items = data if isinstance(data, list) else []
                for item in items:
                    label = item.get("label", "").lower()
                    score = float(item.get("score", 0))
                    if label in ("artificial", "ai", "generated", "fake"):
                        return score
                    elif label in ("human", "real", "natural", "authentic"):
                        return 1.0 - score

        except Exception as e:
            print(f"Image API attempt {attempt + 1} error: {e}")
            if attempt < retries - 1:
                time.sleep(2)

    return None


def _check_metadata(image_bytes: bytes) -> Dict:
    """Scan EXIF / PNG metadata for AI tool signatures."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        info_str = str(img.info).lower()
        meta_str = ""
        if hasattr(img, '_getexif') and img._getexif():
            meta_str = str(img._getexif()).lower()

        combined = info_str + meta_str
        found_markers = [m for m in AI_METADATA_MARKERS if m in combined]
        if found_markers:
            return {
                "is_ai": True,
                "ai_percent": 96.0,
                "human_percent": 4.0,
                "confidence": 0.96,
                "method": "Metadata Analysis",
                "markers_found": found_markers
            }

        # Size heuristics: common AI image dimensions
        w, h = img.size
        common_ai_sizes = [(512, 512), (768, 768), (1024, 1024), (512, 768),
                           (768, 512), (1024, 768), (832, 1216), (1216, 832)]
        if (w, h) in common_ai_sizes:
            return {
                "is_ai": None,  # inconclusive
                "ai_percent": 40.0,
                "human_percent": 60.0,
                "confidence": 0.40,
                "method": "Dimension Heuristic (inconclusive)",
                "markers_found": []
            }

    except Exception:
        pass

    return {
        "is_ai": False,
        "ai_percent": 10.0,
        "human_percent": 90.0,
        "confidence": 0.10,
        "method": "No AI markers found",
        "markers_found": []
    }


def detect_image(image_bytes: bytes, filename: str = "image.jpg") -> Dict:
    """Main image AI detection entry point."""
    # 1. Try HuggingFace model
    hf_prob = _call_hf_image(image_bytes)

    if hf_prob is not None:
        is_ai   = hf_prob >= 0.5
        ai_pct  = round(hf_prob * 100, 1)
        hm_pct  = round(100 - ai_pct, 1)
        return {
            "is_ai":         is_ai,
            "ai_percent":    ai_pct,
            "human_percent": hm_pct,
            "confidence":    round(hf_prob, 3),
            "method":        "HuggingFace AI Image Detector",
            "markers_found": []
        }

    # 2. Fallback: metadata analysis
    print("[WARN] HF image API unavailable, falling back to metadata.")
    return _check_metadata(image_bytes)
