"""MedBridge — Triage card generation service."""

from __future__ import annotations

import uuid
from datetime import datetime
from models.patient import Patient
from models.triage import TriageCard


def generate_triage_card(patient: Patient) -> TriageCard:
    """Generate an emergency triage card from the patient record."""

    # Collect warnings
    warnings = []
    
    # Low-confidence medications
    for med in patient.medications:
        if med.confidence < 0.7:
            warnings.append(f"⚠ Low-confidence medication: {med.name} — verify before administering")
    
    # Check for HIGH severity safety flags (passed through patient.emergency_card)
    existing_flags = patient.emergency_card.get("ai_flags", [])

    # Build medication strings
    med_strings = []
    for med in patient.medications:
        if med.status == "active":
            parts = [med.name]
            if med.strength:
                parts.append(med.strength)
            if med.frequency:
                parts.append(f"— {med.frequency}")
            med_strings.append(" ".join(parts))

    # Build current symptoms
    symptom_events = [e for e in patient.timeline if e.event_type == "symptoms"]
    current_symptoms = "; ".join([e.description for e in symptom_events[:3]]) if symptom_events else "Not documented"

    # Recent procedures from timeline
    recent_procs = [e.description for e in patient.timeline if e.event_type in ("procedure", "discharge")][:3]

    return TriageCard(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        patient_name=patient.name,
        blood_group=patient.blood_group or "",
        allergies=patient.allergies,
        current_medications=med_strings,
        known_conditions=patient.conditions,
        recent_procedures=recent_procs,
        current_symptoms=current_symptoms,
        critical_warnings=warnings,
        emergency_contacts=[],
        ai_flags=existing_flags,
        last_updated=datetime.utcnow().isoformat(),
    )
