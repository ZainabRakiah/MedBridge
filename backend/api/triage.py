"""MedBridge — Triage and QR API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.patient import Patient
from models.triage import TriageCard, QRToken, GenerateTriageRequest
from models.safety import ConflictResult, MissingInfoResult
from services.triage_service import generate_triage_card
from services.qr_service import generate_qr_token, verify_qr_token
from services.conflict_service import detect_document_conflicts
from services.missing_info_service import detect_missing_info
from services.gemini_service import generate_clinical_summary
from models.patient import ClinicalSummary

router = APIRouter(prefix="/api/triage", tags=["Triage"])


@router.post("/generate", response_model=TriageCard)
async def create_triage_card(patient: Patient):
    """Generate an emergency triage card from a patient record."""
    try:
        card = generate_triage_card(patient)
        return card
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Triage card generation failed: {str(e)}")


@router.post("/qr", response_model=QRToken)
async def create_qr_token(triage_card: TriageCard, base_url: str = "http://localhost:3000"):
    """Generate a secure QR code for the triage card.
    
    The QR code contains ONLY a signed token (no PHI).
    Token expires in 24 hours by default.
    """
    try:
        token = generate_qr_token(triage_card, base_url)
        return token
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR generation failed: {str(e)}")


@router.get("/view/{token_str}")
async def view_triage_by_token(token_str: str):
    """Validate a QR token and return the associated triage view (demo: returns token info)."""
    payload = verify_qr_token(token_str)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired QR token.")
    return {
        "valid": True,
        "record_id": payload.get("rid"),
        "expires_at": payload.get("exp"),
        "message": "Token valid. Full record available in MedBridge app.",
        "disclaimer": "This is a demonstration token. In production, this would resolve to the authenticated patient triage view.",
    }


# ── Analysis endpoints ────────────────────────────────────────────────────────

class ConflictRequest(BaseModel):
    patient: Patient


class SummaryRequest(BaseModel):
    patient: Patient


@router.post("/analyze/conflicts", response_model=ConflictResult)
async def analyze_conflicts(request: ConflictRequest):
    """Detect conflicts across patient documents."""
    try:
        result = await detect_document_conflicts(request.patient.documents)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/missing", response_model=MissingInfoResult)
async def analyze_missing_info(request: ConflictRequest):
    """Detect missing clinical information in the patient record."""
    try:
        result = await detect_missing_info(request.patient)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/summary", response_model=ClinicalSummary)
async def generate_summary(request: SummaryRequest):
    """Generate a clinical summary of the patient record."""
    try:
        summary = await generate_clinical_summary(request.patient)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
