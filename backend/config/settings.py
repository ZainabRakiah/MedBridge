"""MedBridge — centralized configuration."""

import os
from dotenv import load_dotenv

load_dotenv()


# ── AI Keys (Google Gemini Exclusively) ──
GEMINI_API_KEY: str = (
    os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
    or os.getenv("GEMINI_API_KEY")
    or ""
)

# ── QR / Security ──
QR_HMAC_SECRET: str = os.getenv("QR_HMAC_SECRET", "medbridge-dev-secret-change-in-prod")
QR_TOKEN_TTL_SECONDS: int = int(os.getenv("QR_TOKEN_TTL_SECONDS", "86400"))  # 24h default

# ── CORS ──
ALLOWED_ORIGINS: list[str] = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001",
).split(",")

# ── Gemini model ──
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

# ── File upload limits ──
MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "20"))
ALLOWED_MIME_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/webp",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
}
