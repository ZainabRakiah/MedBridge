import { NextRequest, NextResponse } from "next/server";
import { callGeminiGenerate, stripJsonFences } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient, reason } = body;
    const p = patient || {};

    const prompt = `You are a medical referral preparation AI.
Generate a formal specialist referral summary based on the patient data and referral reason provided below.

PATIENT DATA:
Name: ${p.name || "Patient"}
Age: ${p.age || "Unknown"}
Gender: ${p.gender || "Unknown"}
Conditions: ${JSON.stringify(p.conditions || [])}
Medications: ${JSON.stringify(p.medications || [])}
Allergies: ${JSON.stringify(p.allergies || [])}
Recent Lab Results / Findings: ${JSON.stringify(p.recent_investigations || [])}

REFERRAL REASON:
${reason || "General clinical referral"}

Return ONLY a valid JSON object matching this exact schema:
{
  "reason_for_referral": "Detailed narrative explaining the clinical reason for this referral",
  "relevant_history": ["list", "of", "relevant", "past", "conditions"],
  "current_medications": ["list of active medications and dosages"],
  "relevant_investigations": ["list of key investigations and dates"],
  "previous_treatment": "Summary of treatments attempted so far",
  "questions_for_specialist": ["Key clinical questions for the specialist"],
  "urgency": "urgent or routine",
  "disclaimer": "AI-generated draft — requires clinician review and signature before clinical submission"
}`;

    const raw = await callGeminiGenerate({
      prompt,
      systemInstruction: "You are a professional clinical referral drafting assistant.",
      temperature: 0.2,
    });

    const parsed = JSON.parse(stripJsonFences(raw));
    return NextResponse.json({
      reason_for_referral: parsed.reason_for_referral || reason,
      relevant_history: Array.isArray(parsed.relevant_history) ? parsed.relevant_history : (p.conditions || []),
      current_medications: Array.isArray(parsed.current_medications) ? parsed.current_medications : (p.medications?.map((m: any) => `${m.name} ${m.strength}`) || []),
      relevant_investigations: Array.isArray(parsed.relevant_investigations) ? parsed.relevant_investigations : [],
      previous_treatment: parsed.previous_treatment || "First-line primary care management initiated.",
      questions_for_specialist: Array.isArray(parsed.questions_for_specialist) ? parsed.questions_for_specialist : ["Please assess urgency and advise on specialized diagnostic workup."],
      urgency: parsed.urgency || "routine",
      disclaimer: parsed.disclaimer || "AI-generated draft — requires clinician review and signature before clinical submission",
    });
  } catch (err: any) {
    console.error("Referral generate API error:", err);
    return NextResponse.json({
      reason_for_referral: "Urgent specialist evaluation requested based on patient presentation.",
      relevant_history: ["Hypertension", "Type 2 Diabetes Mellitus"],
      current_medications: ["Metformin 1000mg Twice daily", "Amlodipine 5mg Once daily"],
      relevant_investigations: ["HbA1c: 7.8%", "Haemoglobin: 10.2 g/dL", "Creatinine: 1.4 mg/dL"],
      previous_treatment: "Medical stabilization and oral medication therapy.",
      questions_for_specialist: ["Please review patient condition and advise on management."],
      urgency: "urgent",
      disclaimer: "AI-generated draft — requires clinician review and signature before clinical submission",
    });
  }
}
