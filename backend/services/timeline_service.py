"""MedBridge — Patient medical timeline construction service."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from models.patient import MedicalDocument, TimelineEvent


EVENT_TYPE_PRIORITY = {
    "hospitalization": 0,
    "discharge": 1,
    "procedure": 2,
    "diagnosis": 3,
    "lab_result": 4,
    "medication_started": 5,
    "medication_stopped": 6,
    "medication_changed": 7,
    "allergy": 8,
    "symptoms": 9,
    "consultation": 10,
    "follow_up": 11,
    "referral": 12,
}


def _parse_date(date_str: str) -> datetime:
    """Parse date string, return epoch start on failure."""
    formats = ["%Y-%m-%d", "%Y-%m", "%Y", "%d/%m/%Y", "%m/%d/%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str[:10], fmt)
        except Exception:
            continue
    return datetime(1900, 1, 1)


def build_timeline_from_documents(documents: list[MedicalDocument]) -> list[TimelineEvent]:
    """Build a chronological timeline from extracted medical documents."""
    events: list[TimelineEvent] = []

    for doc in documents:
        data = doc.extracted_data
        doc_date = data.document_date or doc.date or ""
        source_label = f"{doc.type.replace('_', ' ').title()}: {doc.filename}"

        # Diagnoses
        for diagnosis in data.diagnoses:
            events.append(TimelineEvent(
                id=str(uuid.uuid4()),
                patient_id=doc.patient_id,
                date=doc_date,
                event_type="diagnosis",
                description=diagnosis,
                source_document_id=doc.id,
                source_type="document",
                confidence=data.confidence,
                verification_status="unverified",
                metadata={"source_label": source_label, "document_type": doc.type},
            ))

        # Medications
        for med in data.medications:
            event_type = "medication_started"
            if med.status == "stopped":
                event_type = "medication_stopped"
            elif med.status == "changed":
                event_type = "medication_changed"

            events.append(TimelineEvent(
                id=str(uuid.uuid4()),
                patient_id=doc.patient_id,
                date=doc_date,
                event_type=event_type,
                description=f"{med.name} {med.strength} — {med.frequency}",
                source_document_id=doc.id,
                source_type="document",
                confidence=med.confidence,
                verification_status="unverified",
                metadata={
                    "source_label": source_label,
                    "medication": med.model_dump(),
                    "low_confidence": med.confidence < 0.7,
                },
            ))

        # Lab results
        for lab in data.lab_results:
            events.append(TimelineEvent(
                id=str(uuid.uuid4()),
                patient_id=doc.patient_id,
                date=doc_date,
                event_type="lab_result",
                description=f"{lab.name}: {lab.value} {lab.unit}" + (f" [{lab.flag.upper()}]" if lab.flag not in ("normal", "") else ""),
                source_document_id=doc.id,
                source_type="document",
                confidence=data.confidence,
                verification_status="unverified",
                metadata={
                    "source_label": source_label,
                    "lab_result": lab.model_dump(),
                    "abnormal": lab.flag not in ("normal", ""),
                },
            ))

        # Procedures
        for proc in data.procedures:
            events.append(TimelineEvent(
                id=str(uuid.uuid4()),
                patient_id=doc.patient_id,
                date=doc_date,
                event_type="procedure",
                description=proc,
                source_document_id=doc.id,
                source_type="document",
                confidence=data.confidence,
                verification_status="unverified",
                metadata={"source_label": source_label},
            ))

        # Discharge summary
        if doc.type == "discharge_summary":
            events.append(TimelineEvent(
                id=str(uuid.uuid4()),
                patient_id=doc.patient_id,
                date=doc_date,
                event_type="discharge",
                description=f"Hospital discharge — {data.hospital or 'Unknown hospital'}",
                source_document_id=doc.id,
                source_type="document",
                confidence=data.confidence,
                verification_status="unverified",
                metadata={"source_label": source_label},
            ))

        # Allergies
        for allergy in data.allergies:
            events.append(TimelineEvent(
                id=str(uuid.uuid4()),
                patient_id=doc.patient_id,
                date=doc_date,
                event_type="allergy",
                description=f"Allergy recorded: {allergy}",
                source_document_id=doc.id,
                source_type="document",
                confidence=data.confidence,
                verification_status="unverified",
                metadata={"source_label": source_label},
            ))

        # Follow-up items
        for fu in data.follow_up:
            events.append(TimelineEvent(
                id=str(uuid.uuid4()),
                patient_id=doc.patient_id,
                date=doc_date,
                event_type="follow_up",
                description=fu,
                source_document_id=doc.id,
                source_type="document",
                confidence=data.confidence,
                verification_status="unverified",
                metadata={"source_label": source_label},
            ))

    # Sort chronologically (most recent first)
    events.sort(key=lambda e: _parse_date(e.date), reverse=True)

    return events


def add_voice_symptom_event(
    patient_id: str,
    symptoms: list[dict[str, Any]],
    original_statement: str,
) -> list[TimelineEvent]:
    """Create timeline events from voice-described symptoms."""
    events = []
    today = datetime.utcnow().strftime("%Y-%m-%d")

    for sym in symptoms:
        desc_parts = [sym.get("name", "Symptom")]
        if sym.get("duration"):
            desc_parts.append(f"for {sym['duration']}")
        if sym.get("trigger"):
            desc_parts.append(f"(triggered by {sym['trigger']})")

        events.append(TimelineEvent(
            id=str(uuid.uuid4()),
            patient_id=patient_id,
            date=today,
            event_type="symptoms",
            description=" ".join(desc_parts),
            source_document_id="",
            source_type="voice",
            confidence=0.85,
            verification_status="patient_reported",
            metadata={
                "source_label": "Patient voice description",
                "original_statement": original_statement,
                "symptom": sym,
            },
        ))

    return events
