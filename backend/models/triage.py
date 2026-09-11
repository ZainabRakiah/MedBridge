"""MedBridge — Triage card and QR token models."""

from datetime import datetime
from pydantic import BaseModel, Field


class TriageCard(BaseModel):
    id: str = ""
    patient_id: str = ""
    patient_name: str = ""
    blood_group: str = ""
    allergies: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    known_conditions: list[str] = Field(default_factory=list)
    recent_procedures: list[str] = Field(default_factory=list)
    current_symptoms: str = ""
    critical_warnings: list[str] = Field(default_factory=list)
    emergency_contacts: list[str] = Field(default_factory=list)
    ai_flags: list[str] = Field(default_factory=list)
    last_updated: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class QRToken(BaseModel):
    token: str
    expires_at: str
    record_id: str
    qr_image_base64: str  # PNG base64


class GenerateTriageRequest(BaseModel):
    patient_name: str
    blood_group: str = ""
    allergies: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    known_conditions: list[str] = Field(default_factory=list)
    recent_procedures: list[str] = Field(default_factory=list)
    current_symptoms: str = ""
    critical_warnings: list[str] = Field(default_factory=list)
    ai_flags: list[str] = Field(default_factory=list)
