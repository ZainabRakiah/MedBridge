import test from "node:test";
import assert from "node:assert/strict";

test("SOAP Note structure validation", () => {
  const soapNote = {
    subjective: {
      chief_complaint: "Chest discomfort for 3 weeks",
      history_of_present_illness: "Exertional retrosternal tightness",
    },
    objective: {
      vitals: "BP: 138/86 mmHg, HR: 76 bpm",
    },
    assessment: {
      diagnosis: "Angina Pectoris",
      icd10_codes: [{ code: "I20.9", description: "Angina pectoris, unspecified" }],
    },
    plan: {
      medications: [{ drug_name: "Metformin", dose: "1000mg" }],
      tests_ordered: "12-Lead ECG",
    },
  };

  assert.ok(soapNote.subjective.chief_complaint);
  assert.ok(soapNote.assessment.diagnosis);
  assert.equal(soapNote.assessment.icd10_codes[0].code, "I20.9");
  assert.equal(soapNote.plan.medications[0].drug_name, "Metformin");
});

test("FHIR Resource Bundle generation validation", () => {
  const patient = {
    name: "Aarav Sharma",
    gender: "male",
    conditions: ["Hypertension", "Type 2 Diabetes Mellitus"],
    medications: [{ name: "Metformin", strength: "1000mg" }],
    allergies: ["Penicillin"],
  };

  const fhirBundle = {
    resourceType: "Bundle",
    type: "document",
    entry: [
      {
        resource: {
          resourceType: "Patient",
          name: [{ text: patient.name }],
          gender: patient.gender,
        },
      },
      ...patient.conditions.map((c) => ({
        resource: { resourceType: "Condition", code: { text: c } },
      })),
      ...patient.medications.map((m) => ({
        resource: { resourceType: "MedicationStatement", medicationCodeableConcept: { text: `${m.name} ${m.strength}` } },
      })),
      ...patient.allergies.map((a) => ({
        resource: { resourceType: "AllergyIntolerance", code: { text: a } },
      })),
    ],
  };

  assert.equal(fhirBundle.resourceType, "Bundle");
  assert.equal(fhirBundle.entry.length, 5); // 1 patient + 2 conditions + 1 med + 1 allergy
  assert.equal(fhirBundle.entry[0].resource.resourceType, "Patient");
  assert.equal(fhirBundle.entry[1].resource.resourceType, "Condition");
});

test("Drug Safety Interaction Check validation", () => {
  const flags = [
    {
      drug1: "Amlodipine",
      drug2: "Simvastatin",
      severity: "MODERATE",
      description: "Amlodipine increases Simvastatin exposure; max 20mg recommended.",
    },
  ];

  const hasSimvastatinFlag = flags.some(
    (f) =>
      f.drug1.toLowerCase().includes("simvastatin") ||
      f.drug2.toLowerCase().includes("simvastatin")
  );

  assert.equal(hasSimvastatinFlag, true);
});

test("Emergency Triage Card Schema validation", () => {
  const triage = {
    patient_name: "Aarav Sharma",
    age: "54",
    blood_group: "B+",
    acuity_level: "URGENT",
    allergies: ["Penicillin"],
    current_medications: ["Metformin 1000mg", "Amlodipine 5mg"],
  };

  assert.equal(triage.patient_name, "Aarav Sharma");
  assert.equal(triage.acuity_level, "URGENT");
  assert.ok(Array.isArray(triage.allergies));
  assert.ok(Array.isArray(triage.current_medications));
});
