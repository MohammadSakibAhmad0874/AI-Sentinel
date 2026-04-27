from fastapi import APIRouter
from fastapi.responses import JSONResponse
import os

router = APIRouter()


@router.get("/health")
async def health_check():
    hf_key = os.getenv("HUGGINGFACE_API_KEY")
    return JSONResponse(content={
        "status": "ok",
        "api_key_loaded": bool(hf_key),
        "message": "AI Sentinel backend is healthy"
    })
