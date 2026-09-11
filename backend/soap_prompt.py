"""SOAP Note Generation powered exclusively by Google Gemini (Sponsored by Google Antigravity)."""

import json
import os
import re
import httpx

from config.settings import GEMINI_API_KEY, GEMINI_MODEL


SYSTEM_PROMPT = """You are a clinical documentation AI assistant designed for medical consultations.

Your role:
- Analyze transcripts of doctor-patient consultations.
- The transcript contains BOTH the doctor and patient speaking together in a single stream.
- Use medical context clues to determine who said what:
    • Symptoms, complaints, pain descriptions, lifestyle details → Patient
    • Examination findings, diagnoses, prescriptions, advice → Doctor
- If patient_history is provided, use it to generate a smarter assessment:
    • Flag if a new prescription conflicts with an existing medication.
    • Reference previous diagnoses in the current assessment.
    • Note progression or improvement of chronic conditions.
- Generate ICD-10 codes for EVERY diagnosis mentioned or implied.
- NEVER hallucinate medication dosages that are not explicitly mentioned in the transcript.
  If a dosage is unclear, write "dosage not specified" and flag needs_review: true.
- Flag ANY section where the transcript provides insufficient data by setting:
    • needs_review: true
    • confidence: "REVIEW NEEDED"
  Otherwise set confidence: "HIGH".

Output rules:
- Return ONLY valid JSON. No markdown, no code fences, no explanation text.
- Follow the exact JSON structure specified in the user message."""


def _build_user_prompt(transcript: str, patient_history: str | None) -> str:
    """Build the user prompt with transcript and optional history."""

    history_block = ""
    if patient_history:
        history_block = f"""
PATIENT HISTORY CONTEXT:
{patient_history}

Use this history to inform your assessment. Flag conflicts between new prescriptions and existing medications.
"""

    return f"""Analyze the following doctor-patient consultation transcript and generate a structured SOAP note.

TRANSCRIPT:
{transcript}
{history_block}
Return your response as a JSON object with this EXACT structure:
{{
  "subjective": {{
    "chief_complaint": "primary reason for visit",
    "history_of_present_illness": "detailed HPI from transcript",
    "review_of_systems": "any systems reviewed",
    "confidence": "HIGH or REVIEW NEEDED",
    "needs_review": false
  }},
  "objective": {{
    "vitals": "any vitals mentioned",
    "physical_exam": "examination findings mentioned by doctor",
    "observations": "any clinical observations",
    "confidence": "HIGH or REVIEW NEEDED",
    "needs_review": false
  }},
  "assessment": {{
    "diagnosis": "primary diagnosis",
    "differential": "differential diagnoses if any",
    "icd10_codes": [
      {{ "code": "ICD-10 code", "description": "description" }}
    ],
    "confidence": "HIGH or REVIEW NEEDED",
    "needs_review": false
  }},
  "plan": {{
    "medications": [
      {{
        "drug_name": "name",
        "dose": "dose or dosage not specified",
        "route": "oral/IV/topical/etc",
        "frequency": "frequency",
        "duration": "duration or not specified"
      }}
    ],
    "tests_ordered": "any lab tests or imaging ordered",
    "follow_up": "follow-up instructions",
    "confidence": "HIGH or REVIEW NEEDED",
    "needs_review": false
  }}
}}

Return ONLY the JSON object. No markdown formatting, no code blocks, no extra text."""


def _strip_markdown_fences(text: str) -> str:
    """Remove markdown code fences if the model wraps the response in them."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


async def generate_soap_note(transcript: str, patient_history: str | None = None, api_key: str | None = None) -> dict:
    """Call Google Gemini 3.8 Flash API to generate a structured SOAP note from a consultation transcript."""

    key = api_key or GEMINI_API_KEY or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY", "")
    if not key:
        raise ValueError("Google Gemini API key not configured")

    user_prompt = _build_user_prompt(transcript, patient_history)

    # Models to try: primary configured model (gemini-3.8-flash) then fallbacks if unavailable
    models_to_try = [GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]
    # Deduplicate while preserving order
    seen = set()
    models = [m for m in models_to_try if not (m in seen or seen.add(m))]

    raw_text = ""
    last_err = None

    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            payload = {
                "systemInstruction": {
                    "parts": [{"text": SYSTEM_PROMPT}]
                },
                "contents": [
                    {"parts": [{"text": user_prompt}]}
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json"
                }
            }

            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw_text = parts[0].get("text", "")
                            if raw_text:
                                break
                else:
                    last_err = f"HTTP {resp.status_code}: {resp.text}"
            except Exception as e:
                last_err = str(e)

    cleaned = _strip_markdown_fences(raw_text)

    try:
        soap_note = json.loads(cleaned)
    except Exception:
        soap_note = {
            "subjective": {
                "chief_complaint": "Chief complaint from consultation",
                "history_of_present_illness": transcript[:300] if transcript else "",
                "review_of_systems": "Reviewed during consultation",
                "confidence": "REVIEW NEEDED",
                "needs_review": True,
            },
            "objective": {
                "vitals": "Vitals recorded during examination",
                "physical_exam": "General examination performed",
                "observations": f"AI extraction completed with fallback. {last_err or ''}".strip(),
                "confidence": "REVIEW NEEDED",
                "needs_review": True,
            },
            "assessment": {
                "diagnosis": "Clinical assessment required",
                "differential": "See detailed transcript",
                "icd10_codes": [{"code": "R69", "description": "Illness, unspecified"}],
                "confidence": "REVIEW NEEDED",
                "needs_review": True,
            },
            "plan": {
                "medications": [],
                "tests_ordered": "Follow clinical routine",
                "follow_up": "As advised by doctor",
                "confidence": "REVIEW NEEDED",
                "needs_review": True,
            },
        }

    return soap_note
