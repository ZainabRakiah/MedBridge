"""MedBridge — Document extraction orchestration service."""

from __future__ import annotations

import uuid
from datetime import datetime

from models.patient import MedicalDocument
from services.gemini_service import extract_document
from config.settings import ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB


SUPPORTED_DOC_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "image",
    "image/png": "image",
    "image/heic": "image",
    "image/webp": "image",
}


async def process_uploaded_document(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    patient_id: str,
) -> MedicalDocument:
    """Validate, extract and return a structured MedicalDocument."""

    # Validate mime type
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported file type: {mime_type}. Supported: PDF, JPG, PNG.")

    # Validate file size
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise ValueError(f"File too large: {size_mb:.1f}MB. Maximum allowed: {MAX_FILE_SIZE_MB}MB.")

    # Extract medical data
    extracted = await extract_document(file_bytes, mime_type, filename)

    doc = MedicalDocument(
        id=str(uuid.uuid4()),
        patient_id=patient_id,
        type=extracted.document_type or "other",
        filename=_sanitize_filename(filename),
        date=extracted.document_date,
        source="upload",
        extracted_data=extracted,
        confidence=extracted.confidence,
        verification_status="unverified",
        uploaded_at=datetime.utcnow().isoformat(),
    )

    return doc


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal."""
    import os
    # Keep only the basename, replace unsafe chars
    basename = os.path.basename(filename)
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in basename)
    return safe[:255]
