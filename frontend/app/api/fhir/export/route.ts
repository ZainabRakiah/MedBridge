import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const patient = await req.json();
    const p = (patient || {}) as any;

    const bundle = {
      resourceType: "Bundle",
      id: `medbridge-bundle-${Date.now()}`,
      type: "document",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: `patient-${(p.name || "aarav-sharma").toLowerCase().replace(/\s+/g, "-")}`,
            identifier: [{ system: "https://healthid.ndhm.gov.in", value: "91-98765-43210" }],
            active: true,
            name: [{ use: "official", text: p.name || "Aarav Sharma" }],
            gender: (p.gender || "male").toLowerCase(),
            birthDate: "1972-03-15",
          },
        },
        ...(Array.isArray(p.conditions)
          ? p.conditions.map((c: string, i: number) => ({
              resource: {
                resourceType: "Condition",
                id: `cond-${i + 1}`,
                clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
                code: { text: c },
                subject: { reference: `Patient/patient-${(p.name || "aarav-sharma").toLowerCase().replace(/\s+/g, "-")}` },
              },
            }))
          : []),
        ...(Array.isArray(p.medications)
          ? p.medications.map((m: any, i: number) => ({
              resource: {
                resourceType: "MedicationStatement",
                id: `med-${i + 1}`,
                status: "active",
                medicationCodeableConcept: { text: typeof m === "string" ? m : `${m.name} ${m.strength || ""}`.trim() },
                subject: { reference: `Patient/patient-${(p.name || "aarav-sharma").toLowerCase().replace(/\s+/g, "-")}` },
              },
            }))
          : []),
        ...(Array.isArray(p.allergies)
          ? p.allergies.map((a: string, i: number) => ({
              resource: {
                resourceType: "AllergyIntolerance",
                id: `allergy-${i + 1}`,
                clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
                code: { text: a },
                patient: { reference: `Patient/patient-${(p.name || "aarav-sharma").toLowerCase().replace(/\s+/g, "-")}` },
              },
            }))
          : []),
      ],
    };

    return NextResponse.json(bundle);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to generate FHIR bundle" }, { status: 500 });
  }
}
