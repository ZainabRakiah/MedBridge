"""MedBridge — Missing information detection service."""

from __future__ import annotations
from models.patient import Patient
from models.safety import MissingInfoResult
from services.gemini_service import find_missing_info as gemini_find_missing


async def detect_missing_info(patient: Patient) -> MissingInfoResult:
    """Detect missing clinical information using Gemini AI + local rules."""
    return await gemini_find_missing(patient)
