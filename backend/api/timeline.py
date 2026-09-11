"""MedBridge — Timeline API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.patient import MedicalDocument, TimelineEvent
from services.timeline_service import build_timeline_from_documents, add_voice_symptom_event
from services.gemini_service import extract_symptoms_from_voice

router = APIRouter(prefix="/api", tags=["Timeline"])


class TimelineRequest(BaseModel):
    patient_id: str
    documents: list[MedicalDocument]


class VoiceSymptomRequest(BaseModel):
    patient_id: str
    statement: str


@router.post("/patient/timeline", response_model=list[TimelineEvent])
async def generate_timeline(request: TimelineRequest):
    """Generate a chronological patient timeline from extracted medical documents."""
    try:
        events = build_timeline_from_documents(request.documents)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Timeline generation failed: {str(e)}")


@router.post("/patient/voice-symptom", response_model=list[TimelineEvent])
async def add_voice_symptoms(request: VoiceSymptomRequest):
    """Extract symptoms from a patient voice description and add to timeline."""
    try:
        result = await extract_symptoms_from_voice(request.statement)
        events = add_voice_symptom_event(
            patient_id=request.patient_id,
            symptoms=result.get("symptoms", []),
            original_statement=request.statement,
        )
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Symptom extraction failed: {str(e)}")
