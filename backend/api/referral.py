"""MedBridge — Referral generation API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.patient import Patient
from services.gemini_service import generate_referral

router = APIRouter(prefix="/api/referral", tags=["Referral"])


class ReferralRequest(BaseModel):
    patient: Patient
    reason: str


@router.post("/generate")
async def create_referral(request: ReferralRequest):
    """Generate a referral summary draft.
    
    IMPORTANT: This is an AI-generated draft and requires clinician review
    before submission. Do not use as a final referral document.
    """
    try:
        result = await generate_referral(request.patient, request.reason)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Referral generation failed: {str(e)}")
