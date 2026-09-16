"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Medication {
  name: string;
  generic_name: string;
  strength: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  status: "active" | "stopped" | "changed";
  source: string;
  confidence: number;
  verification_status:
    | "unverified"
    | "review_required"
    | "clinician_verified"
    | "patient_reported"
    | "source_confirmed"
    | "rejected";
}

export interface ExtractedLabResult {
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  flag: string;
}

export interface ExtractedData {
  document_type: string;
  patient_name: string;
  document_date: string;
  doctor: string;
  hospital: string;
  diagnoses: string[];
  medications: Medication[];
  allergies: string[];
  symptoms: string[];
  lab_results: ExtractedLabResult[];
  procedures: string[];
  follow_up: string[];
  warnings: string[];
  confidence: number;
  raw_text: string;
}

export interface MedicalDocument {
  id: string;
  patient_id: string;
  type: string;
  filename: string;
  date: string;
  source: string;
  extracted_data: ExtractedData;
  confidence: number;
  verification_status: string;
  uploaded_at: string;
}

export interface TimelineEvent {
  id: string;
  patient_id: string;
  date: string;
  event_type: string;
  description: string;
  source_document_id: string;
  source_type: string;
  confidence: number;
  verification_status: string;
  metadata: Record<string, unknown>;
}

export interface SafetyFlag {
  id: string;
  flag_type?: string;
  severity: "HIGH" | "MODERATE" | "LOW";
  title?: string;
  drug1?: string;
  drug2?: string;
  description: string;
  action?: string;
  source?: string;
  requires_verification?: boolean;
}

export interface ConflictItem {
  id: string;
  conflict_type: string;
  field: string;
  value_a: string;
  source_a: string;
  value_b: string;
  source_b: string;
  description: string;
  severity: string;
}

export interface MissingInfoItem {
  id: string;
  category: string;
  description: string;
  importance: "HIGH" | "MODERATE" | "LOW";
  suggested_action: string;
}

export interface ClinicalSummary {
  patient_overview: string;
  current_complaint: string;
  relevant_history: string[];
  current_medications: Medication[];
  allergies: string[];
  recent_investigations: string[];
  missing_information: string[];
  ai_flags: string[];
  suggested_questions: string[];
  generated_at: string;
}

export interface TriageCard {
  id: string;
  patient_id: string;
  patient_name: string;
  blood_group: string;
  allergies: string[];
  current_medications: string[];
  known_conditions: string[];
  recent_procedures: string[];
  current_symptoms: string;
  critical_warnings: string[];
  emergency_contacts: string[];
  ai_flags: string[];
  last_updated: string;
}

// Existing types from Aushadh (preserved)
export interface Consultation {
  id: string;
  date: string;
  transcript: string;
  soap_note: SOAPNote | null;
  audio_duration: number;
}

export interface SOAPNote {
  subjective: {
    chief_complaint: string;
    history_of_present_illness: string;
    review_of_systems: string;
    confidence: string;
    needs_review: boolean;
  };
  objective: {
    vitals: string;
    physical_exam: string;
    observations: string;
    confidence: string;
    needs_review: boolean;
  };
  assessment: {
    diagnosis: string;
    differential: string;
    icd10_codes: { code: string; description: string }[];
    confidence: string;
    needs_review: boolean;
  };
  plan: {
    medications: {
      drug_name: string;
      dose: string;
      route: string;
      frequency: string;
      duration: string;
    }[];
    tests_ordered: string;
    follow_up: string;
    confidence: string;
    needs_review: boolean;
  };
}

// ── Extended Patient type ─────────────────────────────────────────────────────

export interface Patient {
  id: string;
  name: string;
  date_of_birth: string;
  age: string;
  sex: string;
  gender: string;
  phone: string;
  blood_group: string;
  allergies: string[];
  conditions: string[];
  medications: Medication[];
  timeline: TimelineEvent[];
  documents: MedicalDocument[];
  safety_flags: SafetyFlag[];
  conflicts: ConflictItem[];
  missing_info: MissingInfoItem[];
  clinical_summary: ClinicalSummary | null;
  triage_card: TriageCard | null;
  consultations: Consultation[];
  created_at: string;
  updated_at: string;
  chronic_conditions?: string;
  allergies_text?: string;
}

// ── Context type ──────────────────────────────────────────────────────────────

interface AppContextType {
  // Patient state
  patients: Patient[];
  currentPatient: Patient | null;
  setCurrentPatient: (patient: Patient | null) => void;
  addPatient: (patient: Patient) => void;
  updatePatient: (patient: Patient) => void;
  deletePatient: (patientId: string) => void;
  searchPatients: (query: string) => Patient[];

  // Document management
  addDocument: (patientId: string, doc: MedicalDocument) => void;
  updatePatientTimeline: (patientId: string, events: TimelineEvent[]) => void;
  updatePatientSafetyFlags: (patientId: string, flags: SafetyFlag[]) => void;
  updatePatientConflicts: (patientId: string, conflicts: ConflictItem[]) => void;
  updatePatientMissingInfo: (patientId: string, items: MissingInfoItem[]) => void;
  updateClinicalSummary: (patientId: string, summary: ClinicalSummary) => void;
  updateTriageCard: (patientId: string, card: TriageCard) => void;

  // Consultation state (preserved from Aushadh)
  currentConsultation: Consultation | null;
  setCurrentConsultation: (consultation: Consultation | null) => void;
  addConsultation: (patientId: string, consultation: Consultation) => void;

  // UI state
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
  doctorName: string;
  setDoctorName: (name: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = "medbridge_patients";
const DOCTOR_KEY = "medbridge_doctor";

export function createEmptyPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: `patient_${Date.now()}`,
    name: "",
    date_of_birth: "",
    age: "",
    sex: "",
    gender: "",
    phone: "",
    blood_group: "",
    allergies: [],
    conditions: [],
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
    ...overrides,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentConsultation, setCurrentConsultation] = useState<Consultation | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [doctorName, setDoctorName] = useState("Doctor");

  const ACTIVE_PATIENT_KEY = "medbridge_active_patient_id";

  const handleSetCurrentPatient = useCallback((patient: Patient | null) => {
    setCurrentPatient(patient);
    if (patient?.id) {
      localStorage.setItem(ACTIVE_PATIENT_KEY, patient.id);
    } else {
      localStorage.removeItem(ACTIVE_PATIENT_KEY);
    }
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("aushadh_patients");
    if (stored) {
      try {
        const parsed: Patient[] = JSON.parse(stored);
        // Deduplicate patients by normalized name, keeping the one with most complete data
        const seenNames = new Map<string, Patient>();
        for (const p of parsed) {
          const key = (p.name || "").trim().toLowerCase();
          if (!key) continue;
          if (!seenNames.has(key)) {
            seenNames.set(key, p);
          } else {
            const existing = seenNames.get(key)!;
            const existingScore =
              (existing.documents?.length || 0) * 10 +
              (existing.timeline?.length || 0) * 5 +
              (existing.medications?.length || 0) * 2;
            const currentScore =
              (p.documents?.length || 0) * 10 +
              (p.timeline?.length || 0) * 5 +
              (p.medications?.length || 0) * 2;
            if (currentScore >= existingScore) {
              seenNames.set(key, p);
            }
          }
        }
        const deduped = Array.from(seenNames.values()).map((p) => ({
          ...createEmptyPatient(),
          ...p,
          documents: Array.isArray(p.documents) ? p.documents : [],
          timeline: Array.isArray(p.timeline) ? p.timeline : [],
          medications: Array.isArray(p.medications) ? p.medications : [],
          allergies: Array.isArray(p.allergies) ? p.allergies : [],
          conditions: Array.isArray(p.conditions) ? p.conditions : [],
          safety_flags: Array.isArray(p.safety_flags) ? p.safety_flags : [],
          conflicts: Array.isArray(p.conflicts) ? p.conflicts : [],
          missing_info: Array.isArray(p.missing_info) ? p.missing_info : [],
          consultations: Array.isArray(p.consultations) ? p.consultations : [],
        }));
        setPatients(deduped);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
        localStorage.setItem("aushadh_patients", JSON.stringify(deduped));

        const savedActiveId = localStorage.getItem(ACTIVE_PATIENT_KEY);
        const active = deduped.find((p) => p.id === savedActiveId) || deduped[0] || null;
        setCurrentPatient(active);
      } catch {
        setPatients([]);
      }
    }
    const doc = localStorage.getItem(DOCTOR_KEY);
    if (doc) setDoctorName(doc);
  }, []);

  // Persist patients to localStorage on change
  useEffect(() => {
    if (patients.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
      localStorage.setItem("aushadh_patients", JSON.stringify(patients));
    }
  }, [patients]);

  useEffect(() => {
    localStorage.setItem(DOCTOR_KEY, doctorName);
  }, [doctorName]);

  const addPatient = useCallback((patient: Patient) => {
    const safePatient: Patient = {
      ...createEmptyPatient(),
      ...patient,
      documents: Array.isArray(patient.documents) ? patient.documents : [],
      timeline: Array.isArray(patient.timeline) ? patient.timeline : [],
      medications: Array.isArray(patient.medications) ? patient.medications : [],
      allergies: Array.isArray(patient.allergies) ? patient.allergies : [],
      conditions: Array.isArray(patient.conditions) ? patient.conditions : [],
    };
    setPatients((prev) => {
      const normName = (safePatient.name || "").trim().toLowerCase();
      const existingIdx = prev.findIndex((p) => (p.name || "").trim().toLowerCase() === normName);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...safePatient };
        return updated;
      }
      return [...prev, safePatient];
    });
  }, []);

  const deletePatient = useCallback((patientId: string) => {
    setPatients((prev) => {
      const updated = prev.filter((p) => p.id !== patientId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    setCurrentPatient((prev) => {
      if (prev?.id === patientId) {
        return null;
      }
      return prev;
    });
  }, []);

  const updatePatient = useCallback((updated: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, updated_at: new Date().toISOString() } : p)));
    setCurrentPatient((prev) => (prev?.id === updated.id ? { ...updated, updated_at: new Date().toISOString() } : prev));
  }, []);

  const searchPatients = useCallback(
    (query: string) => {
      const q = (query || "").toLowerCase();
      return patients.filter(
        (p) =>
          (p?.name || "").toLowerCase().includes(q) ||
          (p?.phone || "").includes(q) ||
          (p?.id || "").includes(q)
      );
    },
    [patients]
  );

  const addDocument = useCallback((patientId: string, doc: MedicalDocument) => {
    const safeDoc: MedicalDocument = {
      ...doc,
      extracted_data: {
        document_type: doc.extracted_data?.document_type || doc.type || "document",
        patient_name: doc.extracted_data?.patient_name || "Patient",
        document_date: doc.extracted_data?.document_date || doc.date || new Date().toISOString().split("T")[0],
        doctor: doc.extracted_data?.doctor || "Attending Physician",
        hospital: doc.extracted_data?.hospital || "Clinical Facility",
        diagnoses: Array.isArray(doc.extracted_data?.diagnoses) ? doc.extracted_data.diagnoses : [],
        medications: Array.isArray(doc.extracted_data?.medications) ? doc.extracted_data.medications : [],
        allergies: Array.isArray(doc.extracted_data?.allergies) ? doc.extracted_data.allergies : [],
        symptoms: Array.isArray(doc.extracted_data?.symptoms) ? doc.extracted_data.symptoms : [],
        lab_results: Array.isArray(doc.extracted_data?.lab_results) ? doc.extracted_data.lab_results : [],
        procedures: Array.isArray(doc.extracted_data?.procedures) ? doc.extracted_data.procedures : [],
        follow_up: Array.isArray(doc.extracted_data?.follow_up) ? doc.extracted_data.follow_up : [],
        warnings: Array.isArray(doc.extracted_data?.warnings) ? doc.extracted_data.warnings : [],
        confidence: typeof doc.extracted_data?.confidence === "number" ? doc.extracted_data.confidence : (doc.confidence || 0.94),
        raw_text: doc.extracted_data?.raw_text || "",
      },
    };

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          const ext = safeDoc.extracted_data;
          const newAllergies = Array.from(new Set([...(p.allergies || []), ...ext.allergies]));
          const newConditions = Array.from(new Set([...(p.conditions || []), ...ext.diagnoses]));
          const newMeds = [...(p.medications || [])];
          for (const med of ext.medications) {
            if (med?.name && !newMeds.find((m) => m?.name && m.name.toLowerCase() === med.name.toLowerCase())) {
              newMeds.push(med);
            }
          }
          const updatedPatient = {
            ...p,
            documents: [...(p.documents || []), safeDoc],
            allergies: newAllergies,
            conditions: newConditions,
            medications: newMeds,
            updated_at: new Date().toISOString(),
          };
          return updatedPatient;
        }
        return p;
      })
    );

    setCurrentPatient((prev) => {
      if (prev && prev.id === patientId) {
        const ext = safeDoc.extracted_data;
        const newAllergies = Array.from(new Set([...(prev.allergies || []), ...ext.allergies]));
        const newConditions = Array.from(new Set([...(prev.conditions || []), ...ext.diagnoses]));
        const newMeds = [...(prev.medications || [])];
        for (const med of ext.medications) {
          if (med?.name && !newMeds.find((m) => m?.name && m.name.toLowerCase() === med.name.toLowerCase())) {
            newMeds.push(med);
          }
        }
        return {
          ...prev,
          documents: [...(prev.documents || []), safeDoc],
          allergies: newAllergies,
          conditions: newConditions,
          medications: newMeds,
          updated_at: new Date().toISOString(),
        };
      }
      return prev;
    });
  }, []);

  const updatePatientTimeline = useCallback((patientId: string, events: TimelineEvent[]) => {
    setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, timeline: events, updated_at: new Date().toISOString() } : p));
    setCurrentPatient((prev) => prev?.id === patientId ? { ...prev, timeline: events } : prev);
  }, []);

  const updatePatientSafetyFlags = useCallback((patientId: string, flags: SafetyFlag[]) => {
    setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, safety_flags: flags, updated_at: new Date().toISOString() } : p));
    setCurrentPatient((prev) => prev?.id === patientId ? { ...prev, safety_flags: flags } : prev);
  }, []);

  const updatePatientConflicts = useCallback((patientId: string, conflicts: ConflictItem[]) => {
    setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, conflicts, updated_at: new Date().toISOString() } : p));
    setCurrentPatient((prev) => prev?.id === patientId ? { ...prev, conflicts } : prev);
  }, []);

  const updatePatientMissingInfo = useCallback((patientId: string, items: MissingInfoItem[]) => {
    setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, missing_info: items, updated_at: new Date().toISOString() } : p));
    setCurrentPatient((prev) => prev?.id === patientId ? { ...prev, missing_info: items } : prev);
  }, []);

  const updateClinicalSummary = useCallback((patientId: string, summary: ClinicalSummary) => {
    setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, clinical_summary: summary, updated_at: new Date().toISOString() } : p));
    setCurrentPatient((prev) => prev?.id === patientId ? { ...prev, clinical_summary: summary } : prev);
  }, []);

  const updateTriageCard = useCallback((patientId: string, card: TriageCard) => {
    setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, triage_card: card, updated_at: new Date().toISOString() } : p));
    setCurrentPatient((prev) => prev?.id === patientId ? { ...prev, triage_card: card } : prev);
  }, []);

  const addConsultation = useCallback((patientId: string, consultation: Consultation) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          return { ...p, consultations: [...p.consultations, consultation] };
        }
        return p;
      })
    );
  }, []);

  return (
    <AppContext.Provider
      value={{
        patients,
        currentPatient,
        setCurrentPatient: handleSetCurrentPatient,
        addPatient,
        updatePatient,
        deletePatient,
        searchPatients,
        addDocument,
        updatePatientTimeline,
        updatePatientSafetyFlags,
        updatePatientConflicts,
        updatePatientMissingInfo,
        updateClinicalSummary,
        updateTriageCard,
        currentConsultation,
        setCurrentConsultation,
        addConsultation,
        isRecording,
        setIsRecording,
        doctorName,
        setDoctorName,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
