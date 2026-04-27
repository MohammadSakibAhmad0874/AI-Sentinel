from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import detect, health
import os
import pathlib
from dotenv import load_dotenv

load_dotenv()

# Warn if no API key
if not os.getenv("HUGGINGFACE_API_KEY"):
    print("[WARNING] HUGGINGFACE_API_KEY not found in .env.")
    print("          Detection will use fallback heuristics only.")
else:
    print("[OK] HuggingFace API key loaded successfully.")

app = FastAPI(
    title="AI Sentinel API",
    description="Detect AI-generated content across all file types",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # MUST be False when allow_origins=["*"] — CORS spec requirement
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(detect.router, prefix="/api")
app.include_router(health.router, prefix="/api")

# Resolve frontend path (one level up from backend/)
FRONTEND_DIR = pathlib.Path(__file__).parent.parent / "frontend"

if FRONTEND_DIR.exists():
    # LOCAL DEV: serve the frontend directly from FastAPI
    @app.get("/results", include_in_schema=False)
    async def results_page():
        return FileResponse(FRONTEND_DIR / "results.html")

    @app.get("/", include_in_schema=False)
    async def index_page():
        return FileResponse(FRONTEND_DIR / "index.html")

    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    app.mount("/js",  StaticFiles(directory=str(FRONTEND_DIR / "js")),  name="js")
else:
    # PRODUCTION (HuggingFace Spaces): API-only mode
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "service": "AI Sentinel API",
            "version": "1.0.0",
            "status": "running",
            "docs": "/api/docs",
            "health": "/api/health"
        }

