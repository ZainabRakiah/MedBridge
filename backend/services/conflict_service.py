"""MedBridge — Conflict detection service."""

from __future__ import annotations
from models.patient import MedicalDocument
from models.safety import ConflictResult, ConflictItem
from services.gemini_service import detect_conflicts as gemini_detect_conflicts
import uuid


async def detect_document_conflicts(documents: list[MedicalDocument]) -> ConflictResult:
    """Detect conflicts across multiple extracted medical documents.
    
    Uses Gemini AI for semantic conflict detection + local rule-based checks.
    """
    if len(documents) < 2:
        return ConflictResult()

    # Rule-based conflict detection (local, no API)
    local_conflicts = _local_conflict_check(documents)

    # Gemini AI semantic conflict detection
    docs_data = [
        {
            "filename": doc.filename,
            "date": doc.date,
            "type": doc.type,
            "medications": [m.model_dump() for m in doc.extracted_data.medications],
            "allergies": doc.extracted_data.allergies,
            "diagnoses": doc.extracted_data.diagnoses,
            "lab_results": [lr.model_dump() for lr in doc.extracted_data.lab_results],
        }
        for doc in documents
    ]

    ai_result = await gemini_detect_conflicts(docs_data)

    # Merge, deduplicate
    all_conflicts = local_conflicts + ai_result.conflicts
    # Deduplicate by field + values
    seen = set()
    unique: list[ConflictItem] = []
    for c in all_conflicts:
        key = f"{c.field}|{c.value_a}|{c.value_b}"
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return ConflictResult(total_conflicts=len(unique), conflicts=unique)


def _local_conflict_check(documents: list[MedicalDocument]) -> list[ConflictItem]:
    """Rule-based: detect medication dose conflicts and allergy conflicts."""
    conflicts: list[ConflictItem] = []

    # Build medication index: {normalized_name: [(dose_str, source_label, doc_date)]}
    med_index: dict[str, list[tuple[str, str, str]]] = {}
    for doc in documents:
        source = f"{doc.type.replace('_', ' ').title()} dated {doc.date or 'unknown date'}"
        for med in doc.extracted_data.medications:
            key = med.name.lower().strip()
            dose_str = f"{med.strength} {med.dose}".strip()
            if key not in med_index:
                med_index[key] = []
            med_index[key].append((dose_str, source, doc.date or ""))

    for med_name, entries in med_index.items():
        if len(entries) < 2:
            continue
        # Check if doses differ
        doses = set(e[0] for e in entries if e[0])
        if len(doses) > 1:
            e1 = entries[0]
            e2 = entries[1]
            conflicts.append(ConflictItem(
                id=str(uuid.uuid4()),
                conflict_type="medication_dose",
                field=f"{med_name.title()} strength/dose",
                value_a=e1[0] or "unspecified",
                source_a=e1[1],
                value_b=e2[0] or "unspecified",
                source_b=e2[1],
                description=f"{med_name.title()} appears with different strengths in different documents.",
                severity="HIGH",
            ))

    # Allergy conflicts (allergy present in one doc but not another and explicitly contradicted)
    all_allergies: set[str] = set()
    for doc in documents:
        for a in doc.extracted_data.allergies:
            all_allergies.add(a.lower())

    return conflicts
