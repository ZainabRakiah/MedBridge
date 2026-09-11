"""MedBridge — FHIR R4 Bundle export API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from models.patient import Patient
from services.fhir_service import build_fhir_bundle

router = APIRouter(prefix="/api/fhir", tags=["FHIR"])


@router.post("/export")
async def export_fhir_bundle(patient: Patient):
    """Export a FHIR R4 Bundle from the patient record.
    
    The bundle includes: Patient, Conditions, MedicationRequests, 
    AllergyIntolerances, Observations (lab results), and Composition.
    
    All AI-extracted resources are tagged with verificationStatus=unconfirmed
    and include an ai-generated extension. Only clinician-verified data should
    be used for clinical decisions.
    """
    try:
        bundle = build_fhir_bundle(patient)
        return JSONResponse(
            content=bundle,
            headers={"Content-Disposition": f'attachment; filename="medbridge_fhir_{patient.id}.json"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FHIR export failed: {str(e)}")
