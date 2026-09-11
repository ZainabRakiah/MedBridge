"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";

// Synthetic demo patient — Aarav Sharma
// ALL DATA IS SYNTHETIC AND DOES NOT REPRESENT ANY REAL PERSON
const DEMO_PATIENT_KEY = "medbridge_demo_seeded_v3";

const DEMO_PATIENT = {
  id: "demo_aarav_sharma",
  name: "Aarav Sharma",
  date_of_birth: "1972-03-15",
  age: "54",
  sex: "M",
  gender: "M",
  phone: "+91-98765-43210",
  blood_group: "B+",
  allergies: ["Penicillin"],
  conditions: ["Hypertension", "Type 2 Diabetes Mellitus"],
  medications: [
    { name: "Metformin", generic_name: "Metformin HCl", strength: "1000mg", dose: "1000mg", frequency: "Twice daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Prescription_2026-08-03", confidence: 0.92, verification_status: "unverified" as const },
    { name: "Amlodipine", generic_name: "Amlodipine besylate", strength: "5mg", dose: "5mg", frequency: "Once daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Prescription_2026-02-10", confidence: 0.94, verification_status: "unverified" as const },
    { name: "Atorvastatin", generic_name: "Atorvastatin calcium", strength: "20mg", dose: "20mg", frequency: "Once daily at bedtime", route: "oral", duration: "ongoing", status: "active" as const, source: "Handwritten_Rx_2026-08-03", confidence: 0.52, verification_status: "review_required" as const },
    { name: "Aspirin", generic_name: "Acetylsalicylic acid", strength: "75mg", dose: "75mg", frequency: "Once daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Prescription_2026-04-18", confidence: 0.90, verification_status: "unverified" as const },
  ],
  timeline: [
    { id: "t1", patient_id: "demo_aarav_sharma", date: "2026-09-11", event_type: "symptoms", description: "Chest discomfort for approximately 3 weeks — worsens on exertion (walking upstairs)", source_document_id: "", source_type: "voice", confidence: 0.85, verification_status: "patient_reported", metadata: { source_label: "Patient voice description", original_statement: "I've been having chest discomfort for about 3 weeks. Gets worse walking upstairs." } },
    { id: "t2", patient_id: "demo_aarav_sharma", date: "2026-08-03", event_type: "medication_changed", description: "Metformin increased to 1000mg; Amlodipine 10mg prescribed (LOW CONFIDENCE — verify)", source_document_id: "doc_rx2", source_type: "document", confidence: 0.61, verification_status: "review_required", metadata: { source_label: "Handwritten prescription dated 2026-08-03", low_confidence: true } },
    { id: "t3", patient_id: "demo_aarav_sharma", date: "2026-05-12", event_type: "discharge", description: "Hospital discharge — City General Hospital", source_document_id: "doc_discharge", source_type: "document", confidence: 0.94, verification_status: "unverified", metadata: { source_label: "Discharge summary 2026-05-12" } },
    { id: "t4", patient_id: "demo_aarav_sharma", date: "2026-04-18", event_type: "lab_result", description: "HbA1c: 7.8% [HIGH] • Hb: 10.2 g/dL [LOW] • Creatinine: 1.4 mg/dL", source_document_id: "doc_lab", source_type: "document", confidence: 0.97, verification_status: "unverified", metadata: { source_label: "Lab report 2026-04-18", abnormal: true } },
    { id: "t5", patient_id: "demo_aarav_sharma", date: "2026-02-10", event_type: "medication_started", description: "Metformin 500mg twice daily; Amlodipine 5mg once daily", source_document_id: "doc_rx1", source_type: "document", confidence: 0.95, verification_status: "unverified", metadata: { source_label: "Prescription 2026-02-10" } },
    { id: "t6", patient_id: "demo_aarav_sharma", date: "2026-01-12", event_type: "diagnosis", description: "Hypertension, Type 2 Diabetes Mellitus", source_document_id: "doc_rx1", source_type: "document", confidence: 0.96, verification_status: "unverified", metadata: { source_label: "Prescription 2026-02-10" } },
    { id: "t7", patient_id: "demo_aarav_sharma", date: "2026-01-12", event_type: "allergy", description: "Allergy recorded: Penicillin (reaction type not documented)", source_document_id: "doc_rx1", source_type: "document", confidence: 0.90, verification_status: "unverified", metadata: { source_label: "Prescription 2026-02-10" } },
  ],
  documents: [
    {
      id: "doc_rx1",
      patient_id: "demo_aarav_sharma",
      type: "prescription",
      filename: "Prescription_2026-02-10.pdf",
      date: "2026-02-10",
      source: "upload",
      confidence: 0.95,
      verification_status: "unverified",
      uploaded_at: "2026-02-10T10:00:00Z",
      extracted_data: {
        document_type: "prescription",
        patient_name: "Aarav Sharma",
        document_date: "2026-02-10",
        doctor: "Dr. K. S. Rao",
        hospital: "City Cardiology Clinic",
        diagnoses: ["Hypertension", "Type 2 Diabetes Mellitus"],
        medications: [
          { name: "Metformin", generic_name: "Metformin HCl", strength: "500mg", dose: "500mg", frequency: "Twice daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Prescription_2026-02-10.pdf", confidence: 0.95, verification_status: "unverified" as const },
          { name: "Amlodipine", generic_name: "Amlodipine besylate", strength: "5mg", dose: "5mg", frequency: "Once daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Prescription_2026-02-10.pdf", confidence: 0.94, verification_status: "unverified" as const },
        ],
        allergies: ["Penicillin"],
        symptoms: [],
        lab_results: [],
        procedures: [],
        follow_up: ["Review in 3 months"],
        warnings: [],
        confidence: 0.95,
        raw_text: "Prescription dated 10 Feb 2026. Diagnoses: HTN, T2DM. Rx: Metformin 500mg BD, Amlodipine 5mg OD. Allergy: Penicillin.",
      },
    },
    {
      id: "doc_lab",
      patient_id: "demo_aarav_sharma",
      type: "lab_report",
      filename: "Lab_Panel_2026-04-18.pdf",
      date: "2026-04-18",
      source: "upload",
      confidence: 0.97,
      verification_status: "unverified",
      uploaded_at: "2026-04-18T11:30:00Z",
      extracted_data: {
        document_type: "lab_report",
        patient_name: "Aarav Sharma",
        document_date: "2026-04-18",
        doctor: "Pathology Labs Inc",
        hospital: "Metro Diagnostic Center",
        diagnoses: [],
        medications: [],
        allergies: [],
        symptoms: [],
        lab_results: [
          { name: "HbA1c", value: "7.8", unit: "%", reference_range: "<7.0", flag: "high" },
          { name: "Haemoglobin", value: "10.2", unit: "g/dL", reference_range: "13.0-17.0", flag: "low" },
          { name: "Serum Creatinine", value: "1.4", unit: "mg/dL", reference_range: "0.7-1.3", flag: "high" },
        ],
        procedures: [],
        follow_up: [],
        warnings: ["HbA1c elevated (7.8%)", "Mild anaemia (Hb 10.2 g/dL)"],
        confidence: 0.97,
        raw_text: "Comprehensive metabolic panel: HbA1c 7.8% (HIGH), Hb 10.2 g/dL (LOW), Creatinine 1.4 mg/dL.",
      },
    },
    {
      id: "doc_discharge",
      patient_id: "demo_aarav_sharma",
      type: "discharge_summary",
      filename: "Discharge_Summary_2026-05-12.pdf",
      date: "2026-05-12",
      source: "upload",
      confidence: 0.94,
      verification_status: "unverified",
      uploaded_at: "2026-05-12T16:00:00Z",
      extracted_data: {
        document_type: "discharge_summary",
        patient_name: "Aarav Sharma",
        document_date: "2026-05-12",
        doctor: "Dr. Ramesh Verma",
        hospital: "City General Hospital",
        diagnoses: ["Hypertension", "Type 2 Diabetes Mellitus", "Acute Gastritis"],
        medications: [
          { name: "Metformin", generic_name: "Metformin HCl", strength: "500mg", dose: "500mg", frequency: "Twice daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Discharge_Summary_2026-05-12.pdf", confidence: 0.94, verification_status: "unverified" as const },
        ],
        allergies: ["Penicillin"],
        symptoms: ["Epigastric burning", "GI upset"],
        lab_results: [],
        procedures: ["Upper GI Endoscopy"],
        follow_up: ["Follow-up with primary care physician in 2 weeks"],
        warnings: [],
        confidence: 0.94,
        raw_text: "Discharge summary 12 May 2026. Admitted for acute gastritis. Discharged stable on Metformin 500mg BD.",
      },
    },
    {
      id: "doc_rx2",
      patient_id: "demo_aarav_sharma",
      type: "prescription",
      filename: "Handwritten_Rx_2026-08-03.jpg",
      date: "2026-08-03",
      source: "upload",
      confidence: 0.61,
      verification_status: "review_required",
      uploaded_at: "2026-08-03T14:15:00Z",
      extracted_data: {
        document_type: "prescription",
        patient_name: "Aarav Sharma",
        document_date: "2026-08-03",
        doctor: "Dr. P. Nair",
        hospital: "Apex Heart Center",
        diagnoses: ["Uncontrolled Diabetes", "Dyslipidemia"],
        medications: [
          { name: "Metformin", generic_name: "Metformin HCl", strength: "1000mg", dose: "1000mg", frequency: "Twice daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Handwritten_Rx_2026-08-03.jpg", confidence: 0.88, verification_status: "unverified" as const },
          { name: "Amlodipine", generic_name: "Amlodipine besylate", strength: "10mg", dose: "10mg", frequency: "Once daily", route: "oral", duration: "ongoing", status: "active" as const, source: "Handwritten_Rx_2026-08-03.jpg", confidence: 0.70, verification_status: "review_required" as const },
          { name: "Atorvastatin", generic_name: "Atorvastatin calcium", strength: "20mg", dose: "20mg", frequency: "Once daily at bedtime", route: "oral", duration: "ongoing", status: "active" as const, source: "Handwritten_Rx_2026-08-03.jpg", confidence: 0.52, verification_status: "review_required" as const },
        ],
        allergies: [],
        symptoms: [],
        lab_results: [],
        procedures: [],
        follow_up: ["Lipid profile in 6 weeks"],
        warnings: ["Low confidence on Atorvastatin (handwriting unclear)", "Amlodipine dose stepped up to 10mg"],
        confidence: 0.61,
        raw_text: "Handwritten Rx 03 Aug 2026. Metformin stepped to 1000mg BD. Amlodipine 10mg OD. ?Atorvastatin 20mg HS.",
      },
    },
  ],
  safety_flags: [
    { id: "sf1", flag_type: "dose_ambiguity", severity: "HIGH" as const, drug1: "Atorvastatin", drug2: "", description: "Low-confidence extraction: 'Atorvastatin' (confidence: 52%). Handwriting quality is poor on prescription 2026-08-03.", action: "Verify original prescription with pharmacist/clinician before dispensing.", source: "MedBridge Confidence Checker", requires_verification: true },
  ],
  conflicts: [
    { id: "c1", conflict_type: "medication_dose", field: "Amlodipine strength/dose", value_a: "5 mg", source_a: "Prescription dated 2026-02-10", value_b: "10 mg", source_b: "Handwritten prescription dated 2026-08-03", description: "Amlodipine appears with two different strengths in different documents.", severity: "HIGH" },
  ],
  missing_info: [
    { id: "m1", category: "allergy", description: "Allergy reaction type not documented for Penicillin", importance: "HIGH" as const, suggested_action: "Ask patient about allergy reaction symptoms (rash, anaphylaxis, GI, etc.)" },
    { id: "m2", category: "medication", description: "Current medication adherence not recorded", importance: "MODERATE" as const, suggested_action: "Confirm patient is taking all medications as prescribed" },
    { id: "m3", category: "symptom", description: "Exact onset date of chest discomfort unavailable", importance: "MODERATE" as const, suggested_action: "Ask patient for more precise onset timing" },
    { id: "m4", category: "lab", description: "Recent renal function panel not available (Metformin requires monitoring)", importance: "HIGH" as const, suggested_action: "Order updated creatinine/eGFR — Metformin is contraindicated in severe renal impairment" },
  ],
  clinical_summary: {
    patient_overview: "Aarav Sharma, 54-year-old male with Hypertension and Type 2 Diabetes, presenting with chest discomfort.",
    current_complaint: "Chest discomfort for approximately 3 weeks, worsening on exertion (walking upstairs).",
    relevant_history: ["Hypertension — diagnosed Jan 2026", "Type 2 Diabetes Mellitus — diagnosed Jan 2026", "Hospital admission — May 2026"],
    current_medications: [],
    allergies: ["Penicillin (reaction type not documented — verify)"],
    recent_investigations: ["HbA1c: 7.8% (elevated, target <7.0%)", "Haemoglobin: 10.2 g/dL (low)", "Creatinine: 1.4 mg/dL"],
    missing_information: ["Allergy reaction type not documented for Penicillin.", "Medication adherence not recorded.", "Exact onset of chest discomfort unavailable.", "Recent renal function not available — important given Metformin use."],
    ai_flags: ["⚠ Amlodipine dose conflict: 5mg (Feb 2026) vs 10mg (Aug 2026 handwritten Rx) — verify current dose.", "⚠ Atorvastatin extracted with low confidence (52%) from handwritten Rx — verify with original.", "⚠ Hb 10.2 g/dL (mild anaemia) in context of chest discomfort warrants clinical assessment."],
    suggested_questions: ["What is the current Amlodipine dose — 5mg or 10mg?", "Can you confirm the handwritten medication is Atorvastatin?", "What was the allergy reaction to Penicillin?", "Is the patient currently taking all medications as prescribed?", "Any radiation, sweating, or breathlessness with chest discomfort?"],
    generated_at: "2026-09-11T06:00:00Z",
  },
  triage_card: null,
  consultations: [],
  created_at: "2026-09-11T06:00:00Z",
  updated_at: "2026-09-11T06:00:00Z",
};

export default function DemoDataSeeder() {
  const { addPatient, setCurrentPatient, patients } = useApp();

  useEffect(() => {
    const seeded = localStorage.getItem(DEMO_PATIENT_KEY);
    if (seeded) return;

    // Seed or update demo patient
    addPatient(DEMO_PATIENT as Parameters<typeof addPatient>[0]);
    setCurrentPatient(DEMO_PATIENT as Parameters<typeof setCurrentPatient>[0]);
    localStorage.setItem(DEMO_PATIENT_KEY, "true");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
