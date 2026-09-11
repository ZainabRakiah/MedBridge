"""MedBridge — FastAPI Backend

Extends the original Aushadh AI Medical Scribe with:
- Medical document extraction (Gemini multimodal)
- Patient timeline generation
- Conflict detection
- Missing information engine
- Medication safety bridge
- Emergency triage card + QR
- Expanded FHIR R4 Bundle export
- Referral generation

Original scribe features (transcription, SOAP, PDF export) are preserved.
"""

import os
import tempfile
from datetime import datetime
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

# Original modules (preserved)
from soap_prompt import generate_soap_note
from pdf_generator import generate_pdf
from fhir_template import build_fhir_composition

# New MedBridge modules
from api.documents import router as documents_router
from api.timeline import router as timeline_router
from api.triage import router as triage_router
from api.fhir import router as fhir_router
from api.referral import router as referral_router
from api.medications import router as medications_router
from config.settings import ALLOWED_ORIGINS

load_dotenv()

# ── Globals ──
whisper_model = None


def _load_whisper_background():
    global whisper_model
    try:
        from faster_whisper import WhisperModel
        whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    except Exception as e:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Instant startup for MedBridge API (Google Gemini 3.8 Flash native)."""
    import threading
    threading.Thread(target=_load_whisper_background, daemon=True).start()
    yield


app = FastAPI(
    title="MedBridge API",
    description="AI-powered medical history bridge. Transforms fragmented patient records into verified clinical context.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount new MedBridge routers ──
app.include_router(documents_router)
app.include_router(timeline_router)
app.include_router(triage_router)
app.include_router(fhir_router)
app.include_router(referral_router)
app.include_router(medications_router)


# ── Pydantic models (original) ───────────────────────────────────────────────

class GenerateNoteRequest(BaseModel):
    transcript: str
    patient_history: str | None = None


class CheckInteractionsRequest(BaseModel):
    medications: list[str]


class PatientInfo(BaseModel):
    patient_name: str
    age: str
    gender: str
    doctor_name: str


class ExportPDFRequest(BaseModel):
    soap_note: dict
    patient_info: PatientInfo


class ExportFHIRRequest(BaseModel):
    soap_note: dict
    patient_info: PatientInfo


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Health Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from config.settings import GEMINI_API_KEY, GEMINI_MODEL
    return {
        "status": "ok",
        "service": "MedBridge API",
        "provider": "Google Antigravity & Google Gemini",
        "version": "2.0.0",
        "model": GEMINI_MODEL,
        "gemini": bool(GEMINI_API_KEY),
        "whisper": whisper_model is not None,
        "disclaimer": "MedBridge is an AI clinical information tool. All AI-generated content requires clinician verification.",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Audio Transcription (Google Gemini 3.8 Flash + Whisper fallback)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Accept an audio file and return clinical transcription using Google Gemini."""
    from config.settings import GEMINI_API_KEY
    from services.gemini_service import transcribe_audio_gemini

    contents = await file.read()
    mime_type = file.content_type or "audio/webm"

    # 1. Primary: Google Gemini Native Audio Transcription
    if GEMINI_API_KEY:
        try:
            result = await transcribe_audio_gemini(contents, mime_type)
            if result and result.get("transcript"):
                return result
        except Exception:
            pass  # Fall back to local whisper if loaded

    # 2. Secondary fallback: Local Faster-Whisper
    if whisper_model is not None:
        suffix = os.path.splitext(file.filename or "audio.webm")[1]
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            tmp.write(contents)
            tmp.close()

            segments, info = whisper_model.transcribe(tmp.name, vad_filter=True)
            transcript_parts = [segment.text.strip() for segment in segments]
            transcript = " ".join(transcript_parts)

            return {
                "transcript": transcript,
                "language": info.language,
                "duration": round(info.duration, 2),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
        finally:
            if os.path.exists(tmp.name):
                os.unlink(tmp.name)

    raise HTTPException(status_code=500, detail="Transcription service unavailable (Gemini API key required)")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOAP Note Generation (Google Gemini 3.8 Flash)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/generate-note")
async def generate_note(request: GenerateNoteRequest):
    """Generate a structured SOAP note from a consultation transcript using Google Gemini 3.8 Flash."""
    from config.settings import GEMINI_API_KEY

    try:
        soap_note = await generate_soap_note(
            transcript=request.transcript,
            patient_history=request.patient_history,
            api_key=GEMINI_API_KEY,
        )
        return soap_note
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Note generation failed: {str(e)}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Drug Interaction Check (preserved, enhanced)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KNOWN_INTERACTIONS = [
    {"drugs": ["aspirin", "ibuprofen"], "severity": "HIGH", "description": "Increased risk of bleeding and reduced cardioprotective effect of aspirin. NSAIDs may antagonize antiplatelet activity."},
    {"drugs": ["aspirin", "warfarin"], "severity": "HIGH", "description": "Significantly increased bleeding risk. Combined anticoagulant and antiplatelet effect."},
    {"drugs": ["metformin", "alcohol"], "severity": "HIGH", "description": "Increased risk of lactic acidosis."},
    {"drugs": ["amlodipine", "simvastatin"], "severity": "MODERATE", "description": "Amlodipine may increase simvastatin levels, raising risk of myopathy."},
    {"drugs": ["warfarin", "paracetamol"], "severity": "MODERATE", "description": "Regular paracetamol use may enhance anticoagulant effect of warfarin."},
    {"drugs": ["aspirin", "naproxen"], "severity": "HIGH", "description": "NSAIDs may reduce cardioprotective effects of aspirin and increase GI bleeding risk."},
    {"drugs": ["ibuprofen", "warfarin"], "severity": "HIGH", "description": "Increased bleeding risk. NSAIDs inhibit platelet function and may displace warfarin."},
    {"drugs": ["metformin", "iodine"], "severity": "MODERATE", "description": "Risk of acute kidney injury and lactic acidosis with iodinated contrast media."},
    {"drugs": ["atorvastatin", "clarithromycin"], "severity": "HIGH", "description": "Clarithromycin inhibits statin metabolism, increasing risk of myopathy."},
    {"drugs": ["amlodipine", "clarithromycin"], "severity": "MODERATE", "description": "Clarithromycin may increase amlodipine levels causing hypotension."},
]


@app.post("/check-interactions")
async def check_interactions(request: CheckInteractionsRequest):
    """Check drug interactions using known interaction database + OpenFDA."""

    medications = request.medications
    interactions: list[dict] = []

    if len(medications) < 2:
        return {"interactions": [], "checked": True}

    med_lower = [m.lower().strip() for m in medications]

    for i in range(len(med_lower)):
        for j in range(i + 1, len(med_lower)):
            drug1 = med_lower[i]
            drug2 = med_lower[j]

            for known in KNOWN_INTERACTIONS:
                k_drugs = known["drugs"]
                if (drug1 in k_drugs[0] or k_drugs[0] in drug1) and \
                   (drug2 in k_drugs[1] or k_drugs[1] in drug2):
                    interactions.append({
                        "drug1": medications[i],
                        "drug2": medications[j],
                        "severity": known["severity"],
                        "description": known["description"],
                    })
                    break
                elif (drug2 in k_drugs[0] or k_drugs[0] in drug2) and \
                     (drug1 in k_drugs[1] or k_drugs[1] in drug1):
                    interactions.append({
                        "drug1": medications[i],
                        "drug2": medications[j],
                        "severity": known["severity"],
                        "description": known["description"],
                    })
                    break

    if not interactions:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for i in range(len(medications)):
                for j in range(i + 1, len(medications)):
                    drug1 = medications[i]
                    drug2 = medications[j]
                    try:
                        response = await client.get(
                            "https://api.fda.gov/drug/event.json",
                            params={
                                "search": f'patient.drug.medicinalproduct:"{drug1}"+AND+patient.drug.medicinalproduct:"{drug2}"',
                                "limit": 3,
                            },
                        )
                        if response.status_code == 200:
                            data = response.json()
                            results = data.get("results", [])
                            if results:
                                reactions = set()
                                for result in results:
                                    for reaction in result.get("patient", {}).get("reaction", []):
                                        term = reaction.get("reactionmeddrapt", "")
                                        if term:
                                            reactions.add(term)
                                if reactions:
                                    interactions.append({
                                        "drug1": drug1,
                                        "drug2": drug2,
                                        "severity": "MODERATE",
                                        "description": f"Reported adverse events: {', '.join(list(reactions)[:5])}",
                                    })
                    except Exception:
                        continue

    return {"interactions": interactions, "checked": True}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PDF Export (preserved)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/export-pdf")
async def export_pdf(request: ExportPDFRequest):
    """Generate a clinical PDF report."""
    try:
        patient_dict = request.patient_info.model_dump()
        pdf_bytes = generate_pdf(request.soap_note, patient_dict)

        safe_name = request.patient_info.patient_name.replace(" ", "_")
        date_str = datetime.now().strftime("%Y%m%d")
        filename = f"medbridge_{safe_name}_{date_str}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Legacy FHIR Composition Export (preserved for backward compat)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/export-fhir")
async def export_fhir_legacy(request: ExportFHIRRequest):
    """Generate a FHIR R4 Composition resource from a SOAP note (legacy endpoint)."""
    try:
        patient_dict = request.patient_info.model_dump()
        fhir_resource = build_fhir_composition(request.soap_note, patient_dict)
        return fhir_resource
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FHIR export failed: {str(e)}")
