from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from services.file_parser import parse_file
from services.text_detector import detect_text
from services.image_detector import detect_image
from services.video_detector import detect_video
from typing import Optional

router = APIRouter()


@router.post("/detect")
async def detect_file(file: Optional[UploadFile] = File(None),
                      text: Optional[str] = Form(None)):
    """
    Primary detection endpoint.
    Accepts either:
      - multipart file upload  (any document, image, video)
      - raw text via form field  (paste text directly)
    """

    # ── TEXT-ONLY MODE ────────────────────────────────────────────────────
    if text and not file:
        text = text.strip()
        if len(text) < 20:
            raise HTTPException(status_code=400, detail="Text is too short for analysis (min 20 chars).")
        result = detect_text(text)
        result.update({
            "filename":  "Pasted Text",
            "file_type": "text",
            "file_size": len(text.encode())
        })
        return JSONResponse(content=result)

    # ── FILE MODE ─────────────────────────────────────────────────────────
    if not file:
        raise HTTPException(status_code=400, detail="No file or text provided.")

    # Check file size early (100 MB global cap)
    MAX_SIZE = 100 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413,
                            detail="File exceeds 100 MB limit.")

    filename     = file.filename or "unknown"
    content_type = file.content_type or ""

    # Parse
    text_content, file_category, media_bytes = parse_file(file_bytes, filename, content_type)

    result: dict = {
        "filename":  filename,
        "file_type": file_category,
        "file_size": len(file_bytes),
    }

    # ── TEXT DOCUMENT ─────────────────────────────────────────────────────
    if file_category == "text":
        if not text_content or len(text_content.strip()) < 20:
            raise HTTPException(status_code=400,
                                detail="Could not extract readable text from file, or the file is empty.")
        detection = detect_text(text_content)
        result.update(detection)

    # ── IMAGE ─────────────────────────────────────────────────────────────
    elif file_category == "image":
        detection = detect_image(file_bytes, filename)
        result.update(detection)
        # Images don't have per-model text attribution
        result["model_attribution"] = {
            "chatgpt": 0, "gemini": 0, "claude": 0,
            "other": detection.get("ai_percent", 0)
        }
        result["chunks"] = []

    # ── VIDEO ─────────────────────────────────────────────────────────────
    elif file_category == "video":
        detection = detect_video(file_bytes, filename)
        if not detection.get("valid", True):
            raise HTTPException(status_code=400, detail=detection.get("error", "Video error."))
        result.update(detection)
        result["model_attribution"] = {
            "chatgpt": 0, "gemini": 0, "claude": 0,
            "other": detection.get("ai_percent", 0)
        }
        result["chunks"] = []

    # ── UNKNOWN ───────────────────────────────────────────────────────────
    else:
        raise HTTPException(status_code=415,
                            detail=f"Unsupported file type. Please upload a document, image, or video.")

    return JSONResponse(content=result)
