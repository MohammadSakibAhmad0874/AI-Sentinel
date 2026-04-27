import os
import re
import time
import requests
from typing import List, Dict

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
DETECTOR_MODEL = "Hello-SimpleAI/chatgpt-detector-roberta"
API_URL = f"https://api-inference.huggingface.co/models/{DETECTOR_MODEL}"

MAX_CHUNKS = 15  # cap to avoid rate limits


def _headers() -> dict:
    if HF_API_KEY:
        return {"Authorization": f"Bearer {HF_API_KEY}"}
    return {}


def _chunk_text(text: str, chunk_words: int = 280) -> List[str]:
    """Split text into word-capped chunks."""
    words = text.split()
    return [
        ' '.join(words[i:i + chunk_words])
        for i in range(0, len(words), chunk_words)
        if words[i:i + chunk_words]
    ]


def _query_hf(text: str, retries: int = 3) -> float:
    """Call HuggingFace Inference API, return AI probability [0–1]."""
    payload = {"inputs": text[:512]}  # model input limit

    for attempt in range(retries):
        try:
            r = requests.post(API_URL, headers=_headers(), json=payload, timeout=35)

            if r.status_code == 503:
                wait = min(25, 8 * (attempt + 1))
                time.sleep(wait)
                continue

            if r.status_code == 401:
                print("[AUTH ERROR] HuggingFace: Unauthorized. Check your API key.")
                return _fallback_heuristic(text)

            if r.status_code == 200:
                data = r.json()
                # Shape: [[{label, score}, ...]]  or [{label, score}, ...]
                items = data[0] if (isinstance(data, list) and isinstance(data[0], list)) else data
                for item in items:
                    label = item.get("label", "").lower()
                    score = float(item.get("score", 0))
                    if label in ("chatgpt", "ai", "generated", "fake", "machine"):
                        return score
                    elif label in ("human", "real", "authentic"):
                        return 1.0 - score

        except Exception as e:
            print(f"[HF API] Error attempt {attempt + 1}: {e}")
            if attempt < retries - 1:
                time.sleep(2)

    return _fallback_heuristic(text)


def _fallback_heuristic(text: str) -> float:
    """
    Very rough heuristic when API is unavailable.
    Looks for patterns common in LLM output.
    Returns probability [0–1].
    """
    score = 0.0
    words = text.split()
    if not words:
        return 0.0

    # LLM signature patterns
    patterns = [
        (r'\b(Furthermore|Moreover|Additionally|In conclusion|It is worth noting|It\'s important to note)\b', 0.08),
        (r'\b(delve|delving|comprehensive|In summary|To summarize|As an AI)\b', 0.10),
        (r'\b(Certainly!|Of course!|Absolutely!|Great question)\b', 0.12),
        (r'(\d+\.\s+\w|\•\s+\w)', 0.05),  # numbered/bulleted lists
        (r'(\*\*|##)\s+\w', 0.04),         # markdown headers
        (r'\b(nuanced|multifaceted|paradigm|leverage|synergy)\b', 0.06),
    ]
    for pattern, weight in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            score += weight

    # Sentence length uniformity (LLMs tend to be uniform)
    sentences = re.split(r'[.!?]+', text)
    lengths = [len(s.split()) for s in sentences if s.strip()]
    if len(lengths) > 3:
        avg = sum(lengths) / len(lengths)
        variance = sum((l - avg) ** 2 for l in lengths) / len(lengths)
        if variance < 20:  # very uniform → LLM-like
            score += 0.10

    return min(score, 0.95)


def _estimate_attribution(text: str, ai_prob: float) -> Dict[str, float]:
    """
    Heuristic model-style attribution.
    ⚠️ NOT scientifically guaranteed — clearly labelled as estimates.
    """
    words = text.split()
    sentences = re.split(r'[.!?]+', text)
    avg_len = len(words) / max(len(sentences), 1)

    has_lists     = bool(re.search(r'(\d+\.\s|\•\s|\-\s|\*\s)', text))
    has_md        = bool(re.search(r'(\*\*|##|__)', text))
    has_formal    = bool(re.search(r'\b(Furthermore|Moreover|Additionally|In conclusion|Therefore|Hence)\b', text, re.IGNORECASE))
    has_nuanced   = bool(re.search(r'\b(nuanced|while|although|however|nevertheless|nonetheless|albeit)\b', text, re.IGNORECASE))
    has_certainty = bool(re.search(r'\b(Certainly|Absolutely|Of course|Great question)\b', text, re.IGNORECASE))

    if has_certainty or (has_lists and has_md):
        w = {'chatgpt': 0.55, 'gemini': 0.22, 'claude': 0.15, 'other': 0.08}
    elif has_nuanced and avg_len > 18:
        w = {'chatgpt': 0.28, 'gemini': 0.20, 'claude': 0.42, 'other': 0.10}
    elif has_formal and avg_len > 15:
        w = {'chatgpt': 0.35, 'gemini': 0.25, 'claude': 0.30, 'other': 0.10}
    elif avg_len < 12:
        w = {'chatgpt': 0.40, 'gemini': 0.40, 'claude': 0.12, 'other': 0.08}
    else:
        w = {'chatgpt': 0.45, 'gemini': 0.28, 'claude': 0.18, 'other': 0.09}

    # Scale by overall AI probability
    return {k: round(v * ai_prob * 100, 1) for k, v in w.items()}


def detect_text(text: str) -> Dict:
    """Main entry point for text AI detection."""
    text = text.strip()
    if len(text) < 30:
        return {
            "ai_percent": 0,
            "human_percent": 100,
            "model_attribution": {"chatgpt": 0, "gemini": 0, "claude": 0, "other": 0},
            "chunks": [],
            "disclaimer": "Text too short for reliable analysis (minimum ~30 characters)."
        }

    chunks = _chunk_text(text)[:MAX_CHUNKS]
    if not chunks:
        chunks = [text[:1000]]

    chunk_results = []
    total_prob = 0.0

    for chunk in chunks:
        prob = _query_hf(chunk)
        total_prob += prob
        chunk_results.append({
            "text":    chunk,
            "ai_score": round(prob * 100, 1),
            "is_ai":    prob >= 0.5,
            "model":    "AI-generated" if prob >= 0.5 else "Human-written"
        })

    overall = total_prob / len(chunks)
    ai_pct   = round(overall * 100, 1)
    hum_pct  = round(100 - ai_pct, 1)

    return {
        "ai_percent":         ai_pct,
        "human_percent":      hum_pct,
        "model_attribution":  _estimate_attribution(text, overall),
        "chunks":             chunk_results,
        "disclaimer": (
            "AI Probability is based on writing-style analysis. "
            "Model attribution (ChatGPT-like, Gemini-like, etc.) is heuristic-based "
            "and NOT guaranteed to be accurate."
        )
    }
