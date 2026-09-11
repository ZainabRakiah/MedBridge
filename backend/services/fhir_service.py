"""MedBridge — Expanded FHIR R4 Bundle export service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from models.patient import Patient, Medication, TimelineEvent


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid_from_str(s: str) -> str:
    import uuid
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, s))


def _make_coding(system: str, code: str, display: str) -> dict:
    return {"system": system, "code": code, "display": display}


def _make_codeable_concept(codings: list[dict], text: str = "") -> dict:
    cc = {"coding": codings}
    if text:
        cc["text"] = text
    return cc


def _verification_extension(status: str) -> dict:
    return {
        "url": "https://medbridge.ai/fhir/StructureDefinition/verificationStatus",
        "valueString": status,
    }


def _ai_generated_extension() -> dict:
    return {
        "url": "https://medbridge.ai/fhir/StructureDefinition/aiGenerated",
        "valueBoolean": True,
    }


# ── Resource builders ────────────────────────────────────────────────────────

def _build_patient_resource(patient: Patient) -> dict:
    resource: dict[str, Any] = {
        "resourceType": "Patient",
        "id": f"patient-{patient.id}",
        "meta": {"lastUpdated": _now_iso()},
        "extension": [_ai_generated_extension()],
        "identifier": [{"system": "https://medbridge.ai/patient-id", "value": patient.id}],
        "name": [{"use": "official", "text": patient.name}],
        "gender": patient.sex.lower() if patient.sex else "unknown",
    }
    if patient.date_of_birth:
        resource["birthDate"] = patient.date_of_birth
    if patient.blood_group:
        resource["extension"].append({
            "url": "http://hl7.org/fhir/StructureDefinition/patient-bloodType",
            "valueString": patient.blood_group,
        })
    return resource


def _build_condition_resources(patient: Patient) -> list[dict]:
    resources = []
    for i, condition in enumerate(patient.conditions):
        resources.append({
            "resourceType": "Condition",
            "id": f"condition-{patient.id}-{i}",
            "extension": [_ai_generated_extension(), _verification_extension("unverified")],
            "clinicalStatus": _make_codeable_concept(
                [_make_coding("http://terminology.hl7.org/CodeSystem/condition-clinical", "active", "Active")]
            ),
            "verificationStatus": _make_codeable_concept(
                [_make_coding("http://terminology.hl7.org/CodeSystem/condition-ver-status", "unconfirmed", "Unconfirmed")]
            ),
            "code": _make_codeable_concept([], text=condition),
            "subject": {"reference": f"Patient/patient-{patient.id}"},
            "note": [{"text": "AI-extracted — requires clinician verification"}],
        })
    return resources


def _build_medication_request_resources(patient: Patient) -> list[dict]:
    resources = []
    for i, med in enumerate(patient.medications):
        verification = med.verification_status or "unverified"
        med_name = med.name
        if med.strength:
            med_name += f" {med.strength}"

        resource: dict[str, Any] = {
            "resourceType": "MedicationRequest",
            "id": f"medreq-{patient.id}-{i}",
            "extension": [_ai_generated_extension(), _verification_extension(verification)],
            "status": "active" if med.status == "active" else "stopped",
            "intent": "order",
            "medicationCodeableConcept": _make_codeable_concept([], text=med_name),
            "subject": {"reference": f"Patient/patient-{patient.id}"},
            "note": [
                {"text": f"AI-extracted (confidence: {med.confidence:.0%}) — requires clinician verification"},
                {"text": f"Source: {med.source}"},
            ],
        }
        if med.frequency or med.route:
            resource["dosageInstruction"] = [{
                "text": f"{med.dose} {med.frequency} {med.route}".strip(),
                "route": _make_codeable_concept([], text=med.route) if med.route else None,
            }]
        resources.append(resource)
    return resources


def _build_allergy_resources(patient: Patient) -> list[dict]:
    resources = []
    for i, allergy in enumerate(patient.allergies):
        resources.append({
            "resourceType": "AllergyIntolerance",
            "id": f"allergy-{patient.id}-{i}",
            "extension": [_ai_generated_extension(), _verification_extension("unverified")],
            "clinicalStatus": _make_codeable_concept(
                [_make_coding("http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "active", "Active")]
            ),
            "verificationStatus": _make_codeable_concept(
                [_make_coding("http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "unconfirmed", "Unconfirmed")]
            ),
            "type": "allergy",
            "patient": {"reference": f"Patient/patient-{patient.id}"},
            "code": _make_codeable_concept([], text=allergy),
            "note": [{"text": "AI-extracted — requires clinician verification"}],
        })
    return resources


def _build_observation_resources(patient: Patient) -> list[dict]:
    """Build Observation resources from lab results in timeline."""
    resources = []
    idx = 0
    for event in patient.timeline:
        if event.event_type == "lab_result":
            lab = event.metadata.get("lab_result", {})
            resources.append({
                "resourceType": "Observation",
                "id": f"obs-{patient.id}-{idx}",
                "extension": [_ai_generated_extension(), _verification_extension(event.verification_status)],
                "status": "preliminary",
                "code": _make_codeable_concept([], text=lab.get("name", event.description)),
                "subject": {"reference": f"Patient/patient-{patient.id}"},
                "effectiveDateTime": event.date or _now_iso(),
                "valueString": f"{lab.get('value', '')} {lab.get('unit', '')}".strip(),
                "interpretation": [_make_codeable_concept([], text=lab.get("flag", ""))] if lab.get("flag") and lab.get("flag") != "normal" else None,
                "note": [{"text": f"AI-extracted (confidence: {event.confidence:.0%}) — requires clinician verification. Source: {event.metadata.get('source_label', '')}"}],
            })
            idx += 1
    return resources


def _build_composition(patient: Patient, entry_refs: list[dict]) -> dict:
    now = _now_iso()
    return {
        "resourceType": "Composition",
        "id": f"composition-{patient.id}",
        "meta": {
            "profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord"],
            "lastUpdated": now,
        },
        "extension": [
            _ai_generated_extension(),
            {
                "url": "https://medbridge.ai/fhir/StructureDefinition/disclaimer",
                "valueString": "MedBridge AI-generated summary. All AI-extracted fields require clinician verification before clinical use.",
            }
        ],
        "status": "preliminary",
        "type": _make_codeable_concept(
            [_make_coding("http://loinc.org", "34133-9", "Summary of episode note")],
            text="MedBridge Patient Summary"
        ),
        "subject": {"reference": f"Patient/patient-{patient.id}"},
        "date": now,
        "author": [{"display": "MedBridge AI — requires clinician verification"}],
        "title": f"MedBridge Patient Summary: {patient.name}",
        "section": [
            {
                "title": "Conditions",
                "code": _make_codeable_concept([_make_coding("http://loinc.org", "11450-4", "Problem list")]),
                "entry": [{"reference": r["reference"]} for r in entry_refs if "Condition" in r.get("reference", "")],
            },
            {
                "title": "Medications",
                "code": _make_codeable_concept([_make_coding("http://loinc.org", "10160-0", "Medication use")]),
                "entry": [{"reference": r["reference"]} for r in entry_refs if "MedicationRequest" in r.get("reference", "")],
            },
            {
                "title": "Allergies",
                "code": _make_codeable_concept([_make_coding("http://loinc.org", "48765-2", "Allergies and Adverse Reactions")]),
                "entry": [{"reference": r["reference"]} for r in entry_refs if "AllergyIntolerance" in r.get("reference", "")],
            },
            {
                "title": "Observations (Lab Results)",
                "code": _make_codeable_concept([_make_coding("http://loinc.org", "30954-2", "Lab results")]),
                "entry": [{"reference": r["reference"]} for r in entry_refs if "Observation" in r.get("reference", "")],
            },
        ],
    }


def build_fhir_bundle(patient: Patient) -> dict:
    """Build a FHIR R4 Bundle from the full patient record."""
    now = _now_iso()

    patient_resource = _build_patient_resource(patient)
    conditions = _build_condition_resources(patient)
    medication_requests = _build_medication_request_resources(patient)
    allergies = _build_allergy_resources(patient)
    observations = _build_observation_resources(patient)

    all_resources = [patient_resource] + conditions + medication_requests + allergies + observations

    entries = []
    entry_refs = []
    for resource in all_resources:
        ref = f"{resource['resourceType']}/{resource['id']}"
        entries.append({
            "fullUrl": f"urn:uuid:{resource['id']}",
            "resource": resource,
        })
        entry_refs.append({"reference": ref})

    composition = _build_composition(patient, entry_refs)
    entries.insert(0, {"fullUrl": f"urn:uuid:{composition['id']}", "resource": composition})

    return {
        "resourceType": "Bundle",
        "id": f"bundle-{patient.id}",
        "meta": {
            "lastUpdated": now,
            "tag": [{"system": "https://medbridge.ai/tags", "code": "ai-generated", "display": "AI Generated — Requires Verification"}],
        },
        "type": "document",
        "timestamp": now,
        "total": len(entries),
        "entry": entries,
    }
