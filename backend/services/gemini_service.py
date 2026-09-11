"""MedBridge — Google Gemini multimodal AI service.
Exclusively powered by Google Gemini 3.8 Flash (Sponsored by Google Antigravity).

Handles:
- Consultation audio transcription
- Medical document extraction (PDF/image → structured JSON)
- Handwritten prescription reading with confidence scoring
- Clinical summary generation
- Conflict detection
- Missing information identification
- Voice symptom extraction
- Specialist referral note drafting
"""

from __future__ import annotations

import base64
import json
import re
import uuid
from typing import Any

import httpx

from config.settings import GEMINI_API_KEY, GEMINI_MODEL
from models.patient import ExtractedData, Medication, ExtractedLabResult, ClinicalSummary, Patient
from models.safety import ConflictResult, ConflictItem, MissingInfoResult, MissingInfoItem


# ── Helpers ─────────────────────────────────────────────────────────────────

def _strip_json_fences(text: str) -> str:
    """Strip markdown code fences from AI response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


async def _call_gemini_generate(
    prompt: str,
    inline_data: dict[str, str] | None = None,
    system_instruction: str | None = None,
    timeout: float = 50.0,
) -> str:
    """Call Google Gemini 3.8 Flash via REST with automatic fallback cascade."""
    if not GEMINI_API_KEY:
        raise ValueError("Google Gemini API key not configured")

    models = [GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]
    seen = set()
    models_to_try = [m for m in models if not (m in seen or seen.add(m))]

    parts: list[dict[str, Any]] = []
    if inline_data:
        parts.append({"inlineData": inline_data})
    parts.append({"text": prompt})

    payload: dict[str, Any] = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    async with httpx.AsyncClient(timeout=timeout) as client:
        last_error = ""
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        content_parts = candidates[0].get("content", {}).get("parts", [])
                        if content_parts:
                            return content_parts[0].get("text", "")
                elif resp.status_code in (429, 503):
                    last_error = f"HTTP {resp.status_code} on {model}: {resp.text}"
                    continue
                else:
                    last_error = f"HTTP {resp.status_code} on {model}: {resp.text}"
            except Exception as e:
                last_error = str(e)
                continue

    raise RuntimeError(f"Gemini generation failed across models. Last error: {last_error}")


# ── Audio Transcription via Google Gemini ───────────────────────────────────

async def transcribe_audio_gemini(audio_bytes: bytes, mime_type: str = "audio/webm") -> dict[str, Any]:
    """Transcribe doctor-patient consultation audio using Google Gemini 3.8 Flash."""
    b64 = base64.b64encode(audio_bytes).decode("utf-8")
    prompt = (
        "You are an expert clinical medical transcriptionist. "
        "Listen to this doctor-patient consultation audio and transcribe every word accurately. "
        "Return ONLY a JSON object with this exact structure:\n"
        '{\n  "transcript": "full transcribed text of the consultation",\n  "language": "en",\n  "duration": 0.0\n}'
    )
    raw = await _call_gemini_generate(
        prompt=prompt,
        inline_data={"mimeType": mime_type, "data": b64},
        system_instruction="You transcribe medical conversations with extreme clinical fidelity.",
        timeout=60.0,
    )
    cleaned = _strip_json_fences(raw)
    try:
        return json.loads(cleaned)
    except Exception:
        return {"transcript": raw, "language": "en", "duration": 0.0}


# ── Document Extraction ──────────────────────────────────────────────────────

EXTRACTION_PROMPT = """You are a medical document information extraction AI.

Analyze the provided medical document carefully and extract all clinically relevant information.

IMPORTANT RULES:
1. Never guess or hallucinate medication names. If handwriting or text is ambiguous, set confidence < 0.7 and include a warning.
2. Extract ONLY information that is explicitly present in the document.
3. For dates, use ISO format YYYY-MM-DD when possible. If only partial date (e.g., "May 2026"), use "2026-05-01" and note the uncertainty.
4. For medications, if strength/dose is unclear from handwriting, set confidence to a lower value (0.4-0.6) and add a warning.
5. Identify the document type: prescription | lab_report | discharge_summary | referral | certificate | medication_list | other

Return ONLY valid JSON matching this exact structure:
{
  "document_type": "",
  "patient_name": "",
  "document_date": "",
  "doctor": "",
  "hospital": "",
  "diagnoses": [],
  "medications": [
    {
      "name": "",
      "generic_name": "",
      "strength": "",
      "dose": "",
      "frequency": "",
      "route": "",
      "duration": "",
      "status": "active",
      "source": "",
      "confidence": 0.95
    }
  ],
  "allergies": [],
  "symptoms": [],
  "lab_results": [
    {
      "name": "",
      "value": "",
      "unit": "",
      "reference_range": "",
      "flag": "normal"
    }
  ],
  "procedures": [],
  "follow_up": [],
  "warnings": [],
  "confidence": 0.95,
  "raw_text": "full text extracted from the document"
}"""


async def extract_document(file_bytes: bytes, mime_type: str, filename: str = "") -> ExtractedData:
    """Extract structured medical data from a document using Gemini multimodal."""

    if not GEMINI_API_KEY:
        return _mock_extraction(filename)

    try:
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        raw = await _call_gemini_generate(
            prompt=EXTRACTION_PROMPT,
            inline_data={"mimeType": mime_type, "data": b64},
            timeout=60.0,
        )
        cleaned = _strip_json_fences(raw)
        data = json.loads(cleaned)
        return _parse_extracted_data(data)
    except Exception as e:
        return ExtractedData(
            warnings=[f"Extraction failed: {str(e)}"],
            confidence=0.0,
        )


def _parse_extracted_data(data: dict[str, Any]) -> ExtractedData:
    """Parse raw Gemini JSON into ExtractedData model."""
    meds = []
    for m in data.get("medications", []):
        meds.append(Medication(
            name=m.get("name", ""),
            generic_name=m.get("generic_name", ""),
            strength=m.get("strength", ""),
            dose=m.get("dose", ""),
            frequency=m.get("frequency", ""),
            route=m.get("route", "oral"),
            duration=m.get("duration", ""),
            status=m.get("status", "active"),
            source=m.get("source", "document"),
            confidence=float(m.get("confidence", 0.8)),
            verification_status="unverified",
        ))

    labs = []
    for lab in data.get("lab_results", []):
        labs.append(ExtractedLabResult(
            name=lab.get("name", ""),
            value=lab.get("value", ""),
            unit=lab.get("unit", ""),
            reference_range=lab.get("reference_range", ""),
            flag=lab.get("flag", "normal"),
        ))

    return ExtractedData(
        document_type=data.get("document_type", "other"),
        patient_name=data.get("patient_name", ""),
        document_date=data.get("document_date", ""),
        doctor=data.get("doctor", ""),
        hospital=data.get("hospital", ""),
        diagnoses=data.get("diagnoses", []),
        medications=meds,
        allergies=data.get("allergies", []),
        symptoms=data.get("symptoms", []),
        lab_results=labs,
        procedures=data.get("procedures", []),
        follow_up=data.get("follow_up", []),
        warnings=data.get("warnings", []),
        confidence=float(data.get("confidence", 0.8)),
        raw_text=data.get("raw_text", ""),
    )


# ── Clinical Summary Generation ──────────────────────────────────────────────

SUMMARY_PROMPT_TEMPLATE = """You are a clinical information synthesis AI.

Given the patient's medical history below, generate a concise structured clinical summary for the treating physician.

CRITICAL RULES:
1. Do NOT diagnose. Summarize existing documented information only.
2. Clearly identify missing information.
3. Flag any AI concerns (low confidence extractions, conflicts, safety concerns).
4. Use clear clinical language appropriate for a physician.
5. All output must be clearly labeled as AI-generated and requiring human verification.

PATIENT DATA:
{patient_json}

Return ONLY valid JSON:
{{
  "patient_overview": "brief demographic and history overview",
  "current_complaint": "primary current complaint from symptoms/voice",
  "relevant_history": ["condition 1", "event 2", "..."],
  "allergies": ["allergy 1"],
  "recent_investigations": ["lab finding 1", "..."],
  "missing_information": [
    "Medication adherence not documented",
    "Allergy reaction type not recorded"
  ],
  "ai_flags": [
    "⚠ Low confidence on handwritten medication in [source]",
    "⚠ Medication dose conflict between two documents"
  ],
  "suggested_questions": [
    "What is the current medication adherence?",
    "Has the allergy reaction been documented?"
  ]
}}"""


async def generate_clinical_summary(patient: Patient) -> ClinicalSummary:
    """Generate a clinical summary from the patient's full record."""

    if not GEMINI_API_KEY:
        return _mock_summary(patient)

    try:
        patient_json = patient.model_dump_json(indent=2)
        prompt = SUMMARY_PROMPT_TEMPLATE.format(patient_json=patient_json[:8000])
        raw = await _call_gemini_generate(prompt=prompt, timeout=45.0)
        data = json.loads(_strip_json_fences(raw))

        return ClinicalSummary(
            patient_overview=data.get("patient_overview", ""),
            current_complaint=data.get("current_complaint", ""),
            relevant_history=data.get("relevant_history", []),
            current_medications=patient.medications[:10],
            allergies=data.get("allergies", patient.allergies),
            recent_investigations=data.get("recent_investigations", []),
            missing_information=data.get("missing_information", []),
            ai_flags=data.get("ai_flags", []),
            suggested_questions=data.get("suggested_questions", []),
        )
    except Exception as e:
        return ClinicalSummary(
            ai_flags=[f"Summary generation notice: {str(e)}. Clinician review recommended."],
            current_medications=patient.medications,
            allergies=patient.allergies,
        )


# ── Conflict Detection ───────────────────────────────────────────────────────

CONFLICT_PROMPT_TEMPLATE = """You are a medical record conflict detection AI.

Review the following extracted data from multiple medical documents and identify CONFLICTS.

A conflict is when the same clinical fact appears with different values in different source documents.
Examples:
- Medication A appears as 10mg in one document and 20mg in another
- Patient allergy status differs between documents
- Same medication listed as both active and stopped

PATIENT DATA:
{patient_json}

Return ONLY valid JSON:
{{
  "total_conflicts": 0,
  "conflicts": [
    {{
      "conflict_type": "medication_dose | medication_status | allergy | diagnosis",
      "field": "field name with conflict",
      "value_a": "value in first document",
      "source_a": "source document A",
      "value_b": "value in second document",
      "source_b": "source document B",
      "description": "clear explanation of the contradiction",
      "severity": "HIGH | MODERATE | LOW"
    }}
  ]
}}"""


async def detect_conflicts(patient: Patient) -> ConflictResult:
    """Identify contradictions across multiple documents."""

    if not GEMINI_API_KEY:
        return _mock_conflicts()

    try:
        patient_json = patient.model_dump_json(indent=2)
        prompt = CONFLICT_PROMPT_TEMPLATE.format(patient_json=patient_json[:8000])
        raw = await _call_gemini_generate(prompt=prompt, timeout=45.0)
        data = json.loads(_strip_json_fences(raw))

        conflicts = []
        for c in data.get("conflicts", []):
            conflicts.append(ConflictItem(
                id=str(uuid.uuid4())[:8],
                conflict_type=c.get("conflict_type", "general"),
                field=c.get("field", ""),
                value_a=c.get("value_a", ""),
                source_a=c.get("source_a", ""),
                value_b=c.get("value_b", ""),
                source_b=c.get("source_b", ""),
                description=c.get("description", ""),
                severity=c.get("severity", "MODERATE"),
            ))

        return ConflictResult(
            total_conflicts=len(conflicts),
            conflicts=conflicts,
        )
    except Exception as e:
        return ConflictResult(total_conflicts=0, conflicts=[])


# ── Missing Information Identification ────────────────────────────────────────

MISSING_INFO_PROMPT_TEMPLATE = """You are a clinical completeness checker AI.

Review the patient record and identify clinically critical missing information.

Check for:
1. Allergy listed without reaction type (rash, anaphylaxis, GI, etc.)
2. Medication without dose or frequency
3. Chronic diagnosis without recent monitoring (e.g., Diabetes without HbA1c in 6+ months)
4. Missing hospital discharge summary
5. Symptoms mentioned without duration or onset timing

PATIENT DATA:
{patient_json}

Return ONLY valid JSON:
{{
  "total_missing": 0,
  "items": [
    {{
      "category": "allergy | medication | lab | document | symptom",
      "description": "what is missing",
      "importance": "HIGH | MODERATE | LOW",
      "suggested_action": "what clinician should ask or do"
    }}
  ]
}}"""


async def identify_missing_info(patient: Patient) -> MissingInfoResult:
    """Identify missing clinical information that the doctor should verify."""

    if not GEMINI_API_KEY:
        return _mock_missing_info()

    try:
        patient_json = patient.model_dump_json(indent=2)
        prompt = MISSING_INFO_PROMPT_TEMPLATE.format(patient_json=patient_json[:8000])
        raw = await _call_gemini_generate(prompt=prompt, timeout=45.0)
        data = json.loads(_strip_json_fences(raw))

        items = []
        for item in data.get("items", []):
            items.append(MissingInfoItem(
                id=str(uuid.uuid4())[:8],
                category=item.get("category", "general"),
                description=item.get("description", ""),
                importance=item.get("importance", "MODERATE"),
                suggested_action=item.get("suggested_action", ""),
            ))

        return MissingInfoResult(total_missing=len(items), items=items)
    except Exception:
        return _mock_missing_info()


find_missing_info = identify_missing_info


# ── Voice Symptom Extraction ─────────────────────────────────────────────────

SYMPTOM_PROMPT = """Extract all reported symptoms from this patient statement.

Patient statement: "{statement}"

Return ONLY valid JSON:
{{
  "symptoms": [
    {{
      "name": "symptom name",
      "duration": "duration mentioned or null",
      "trigger": "triggers or null",
      "severity": "mild | moderate | severe | null",
      "onset": "approximate onset or null",
      "original_statement": "{statement}"
    }}
  ],
  "urgency_flag": false,
  "urgency_reason": ""
}}"""


async def extract_symptoms_from_voice(statement: str) -> dict[str, Any]:
    """Extract symptoms from a voice/text description."""

    if not GEMINI_API_KEY:
        return {
            "symptoms": [{"name": "chest discomfort", "duration": "3 weeks", "trigger": "walking", "severity": None, "onset": None, "original_statement": statement}],
            "urgency_flag": False,
            "urgency_reason": "",
        }

    try:
        prompt = SYMPTOM_PROMPT.format(statement=statement)
        raw = await _call_gemini_generate(prompt=prompt, timeout=30.0)
        return json.loads(_strip_json_fences(raw))
    except Exception:
        return {
            "symptoms": [{"name": statement, "duration": "", "trigger": "", "severity": None, "onset": None, "original_statement": statement}],
            "urgency_flag": False,
            "urgency_reason": "",
        }


# ── Referral Generation ──────────────────────────────────────────────────────

REFERRAL_PROMPT_TEMPLATE = """You are a medical referral preparation AI.

Generate a referral summary based on the patient data below and the referral reason provided.

CRITICAL: This is a DRAFT for clinician review. Label it clearly as AI-generated.

PATIENT DATA:
{patient_json}

REFERRAL REASON:
{reason}

Return ONLY valid JSON:
{{
  "reason_for_referral": "",
  "relevant_history": [],
  "current_medications": [],
  "relevant_investigations": [],
  "previous_treatment": "",
  "questions_for_specialist": [],
  "urgency": "routine",
  "disclaimer": "AI-generated draft — requires clinician review before submission"
}}"""


async def generate_referral(patient: Patient, reason: str) -> dict[str, Any]:
    """Generate a referral summary using Google Gemini."""

    if not GEMINI_API_KEY:
        return {
            "reason_for_referral": reason,
            "relevant_history": [c for c in patient.conditions],
            "current_medications": [f"{m.name} {m.strength}" for m in patient.medications],
            "relevant_investigations": [],
            "previous_treatment": "",
            "questions_for_specialist": ["Please review medication list for any contraindications."],
            "urgency": "routine",
            "disclaimer": "AI-generated draft — requires clinician review before submission",
        }

    try:
        patient_json = patient.model_dump_json(indent=2)[:6000]
        prompt = REFERRAL_PROMPT_TEMPLATE.format(patient_json=patient_json, reason=reason)
        raw = await _call_gemini_generate(prompt=prompt, timeout=45.0)
        return json.loads(_strip_json_fences(raw))
    except Exception as e:
        return {
            "reason_for_referral": reason,
            "error": str(e),
            "disclaimer": "AI-generated draft — requires clinician review before submission",
        }


# ── Mock Data (when no API key) ──────────────────────────────────────────────

def _mock_extraction(filename: str) -> ExtractedData:
    """Return synthetic extraction for demo/dev purposes."""
    return ExtractedData(
        document_type="prescription",
        patient_name="Aarav Sharma",
        document_date="2026-02-10",
        doctor="Dr. Priya Nair",
        hospital="City General Hospital",
        diagnoses=["Hypertension", "Type 2 Diabetes"],
        medications=[
            Medication(name="Metformin", strength="500mg", dose="500mg", frequency="Twice daily", route="oral", duration="3 months", confidence=0.95, source=filename),
            Medication(name="Amlodipine", strength="5mg", dose="5mg", frequency="Once daily", route="oral", duration="ongoing", confidence=0.92, source=filename),
        ],
        allergies=["Penicillin"],
        symptoms=["High blood pressure", "Frequent urination"],
        lab_results=[
            ExtractedLabResult(name="HbA1c", value="7.8", unit="%", reference_range="<7.0", flag="high"),
            ExtractedLabResult(name="Fasting Blood Sugar", value="142", unit="mg/dL", reference_range="70-100", flag="high"),
        ],
        confidence=0.93,
        raw_text=f"Mock extraction from {filename}",
    )


def _mock_summary(patient: Patient) -> ClinicalSummary:
    return ClinicalSummary(
        patient_overview=f"{patient.name}, with history of {', '.join(patient.conditions[:3]) or 'no documented conditions'}.",
        current_complaint="Chest discomfort for approximately 3 weeks.",
        relevant_history=patient.conditions,
        current_medications=patient.medications[:5],
        allergies=patient.allergies,
        recent_investigations=["HbA1c: 7.8% (elevated)", "Hb: 10.2 g/dL (low)", "Creatinine: 1.4 mg/dL"],
        missing_information=[
            "Current medication adherence not documented.",
            "Exact onset date of chest discomfort unavailable.",
            "Allergy reaction type not recorded.",
        ],
        ai_flags=[
            "⚠ Medication list contains a possible dose conflict — verify Amlodipine strength.",
            "⚠ Handwritten prescription contains one low-confidence medication name.",
        ],
        suggested_questions=[
            "Is the patient currently taking all prescribed medications?",
            "What was the exact allergy reaction to Penicillin?",
            "Has the chest discomfort changed in character or frequency?",
        ],
    )


def _mock_conflicts() -> ConflictResult:
    return ConflictResult(
        total_conflicts=1,
        conflicts=[
            ConflictItem(
                id="conflict_001",
                conflict_type="medication_dose",
                field="Amlodipine strength",
                value_a="5 mg",
                source_a="Prescription dated 2026-02-10",
                value_b="10 mg",
                source_b="Handwritten prescription dated 2026-08-03",
                description="Amlodipine appears with two different strengths in different documents.",
                severity="HIGH",
            )
        ],
    )


def _mock_missing_info() -> MissingInfoResult:
    items = [
        MissingInfoItem(id="m1", category="allergy", description="Allergy reaction type not documented for Penicillin", importance="HIGH", suggested_action="Ask patient about allergy reaction symptoms"),
        MissingInfoItem(id="m2", category="medication", description="Current medication adherence not recorded", importance="MODERATE", suggested_action="Confirm patient is taking all medications as prescribed"),
        MissingInfoItem(id="m3", category="symptom", description="Exact onset date of chest discomfort unavailable", importance="MODERATE", suggested_action="Ask patient when symptoms began precisely"),
        MissingInfoItem(id="m4", category="lab", description="Recent renal function panel not available", importance="HIGH", suggested_action="Order updated creatinine and eGFR given Metformin use"),
    ]
    return MissingInfoResult(total_missing=len(items), items=items)
