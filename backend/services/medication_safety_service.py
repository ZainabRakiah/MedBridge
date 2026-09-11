"""MedBridge — Medication safety service.

Checks: drug-drug interactions, duplicate medications, allergy conflicts,
dose ambiguity, and unknown/low-confidence medication names.
"""

from __future__ import annotations

import uuid
from models.safety import SafetyFlag, MedicationSafetyResult
from models.patient import Medication


# ── Known interactions database ──────────────────────────────────────────────

KNOWN_INTERACTIONS: list[dict] = [
    {"drugs": ["aspirin", "ibuprofen"], "severity": "HIGH", "description": "Increased risk of bleeding and reduced cardioprotective effect of aspirin."},
    {"drugs": ["aspirin", "warfarin"], "severity": "HIGH", "description": "Significantly increased bleeding risk. Combined anticoagulant and antiplatelet effect."},
    {"drugs": ["aspirin", "naproxen"], "severity": "HIGH", "description": "NSAIDs may reduce cardioprotective effects of aspirin and increase GI bleeding risk."},
    {"drugs": ["ibuprofen", "warfarin"], "severity": "HIGH", "description": "Increased bleeding risk. NSAIDs inhibit platelet function and may displace warfarin."},
    {"drugs": ["metformin", "alcohol"], "severity": "HIGH", "description": "Increased risk of lactic acidosis."},
    {"drugs": ["atorvastatin", "clarithromycin"], "severity": "HIGH", "description": "Clarithromycin inhibits statin metabolism, increasing risk of myopathy/rhabdomyolysis."},
    {"drugs": ["simvastatin", "clarithromycin"], "severity": "HIGH", "description": "Clarithromycin inhibits statin metabolism, increasing risk of myopathy/rhabdomyolysis."},
    {"drugs": ["amlodipine", "simvastatin"], "severity": "MODERATE", "description": "Amlodipine may increase simvastatin levels, raising risk of myopathy."},
    {"drugs": ["warfarin", "paracetamol"], "severity": "MODERATE", "description": "Regular paracetamol use may enhance anticoagulant effect of warfarin."},
    {"drugs": ["metformin", "iodine"], "severity": "MODERATE", "description": "Risk of acute kidney injury and lactic acidosis with iodinated contrast media."},
    {"drugs": ["amlodipine", "clarithromycin"], "severity": "MODERATE", "description": "Clarithromycin may increase amlodipine levels causing hypotension."},
    {"drugs": ["metformin", "furosemide"], "severity": "MODERATE", "description": "Furosemide may increase metformin levels and risk of lactic acidosis."},
    {"drugs": ["lisinopril", "potassium"], "severity": "MODERATE", "description": "ACE inhibitors can increase potassium levels; combined use with potassium supplements risks hyperkalemia."},
    {"drugs": ["warfarin", "aspirin"], "severity": "HIGH", "description": "Significantly increased bleeding risk."},
    {"drugs": ["ciprofloxacin", "metformin"], "severity": "MODERATE", "description": "Fluoroquinolones may potentiate hypoglycemia risk when combined with antidiabetics."},
]

# ── Known allergy cross-reactions ────────────────────────────────────────────

ALLERGY_CROSSREACTIONS: dict[str, list[str]] = {
    "penicillin": ["amoxicillin", "ampicillin", "piperacillin", "nafcillin", "oxacillin", "cephalexin", "cefazolin"],
    "sulfonamides": ["sulfamethoxazole", "trimethoprim-sulfamethoxazole", "furosemide", "hydrochlorothiazide"],
    "nsaids": ["ibuprofen", "naproxen", "diclofenac", "indomethacin", "celecoxib", "aspirin"],
    "cephalosporins": ["cephalexin", "cefazolin", "ceftriaxone", "cefuroxime"],
}


def _drugs_match(drug_name: str, pattern: str) -> bool:
    """Check if a drug name matches an interaction pattern (partial match)."""
    d = drug_name.lower().strip()
    p = pattern.lower().strip()
    return d == p or d.startswith(p) or p.startswith(d) or p in d or d in p


def check_medication_safety(
    medications: list[Medication],
    allergies: list[str],
) -> MedicationSafetyResult:
    """Run all medication safety checks and return flags."""
    flags: list[SafetyFlag] = []
    med_names = [m.name for m in medications]
    med_names_lower = [m.name.lower().strip() for m in medications]

    # 1. Drug-drug interactions
    for i, med1 in enumerate(medications):
        for j, med2 in enumerate(medications):
            if i >= j:
                continue
            for interaction in KNOWN_INTERACTIONS:
                d1, d2 = interaction["drugs"]
                if (_drugs_match(med1.name, d1) and _drugs_match(med2.name, d2)) or \
                   (_drugs_match(med1.name, d2) and _drugs_match(med2.name, d1)):
                    flags.append(SafetyFlag(
                        id=str(uuid.uuid4()),
                        flag_type="interaction",
                        severity=interaction["severity"],
                        drug1=med1.name,
                        drug2=med2.name,
                        description=interaction["description"],
                        action="Verify with clinician/pharmacist before dispensing.",
                        source="MedBridge Interaction Database",
                        requires_verification=True,
                    ))
                    break

    # 2. Duplicate medications (same name or generic name)
    seen: dict[str, str] = {}
    for med in medications:
        key = med.name.lower().strip()
        if key in seen:
            flags.append(SafetyFlag(
                id=str(uuid.uuid4()),
                flag_type="duplicate",
                severity="MODERATE",
                drug1=med.name,
                drug2=seen[key],
                description=f"Duplicate medication detected: {med.name} appears more than once in the medication list.",
                action="Confirm which entry is current. Remove or consolidate duplicates.",
                source="MedBridge Duplicate Checker",
                requires_verification=True,
            ))
        else:
            seen[key] = med.name

        # Also check by generic name
        if med.generic_name:
            gkey = med.generic_name.lower().strip()
            if gkey in seen and seen[gkey] != med.name:
                flags.append(SafetyFlag(
                    id=str(uuid.uuid4()),
                    flag_type="duplicate",
                    severity="MODERATE",
                    drug1=med.name,
                    drug2=seen[gkey],
                    description=f"Possible duplicate: {med.name} and {seen[gkey]} may share the same generic drug ({med.generic_name}).",
                    action="Verify that these are distinct medications or that the duplicate was not an error.",
                    source="MedBridge Duplicate Checker",
                    requires_verification=True,
                ))

    # 3. Allergy conflicts
    allergy_lower = [a.lower().strip() for a in allergies]
    for allergy in allergy_lower:
        # Direct match
        for med in medications:
            if _drugs_match(med.name, allergy):
                flags.append(SafetyFlag(
                    id=str(uuid.uuid4()),
                    flag_type="allergy_conflict",
                    severity="HIGH",
                    drug1=med.name,
                    drug2=allergy,
                    description=f"⚠ ALLERGY CONFLICT: {med.name} matches documented allergy to {allergy}.",
                    action="STOP — Do not administer without specialist review. Verify allergy history.",
                    source="MedBridge Allergy Checker",
                    requires_verification=True,
                ))
            # Cross-reaction check
            for base_allergy, cross_reacts in ALLERGY_CROSSREACTIONS.items():
                if allergy.startswith(base_allergy) or base_allergy in allergy:
                    for cross_drug in cross_reacts:
                        if _drugs_match(med.name, cross_drug):
                            flags.append(SafetyFlag(
                                id=str(uuid.uuid4()),
                                flag_type="allergy_conflict",
                                severity="HIGH",
                                drug1=med.name,
                                drug2=allergy,
                                description=f"Possible cross-reaction: Patient has {allergy} allergy. {med.name} may have cross-reactivity.",
                                action="Verify cross-reactivity risk with clinician/pharmacist.",
                                source="MedBridge Allergy Checker",
                                requires_verification=True,
                            ))

    # 4. Low-confidence medication names
    for med in medications:
        if med.confidence < 0.70:
            flags.append(SafetyFlag(
                id=str(uuid.uuid4()),
                flag_type="dose_ambiguity",
                severity="HIGH" if med.confidence < 0.50 else "MODERATE",
                drug1=med.name,
                drug2="",
                description=f"Low-confidence extraction: '{med.name}' (confidence: {med.confidence:.0%}). Handwriting or document quality may be poor.",
                action="Verify original prescription with pharmacist/clinician before dispensing.",
                source="MedBridge Confidence Checker",
                requires_verification=True,
            ))

    # 5. Missing dose information
    for med in medications:
        if not med.dose and not med.strength:
            flags.append(SafetyFlag(
                id=str(uuid.uuid4()),
                flag_type="dose_ambiguity",
                severity="MODERATE",
                drug1=med.name,
                drug2="",
                description=f"Dose not specified for {med.name}.",
                action="Clarify dose before dispensing.",
                source="MedBridge Completeness Checker",
                requires_verification=True,
            ))

    # Determine overall status
    severities = [f.severity for f in flags]
    if "HIGH" in severities:
        status = "CRITICAL"
    elif "MODERATE" in severities:
        status = "REVIEW_REQUIRED"
    elif flags:
        status = "REVIEW_REQUIRED"
    else:
        status = "OK"

    return MedicationSafetyResult(
        status=status,
        flags=flags,
        checked_medications=med_names,
        checked_allergies=allergies,
    )
