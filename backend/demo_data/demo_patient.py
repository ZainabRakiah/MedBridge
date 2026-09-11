"""
MedBridge Synthetic Demo Patient — Aarav Sharma

This script generates synthetic demo patient data for hackathon demonstrations.
ALL DATA IS SYNTHETIC AND DOES NOT REPRESENT ANY REAL PERSON.

The dataset intentionally includes:
- One medication dose conflict (Amlodipine 5mg vs 10mg)
- One ambiguous handwritten medication (Atorvastatin — low confidence)
- One missing field (allergy reaction type for Penicillin)
- One abnormal lab result (HbA1c elevated, Hb low)
- One medication change (Metformin 500mg → 1000mg)
"""

DEMO_PATIENT = {
    "id": "demo_aarav_sharma",
    "name": "Aarav Sharma",
    "date_of_birth": "1972-03-15",
    "age": "54",
    "sex": "M",
    "gender": "M",
    "phone": "+91-98765-43210",
    "blood_group": "B+",
    "allergies": ["Penicillin"],  # reaction type intentionally missing
    "conditions": ["Hypertension", "Type 2 Diabetes Mellitus"],
    "medications": [
        {
            "name": "Metformin",
            "generic_name": "Metformin HCl",
            "strength": "1000mg",
            "dose": "1000mg",
            "frequency": "Twice daily",
            "route": "oral",
            "duration": "ongoing",
            "status": "active",
            "source": "Prescription_2026-08-03_handwritten.jpg",
            "confidence": 0.92,
            "verification_status": "unverified",
        },
        {
            "name": "Amlodipine",
            "generic_name": "Amlodipine besylate",
            "strength": "5mg",  # Conflict: appears as 10mg in handwritten Rx
            "dose": "5mg",
            "frequency": "Once daily",
            "route": "oral",
            "duration": "ongoing",
            "status": "active",
            "source": "Prescription_2026-02-10.pdf",
            "confidence": 0.94,
            "verification_status": "unverified",
        },
        {
            "name": "Atorvastatin",  # Low confidence — ambiguous handwriting
            "generic_name": "Atorvastatin calcium",
            "strength": "20mg",
            "dose": "20mg",
            "frequency": "Once daily at bedtime",
            "route": "oral",
            "duration": "ongoing",
            "status": "active",
            "source": "Prescription_2026-08-03_handwritten.jpg",
            "confidence": 0.52,  # Intentionally low confidence
            "verification_status": "review_required",
        },
        {
            "name": "Aspirin",  # Will trigger interaction with Atorvastatin via indirect path
            "generic_name": "Acetylsalicylic acid",
            "strength": "75mg",
            "dose": "75mg",
            "frequency": "Once daily",
            "route": "oral",
            "duration": "ongoing",
            "status": "active",
            "source": "Prescription_2026-04-18_lab_report.pdf",
            "confidence": 0.90,
            "verification_status": "unverified",
        },
    ],
    "timeline": [
        {
            "id": "t1",
            "patient_id": "demo_aarav_sharma",
            "date": "2026-09-11",
            "event_type": "symptoms",
            "description": "Chest discomfort for approximately 3 weeks (patient reported)",
            "source_document_id": "",
            "source_type": "voice",
            "confidence": 0.85,
            "verification_status": "patient_reported",
            "metadata": {"source_label": "Patient voice description", "original_statement": "I've been having this chest discomfort for about three weeks. It gets worse when I walk upstairs."},
        },
        {
            "id": "t2",
            "patient_id": "demo_aarav_sharma",
            "date": "2026-08-03",
            "event_type": "medication_changed",
            "description": "Metformin changed from 500mg to 1000mg; Amlodipine 10mg prescribed",
            "source_document_id": "doc_handwritten_rx",
            "source_type": "document",
            "confidence": 0.61,
            "verification_status": "review_required",
            "metadata": {"source_label": "Handwritten prescription dated 2026-08-03", "low_confidence": True},
        },
        {
            "id": "t3",
            "patient_id": "demo_aarav_sharma",
            "date": "2026-05-12",
            "event_type": "discharge",
            "description": "Hospital discharge — City General Hospital",
            "source_document_id": "doc_discharge",
            "source_type": "document",
            "confidence": 0.94,
            "verification_status": "unverified",
            "metadata": {"source_label": "Discharge summary 2026-05-12"},
        },
        {
            "id": "t4",
            "patient_id": "demo_aarav_sharma",
            "date": "2026-04-18",
            "event_type": "lab_result",
            "description": "HbA1c: 7.8% [HIGH] • Hb: 10.2 g/dL [LOW] • Creatinine: 1.4 mg/dL",
            "source_document_id": "doc_lab",
            "source_type": "document",
            "confidence": 0.97,
            "verification_status": "unverified",
            "metadata": {"source_label": "Lab report 2026-04-18", "abnormal": True},
        },
        {
            "id": "t5",
            "patient_id": "demo_aarav_sharma",
            "date": "2026-02-10",
            "event_type": "medication_started",
            "description": "Metformin 500mg twice daily • Amlodipine 5mg once daily",
            "source_document_id": "doc_rx1",
            "source_type": "document",
            "confidence": 0.95,
            "verification_status": "unverified",
            "metadata": {"source_label": "Prescription 2026-02-10"},
        },
        {
            "id": "t6",
            "patient_id": "demo_aarav_sharma",
            "date": "2026-01-12",
            "event_type": "diagnosis",
            "description": "Hypertension, Type 2 Diabetes Mellitus",
            "source_document_id": "doc_rx1",
            "source_type": "document",
            "confidence": 0.96,
            "verification_status": "unverified",
            "metadata": {"source_label": "Prescription 2026-02-10"},
        },
        {
            "id": "t7",
            "patient_id": "demo_aarav_sharma",
            "date": "2026-01-12",
            "event_type": "allergy",
            "description": "Allergy recorded: Penicillin (reaction type not documented)",
            "source_document_id": "doc_rx1",
            "source_type": "document",
            "confidence": 0.90,
            "verification_status": "unverified",
            "metadata": {"source_label": "Prescription 2026-02-10"},
        },
    ],
    "documents": [],
    "safety_flags": [
        {
            "id": "sf1",
            "flag_type": "dose_ambiguity",
            "severity": "HIGH",
            "drug1": "Atorvastatin",
            "drug2": "",
            "description": "Low-confidence extraction: 'Atorvastatin' (confidence: 52%). Handwriting quality is poor on prescription 2026-08-03.",
            "action": "Verify original prescription with pharmacist/clinician before dispensing.",
            "source": "MedBridge Confidence Checker",
            "requires_verification": True,
        },
    ],
    "conflicts": [
        {
            "id": "c1",
            "conflict_type": "medication_dose",
            "field": "Amlodipine strength/dose",
            "value_a": "5 mg",
            "source_a": "Prescription dated 2026-02-10",
            "value_b": "10 mg",
            "source_b": "Handwritten prescription dated 2026-08-03",
            "description": "Amlodipine appears with two different strengths in different documents.",
            "severity": "HIGH",
        }
    ],
    "missing_info": [
        {
            "id": "m1",
            "category": "allergy",
            "description": "Allergy reaction type not documented for Penicillin",
            "importance": "HIGH",
            "suggested_action": "Ask patient about allergy reaction symptoms (rash, anaphylaxis, GI, etc.)",
        },
        {
            "id": "m2",
            "category": "medication",
            "description": "Current medication adherence not recorded",
            "importance": "MODERATE",
            "suggested_action": "Confirm patient is taking all medications as prescribed",
        },
        {
            "id": "m3",
            "category": "symptom",
            "description": "Exact onset date of chest discomfort unavailable",
            "importance": "MODERATE",
            "suggested_action": "Ask patient for more precise onset timing",
        },
        {
            "id": "m4",
            "category": "lab",
            "description": "Recent renal function panel not available (Metformin requires monitoring)",
            "importance": "HIGH",
            "suggested_action": "Order updated creatinine/eGFR — Metformin is contraindicated in severe renal impairment",
        },
    ],
    "clinical_summary": {
        "patient_overview": "Aarav Sharma, 54-year-old male with known Hypertension and Type 2 Diabetes Mellitus, presenting with chest discomfort.",
        "current_complaint": "Chest discomfort for approximately 3 weeks, worsening on exertion (walking upstairs).",
        "relevant_history": [
            "Hypertension — diagnosed 2026-01",
            "Type 2 Diabetes Mellitus — diagnosed 2026-01",
            "Hospital admission — May 2026 (details in discharge summary)",
        ],
        "current_medications": [],  # Will be filled from medications list
        "allergies": ["Penicillin (reaction type not documented — verify)"],
        "recent_investigations": [
            "HbA1c: 7.8% (elevated, target <7.0%) — April 2026",
            "Haemoglobin: 10.2 g/dL (low) — April 2026",
            "Creatinine: 1.4 mg/dL — April 2026",
        ],
        "missing_information": [
            "Allergy reaction type not documented for Penicillin.",
            "Medication adherence not recorded.",
            "Exact onset of chest discomfort unavailable.",
            "Recent renal function not available — important given Metformin use.",
        ],
        "ai_flags": [
            "⚠ Amlodipine dose conflict: 5mg (Feb 2026 Rx) vs 10mg (Aug 2026 handwritten Rx) — verify current dose.",
            "⚠ Atorvastatin name extracted with low confidence (52%) from handwritten prescription — verify with original.",
            "⚠ Haemoglobin 10.2 g/dL — mild anaemia. Chest discomfort in context of anaemia warrants clinical assessment.",
        ],
        "suggested_questions": [
            "What is the current Amlodipine dose — 5mg or 10mg?",
            "Is the patient taking Atorvastatin? Can you read the original handwritten prescription?",
            "What was the allergy reaction to Penicillin?",
            "Is the patient currently taking all prescribed medications?",
            "Has the chest discomfort changed in character? Any radiation, sweating, or breathlessness?",
        ],
        "generated_at": "2026-09-11T06:00:00Z",
    },
    "triage_card": None,
    "consultations": [],
    "created_at": "2026-09-11T06:00:00Z",
    "updated_at": "2026-09-11T06:00:00Z",
}


if __name__ == "__main__":
    import json
    print(json.dumps(DEMO_PATIENT, indent=2))
