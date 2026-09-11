"""MedBridge — Medication safety and conflict Pydantic models."""

from pydantic import BaseModel, Field


class SafetyFlag(BaseModel):
    id: str = ""
    flag_type: str = ""  # interaction | duplicate | allergy_conflict | dose_ambiguity | contraindication
    severity: str = "MODERATE"  # HIGH | MODERATE | LOW
    drug1: str = ""
    drug2: str = ""
    description: str = ""
    action: str = "Verify with clinician/pharmacist."
    source: str = ""
    requires_verification: bool = True


class MedicationSafetyResult(BaseModel):
    status: str = "OK"  # OK | REVIEW_REQUIRED | CRITICAL
    flags: list[SafetyFlag] = Field(default_factory=list)
    checked_medications: list[str] = Field(default_factory=list)
    checked_allergies: list[str] = Field(default_factory=list)


class ConflictItem(BaseModel):
    id: str = ""
    conflict_type: str = ""  # medication_dose | allergy_status | diagnosis_date | dob | lab_value | medication_status
    field: str = ""
    value_a: str = ""
    source_a: str = ""
    value_b: str = ""
    source_b: str = ""
    description: str = ""
    severity: str = "MODERATE"


class ConflictResult(BaseModel):
    total_conflicts: int = 0
    conflicts: list[ConflictItem] = Field(default_factory=list)


class MissingInfoItem(BaseModel):
    id: str = ""
    category: str = ""  # medication | allergy | lab | symptom | history | demographics
    description: str = ""
    importance: str = "MODERATE"  # HIGH | MODERATE | LOW
    suggested_action: str = ""


class MissingInfoResult(BaseModel):
    total_missing: int = 0
    items: list[MissingInfoItem] = Field(default_factory=list)
