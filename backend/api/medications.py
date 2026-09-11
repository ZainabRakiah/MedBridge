"""MedBridge — Medication safety API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.patient import Medication
from models.safety import MedicationSafetyResult
from services.medication_safety_service import check_medication_safety

router = APIRouter(prefix="/api/medications", tags=["Medications"])


class SafetyCheckRequest(BaseModel):
    medications: list[Medication]
    allergies: list[str] = []


@router.post("/check", response_model=MedicationSafetyResult)
async def check_medications(request: SafetyCheckRequest):
    """Check medications for safety flags: interactions, duplicates, allergy conflicts, dose ambiguity."""
    try:
        result = check_medication_safety(request.medications, request.allergies)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Safety check failed: {str(e)}")
