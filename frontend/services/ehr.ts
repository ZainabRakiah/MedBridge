import type { Patient, Consultation } from "@/context/AppContext";

const STORAGE_KEY = "aushadh_patients";

function loadPatients(): Patient[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function savePatients(patients: Patient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export function getAllPatients(): Patient[] {
  return loadPatients();
}

export function getPatientById(id: string): Patient | undefined {
  return loadPatients().find((p) => p.id === id);
}

export function searchPatients(query: string): Patient[] {
  const q = query.toLowerCase();
  return loadPatients().filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.id.includes(q)
  );
}

export function createPatient(data: {
  name: string;
  age: string;
  gender: string;
  phone: string;
  allergies: string;
  chronic_conditions: string;
}): Patient {
  const patient: Patient = {
    id: `PAT-${Date.now()}`,
    name: data.name,
    date_of_birth: "",
    age: data.age,
    sex: data.gender,
    gender: data.gender,
    phone: data.phone,
    blood_group: "",
    allergies: data.allergies
      ? data.allergies.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    conditions: data.chronic_conditions
      ? data.chronic_conditions.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    chronic_conditions: data.chronic_conditions,
    medications: [],
    timeline: [],
    documents: [],
    safety_flags: [],
    conflicts: [],
    missing_info: [],
    clinical_summary: null,
    triage_card: null,
    consultations: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const patients = loadPatients();
  patients.push(patient);
  savePatients(patients);
  return patient;
}

export function addConsultationToPatient(
  patientId: string,
  consultation: Consultation
): void {
  const patients = loadPatients();
  const idx = patients.findIndex((p) => p.id === patientId);
  if (idx === -1) return;
  patients[idx].consultations.push(consultation);
  savePatients(patients);
}

export function updateConsultation(
  patientId: string,
  consultationId: string,
  updates: Partial<Consultation>
): void {
  const patients = loadPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) return;
  const cIdx = patient.consultations.findIndex((c) => c.id === consultationId);
  if (cIdx === -1) return;
  patient.consultations[cIdx] = { ...patient.consultations[cIdx], ...updates };
  savePatients(patients);
}

export function getPatientHistory(patientId: string): string {
  const patient = getPatientById(patientId);
  if (!patient || patient.consultations.length === 0) return "";

  const lines: string[] = [];

  if (patient.allergies) {
    lines.push(`Known Allergies: ${patient.allergies}`);
  }
  if (patient.chronic_conditions) {
    lines.push(`Chronic Conditions: ${patient.chronic_conditions}`);
  }

  // Include last 3 consultations as context
  const recent = patient.consultations.slice(-3);
  for (const c of recent) {
    lines.push(`\n--- Previous Visit: ${c.date} ---`);
    if (c.soap_note) {
      const note = c.soap_note;
      if (note.assessment?.diagnosis) {
        lines.push(`Diagnosis: ${note.assessment.diagnosis}`);
      }
      const meds = note.plan?.medications || [];
      if (meds.length > 0) {
        lines.push(
          `Medications: ${meds.map((m) => `${m.drug_name} ${m.dose}`).join(", ")}`
        );
      }
    }
  }

  return lines.join("\n");
}

export function deletePatient(patientId: string): void {
  const patients = loadPatients().filter((p) => p.id !== patientId);
  savePatients(patients);
}
