/**
 * MedBridge — API service layer
 * All calls to the FastAPI backend go through this module.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || "";
    } catch {}
    throw new ApiError(`API Error ${res.status}`, res.status, detail || res.statusText);
  }

  return res.json() as Promise<T>;
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function checkHealth() {
  return request<{
    status: string;
    service: string;
    provider?: string;
    model?: string;
    whisper: boolean;
    gemini: boolean;
  }>("/health");
}

// ── Transcription ─────────────────────────────────────────────────────────────

export async function transcribeAudio(file: File | Blob) {
  const form = new FormData();
  form.append("file", file, (file as File).name || "audio.webm");
  const res = await fetch(`${API_BASE}/transcribe`, { method: "POST", body: form });
  if (!res.ok) throw new ApiError("Transcription failed", res.status);
  return res.json() as Promise<{ transcript: string; language: string; duration: number }>;
}

// ── SOAP Note ─────────────────────────────────────────────────────────────────

export async function generateSoapNote(transcript: string, patientHistory?: string) {
  return request<Record<string, unknown>>("/generate-note", {
    method: "POST",
    body: JSON.stringify({ transcript, patient_history: patientHistory }),
  });
}

// ── Document Extraction ───────────────────────────────────────────────────────

export async function extractDocument(file: File, patientId: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("patient_id", patientId);
  const res = await fetch(`${API_BASE}/api/documents/extract`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || "Extraction failed", res.status);
  }
  return res.json();
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export async function generateTimeline(patientId: string, documents: unknown[]) {
  return request<unknown[]>("/api/patient/timeline", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, documents }),
  });
}

export async function extractVoiceSymptoms(patientId: string, statement: string) {
  return request<unknown[]>("/api/patient/voice-symptom", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, statement }),
  });
}

// ── Medication Safety ─────────────────────────────────────────────────────────

export async function checkMedicationSafety(medications: unknown[], allergies: string[]) {
  return request<{ status: string; flags: unknown[]; checked_medications: string[]; checked_allergies: string[] }>(
    "/api/medications/check",
    {
      method: "POST",
      body: JSON.stringify({ medications, allergies }),
    }
  );
}

export async function checkLegacyInteractions(medications: string[]) {
  return request<{ interactions: unknown[]; checked: boolean }>("/check-interactions", {
    method: "POST",
    body: JSON.stringify({ medications }),
  });
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export async function detectConflicts(patient: unknown) {
  return request<{ total_conflicts: number; conflicts: unknown[] }>("/api/triage/analyze/conflicts", {
    method: "POST",
    body: JSON.stringify({ patient }),
  });
}

export async function detectMissingInfo(patient: unknown) {
  return request<{ total_missing: number; items: unknown[] }>("/api/triage/analyze/missing", {
    method: "POST",
    body: JSON.stringify({ patient }),
  });
}

export async function generateClinicalSummary(patient: unknown) {
  return request<Record<string, unknown>>("/api/triage/analyze/summary", {
    method: "POST",
    body: JSON.stringify({ patient }),
  });
}

// ── Triage + QR ───────────────────────────────────────────────────────────────

export async function generateTriageCard(patient: unknown) {
  return request<Record<string, unknown>>("/api/triage/generate", {
    method: "POST",
    body: JSON.stringify(patient),
  });
}

export async function generateQRCode(triageCard: unknown) {
  return request<{ token: string; expires_at: string; record_id: string; qr_image_base64: string }>(
    "/api/triage/qr",
    {
      method: "POST",
      body: JSON.stringify(triageCard),
    }
  );
}

// ── FHIR ──────────────────────────────────────────────────────────────────────

export async function exportFhirBundle(patient: unknown): Promise<string> {
  const res = await fetch(`${API_BASE}/api/fhir/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patient),
  });
  if (!res.ok) throw new ApiError("FHIR export failed", res.status);
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}

// ── PDF Export ────────────────────────────────────────────────────────────────

export async function exportPdf(soapNote: unknown, patientInfo: unknown): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soap_note: soapNote, patient_info: patientInfo }),
  });
  if (!res.ok) throw new ApiError("PDF export failed", res.status);
  return res.blob();
}

// ── Referral ──────────────────────────────────────────────────────────────────

export async function generateReferral(patient: unknown, reason: string) {
  return request<Record<string, unknown>>("/api/referral/generate", {
    method: "POST",
    body: JSON.stringify({ patient, reason }),
  });
}
