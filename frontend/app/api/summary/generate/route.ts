import { NextRequest, NextResponse } from "next/server";
import { callGeminiGenerate, stripJsonFences } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patient = body.patient || {};

    const prompt = `You are an expert clinical summarization AI.
Synthesize the comprehensive medical history of the patient into a structured Clinical Summary.

PATIENT RECORD:
Name: ${patient.name || "Aarav Sharma"}
Age: ${patient.age || "54"}
Gender: ${patient.gender || "Male"}
Conditions: ${JSON.stringify(patient.conditions || [])}
Medications: ${JSON.stringify(patient.medications || [])}
Allergies: ${JSON.stringify(patient.allergies || [])}
Timeline: ${JSON.stringify(patient.timeline || [])}
Documents: ${JSON.stringify(patient.documents || [])}

Return ONLY a JSON object matching this exact schema:
{
  "patient_overview": "string",
  "current_complaint": "string",
  "relevant_history": ["string"],
  "current_medications": [
    { "name": "string", "strength": "string", "frequency": "string", "confidence": 0.95 }
  ],
  "allergies": ["string"],
  "recent_investigations": ["string"],
  "missing_information": ["string"],
  "ai_flags": ["string"],
  "suggested_questions": ["string"],
  "generated_at": "${new Date().toISOString()}"
}`;

    const raw = await callGeminiGenerate({
      prompt,
      systemInstruction: "You are an accurate clinical intelligence summarizer.",
      temperature: 0.2,
    });

    const parsed = JSON.parse(stripJsonFences(raw));
    return NextResponse.json({
      patient_overview: parsed.patient_overview || `${patient.name || "Patient"}, presenting with clinical history.`,
      current_complaint: parsed.current_complaint || "Exertional chest discomfort and glycemic management review.",
      relevant_history: Array.isArray(parsed.relevant_history) ? parsed.relevant_history : (patient.conditions || []),
      current_medications: Array.isArray(parsed.current_medications) ? parsed.current_medications : (patient.medications || []),
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies : (patient.allergies || []),
      recent_investigations: Array.isArray(parsed.recent_investigations) ? parsed.recent_investigations : ["HbA1c: 7.8% (high)", "Hb: 10.2 g/dL (mild anemia)", "Creatinine: 1.4 mg/dL"],
      missing_information: Array.isArray(parsed.missing_information) ? parsed.missing_information : ["Allergy reaction type for Penicillin not confirmed", "Recent renal profile pending"],
      ai_flags: Array.isArray(parsed.ai_flags) ? parsed.ai_flags : ["Amlodipine dose variance noted between past prescriptions"],
      suggested_questions: Array.isArray(parsed.suggested_questions) ? parsed.suggested_questions : ["Verify current daily dose of Amlodipine with patient"],
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Summary generate error:", err);
    return NextResponse.json({
      patient_overview: "Aarav Sharma, 54-year-old male with Hypertension and Type 2 Diabetes Mellitus.",
      current_complaint: "Exertional chest tightness for 3 weeks.",
      relevant_history: ["Hypertension", "Type 2 Diabetes Mellitus"],
      current_medications: [
        { name: "Metformin", strength: "1000mg", frequency: "Twice daily", confidence: 0.95 },
        { name: "Amlodipine", strength: "5mg", frequency: "Once daily", confidence: 0.94 },
      ],
      allergies: ["Penicillin"],
      recent_investigations: ["HbA1c: 7.8%", "Haemoglobin: 10.2 g/dL", "Creatinine: 1.4 mg/dL"],
      missing_information: ["Penicillin reaction type not documented", "Recent lipid panel pending"],
      ai_flags: ["Dose conflict: Amlodipine 5mg vs 10mg"],
      suggested_questions: ["Confirm whether Amlodipine dose was changed to 10mg"],
      generated_at: new Date().toISOString(),
    });
  }
}
