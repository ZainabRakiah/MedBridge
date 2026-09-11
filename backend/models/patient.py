"""MedBridge — Patient and Medical Document Pydantic models."""

from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


# ── Medication ──────────────────────────────────────────────────────────────

class Medication(BaseModel):
    name: str = ""
    generic_name: str = ""
    strength: str = ""
    dose: str = ""
    frequency: str = ""
    route: str = ""
    duration: str = ""
    status: str = "active"  # active | stopped | changed
    source: str = ""
    confidence: float = 0.0
    verification_status: str = "unverified"


# ── Timeline Event ──────────────────────────────────────────────────────────

class TimelineEvent(BaseModel):
    id: str = ""
    patient_id: str = ""
    date: str = ""
    event_type: str = ""  # diagnosis | medication_started | medication_stopped | lab_result | procedure | hospitalization | discharge | consultation | allergy | follow_up | referral | symptoms
    description: str = ""
    source_document_id: str = ""
    source_type: str = "document"  # document | voice | consultation | manual
    confidence: float = 0.0
    verification_status: str = "unverified"
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Extracted Document Data ─────────────────────────────────────────────────

class ExtractedLabResult(BaseModel):
    name: str = ""
    value: str = ""
    unit: str = ""
    reference_range: str = ""
    flag: str = ""  # normal | high | low | critical


class ExtractedData(BaseModel):
    document_type: str = ""
    patient_name: str = ""
    document_date: str = ""
    doctor: str = ""
    hospital: str = ""
    diagnoses: list[str] = Field(default_factory=list)
    medications: list[Medication] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    symptoms: list[str] = Field(default_factory=list)
    lab_results: list[ExtractedLabResult] = Field(default_factory=list)
    procedures: list[str] = Field(default_factory=list)
    follow_up: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    raw_text: str = ""


# ── Medical Document ────────────────────────────────────────────────────────

class MedicalDocument(BaseModel):
    id: str = ""
    patient_id: str = ""
    type: str = "unknown"  # prescription | lab_report | discharge_summary | referral | certificate | other
    filename: str = ""
    date: str = ""
    source: str = "upload"
    extracted_data: ExtractedData = Field(default_factory=ExtractedData)
    confidence: float = 0.0
    verification_status: str = "unverified"
    uploaded_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ── Clinical Summary ────────────────────────────────────────────────────────

class ClinicalSummary(BaseModel):
    patient_overview: str = ""
    current_complaint: str = ""
    relevant_history: list[str] = Field(default_factory=list)
    current_medications: list[Medication] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    recent_investigations: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    ai_flags: list[str] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ── Patient (extended) ──────────────────────────────────────────────────────

class Patient(BaseModel):
    id: str
    name: str = ""
    date_of_birth: str = ""
    age: str = ""
    sex: str = ""
    gender: str = ""
    phone: str = ""
    blood_group: str = ""
    allergies: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)
    medications: list[Medication] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list)
    documents: list[MedicalDocument] = Field(default_factory=list)
    emergency_card: dict[str, Any] = Field(default_factory=dict)
    clinical_summary: ClinicalSummary | None = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ── API Request/Response models ─────────────────────────────────────────────

class GenerateTimelineRequest(BaseModel):
    patient_id: str
    documents: list[MedicalDocument]


class GenerateSummaryRequest(BaseModel):
    patient_id: str
    patient: Patient


class UpdateVerificationRequest(BaseModel):
    document_id: str
    field: str
    value: str
    verification_status: str = "clinician_verified"
