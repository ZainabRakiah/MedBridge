# MedBridge — AI Medical Scribe & Medical History Bridge

> **Transform messy, fragmented medical information into structured, reviewable, actionable patient context.**  
> *Sponsored by **Google Antigravity** — Exclusively powered by **Google Gemini 3.8 Flash**.*  
> **Repository:** https://github.com/ZainabRakiah/MedBridge.git

---

## 🏥 Product Overview

**MedBridge** is an AI-powered clinical information assistant that bridges fragmented patient medical records across doctors, hospitals, and consultations.

Patients often present with messy piles of discharge summaries, paper prescriptions, lab reports, and verbal symptom explanations. MedBridge intakes these heterogeneous sources, extracts structured clinical data with confidence scoring and source tracing, reconciles conflicting medication and allergy history, and generates actionable outputs for doctors and emergency triage teams.

---

## ⚡ What Does Each Core Feature Do?

### 1. 🚨 Emergency Triage Card (`/triage`)
- **What is Triage doing?** In emergency and triage settings, clinicians have only seconds to identify life-critical risks before administering treatment.
- **Critical Risk Synthesis:** Triage pulls the patient's most critical medical facts into a single, high-contrast, distraction-free view:
  - **Severe Allergies:** Immediate red flags (e.g. Penicillin allergy).
  - **Active Medications & Dosages:** Prevents administering contraindicated drugs.
  - **High-Risk Conditions:** Flags cardiovascular risk, diabetes, bleeding risk, and renal status.
  - **Critical Warnings:** Highlights abnormal vitals or lab extremes (e.g. severe anemia, high HbA1c).
- **Offline-Readable QR Code:** Generates a signed, self-contained Base64 QR code. First responders, paramedics, or triage nurses can scan the QR code on an emergency smartphone or tablet **without requiring an internet connection, VPN, or EHR database login**.

### 2. ⏳ Patient Timeline & Rebuild Option (`/timeline`)
- **What is Rebuild doing?** As new records are ingested (discharge summaries, prescriptions, lab results, or consultation transcripts), patient events become fragmented.
- **Chronological Synthesis:** Clicking **"Rebuild Timeline"** re-analyzes all clinical records, normalizes dates, deduplicates events, and re-orders the patient's journey chronologically (diagnoses, hospital discharges, medication start/change dates, abnormal lab results, and verbal symptoms).
- **Voice Symptom Intake:** Patients can speak or enter their symptom descriptions, which Google Gemini 3.8 Flash extracts into structured clinical symptom events.

### 3. 💊 Medication Reconciliation & Safety (`/medications`)
- Identifies **active, stopped, and changed** medications across past prescriptions.
- Detects **contradictions and conflicts** (e.g., patient discharged on Metformin vs. prescribed Glimepiride).
- Cross-checks drug-drug interactions via OpenFDA and Google Gemini clinical reasoning.

### 4. 📋 Clinical Summary & Missing Info Checklist (`/summary`)
- Synthesizes patient context for physicians before a visit.
- Surfaces an interactive **Missing Information Checklist** alerting doctors to unverified data (e.g. allergy reaction type, unconfirmed dosages).

### 5. 🎙️ AI Medical Scribe (`/consultation`)
- Listens to real-time doctor-patient conversations.
- Powered exclusively by **Google Gemini 3.8 Flash** to transcribe audio, generate structured SOAP notes, recommend ICD-10 billing codes, and export prescription PDFs.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **AI Foundation** | **Google Gemini 3.8 Flash exclusively** (Multimodal Vision, Audio Transcription, Clinical Synthesis, SOAP Generation) |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Universal Inter Typography, Lucide Icons |
| **State & Storage** | React Context (`AppContext`) with `localStorage` persistence & instant offline recovery |
| **Backend API** | FastAPI (Python 3.11+), Pydantic v2, Uvicorn, HTTPX |
| **Drug Safety** | OpenFDA API with fallback rules-based safety database |
| **Standards & Export** | HL7 FHIR R4 JSON Bundles, ReportLab PDF generation, QRCode (Pillow) |

---

## 🌐 Deploying on Vercel (1 Single Link for Judges)

MedBridge is pre-configured for **seamless 1-link deployment on Vercel**. Hackathon judges can access the entire application from a single URL (`https://your-medbridge.vercel.app`) without needing to install, configure, or run any backend servers locally.

### 🚀 1-Click Deployment Instructions

1. Go to **[vercel.com](https://vercel.com)** and log in with your GitHub account.
2. Click **"Add New..."** → **"Project"**.
3. Import your MedBridge repository: `https://github.com/ZainabRakiah/MedBridge.git`.
4. Leave the default settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `./` (or `frontend` — both are automatically supported!)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
5. *(Optional)* Under **Environment Variables**, add:
   - `NEXT_PUBLIC_GEMINI_API_KEY`: `your_gemini_api_key`
6. Click **Deploy**!
7. Within ~60 seconds, Vercel gives you your production URL (e.g. `https://medbridge-demo.vercel.app`). Share this **1 single link** directly with hackathon judges!

> **💡 How the 1-Link Architecture Works:**  
> MedBridge features automatic **standalone clinical intelligence & resilience**. Every feature (SOAP generation, medication safety, triage QR codes, timeline reconciliation, missing info checklists, FHIR & PDF exports) operates self-sufficiently within Next.js on Vercel, with built-in reverse proxy rewrites (`next.config.js`) ready to route to a live backend if `BACKEND_URL` is configured.

---

## 🚀 Running the Project Locally (Step-by-Step Guide)

To run MedBridge on your machine, open **two terminal windows**:

### Terminal 1 — Start the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Activate the Python virtual environment:
   ```bash
   source venv/bin/activate    # On Windows: venv\Scripts\activate
   ```
3. Set your Google Gemini API key in `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Ensure `GOOGLE_GENERATIVE_AI_API_KEY` is set to your Gemini API key)*
4. Launch the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
5. **Verify:** Open your browser to:
   - Health check: `http://localhost:8000/health`
   - Interactive API docs: `http://localhost:8000/docs`

---

### Terminal 2 — Start the Frontend

1. In a new terminal tab, navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Start the Next.js development server:
   ```bash
   npm run dev
   ```
3. **Verify:** Open your browser to:
   - **`http://localhost:3000`**

---

## 👤 Pre-Loaded Synthetic Demo Patient — Aarav Sharma

MedBridge comes pre-loaded with synthetic patient **Aarav Sharma**:
- **Patient:** Aarav Sharma (54M, Type 2 Diabetes, Hypertension)
- **Built-in Intentional Conflict:**
  - Discharge summary shows *Metformin 500mg BD*
  - Recent prescription shows *Glimepiride 2mg OD*
  - Patient reports stopped Metformin due to GI intolerance
  - System flags the medication conflict for doctor resolution!
- **Built-in Safety Alert:**
  - Penicillin allergy listed without reaction type (flagged in Missing Information checklist)
  - High HbA1c (7.8%) and low Hemoglobin (10.2 g/dL) in lab investigations
- **Explore:** Navigate directly to `/documents`, `/timeline`, `/medications`, `/summary`, or `/triage`.

---

## 🔌 API Endpoints Summary

| Method | Path | Description | Powered By |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/documents/upload` | Upload medical document for multimodal OCR & structured extraction | **Google Gemini 3.8 Flash** |
| `POST` | `/api/timeline/generate` | Generate unified chronological timeline from documents & history | **Google Gemini 3.8 Flash** |
| `POST` | `/api/timeline/extract-voice` | Extract timeline symptoms from patient verbal recording | **Google Gemini 3.8 Flash** |
| `POST` | `/api/safety/check-medications` | Reconcile active meds, check drug-drug interactions & allergy flags | OpenFDA + **Google Gemini** |
| `POST` | `/api/summary/generate` | Generate synthesized clinical summary with conflict & missing info detection | **Google Gemini 3.8 Flash** |
| `POST` | `/api/triage/generate` | Build emergency triage card with critical alerts & precautions | **Google Gemini 3.8 Flash** |
| `POST` | `/api/triage/qr-code` | Generate Base64 offline QR code for triage card | QRCode (Pillow) |
| `POST` | `/api/fhir/export` | Export patient record as FHIR R4 Bundle | HL7 FHIR R4 |
| `POST` | `/api/referral/generate` | Draft specialist referral note from patient context | **Google Gemini 3.8 Flash** |
| `POST` | `/transcribe` | Transcribe consultation audio | **Google Gemini 3.8 Flash** |
| `POST` | `/generate-note` | Generate structured SOAP notes from consultation transcript | **Google Gemini 3.8 Flash** |
| `POST` | `/check-interactions` | Check legacy medication list against OpenFDA | OpenFDA API |
| `POST` | `/export-pdf` | Download print-ready prescription PDF | ReportLab |
