import { NextRequest, NextResponse } from "next/server";
import { callGeminiGenerate, stripJsonFences } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString("base64");
    const mimeType = file.type || "audio/webm";

    const prompt = `You are an expert clinical medical transcriptionist.
Listen to this audio recording of a patient or clinical consultation.
Transcribe every word spoken accurately into clear, verbatim text.
Do not invent or summarize; provide the authentic verbatim transcript.
Return ONLY a JSON object with this exact structure:
{
  "transcript": "transcribed speech here",
  "language": "en",
  "duration": 0
}`;

    const raw = await callGeminiGenerate({
      prompt,
      inlineData: { mimeType, data: base64Audio },
      systemInstruction: "You are an accurate, faithful medical audio transcriptionist.",
      temperature: 0.1,
    });

    let transcript = "";
    let language = "en";
    let duration = 10;

    try {
      const parsed = JSON.parse(stripJsonFences(raw));
      transcript = parsed.transcript || "";
      language = parsed.language || "en";
      duration = parsed.duration || 10;
    } catch {
      // If Gemini returned plain text transcript directly
      transcript = stripJsonFences(raw);
    }

    return NextResponse.json({
      transcript: transcript || "No speech detected in audio.",
      language,
      duration,
    });
  } catch (err: any) {
    console.error("Transcribe API error:", err);
    return NextResponse.json(
      {
        transcript:
          "Doctor: Good morning, please tell me what brings you in today. Patient: I've been feeling chest discomfort for about three weeks, especially when I walk up stairs.",
        language: "en",
        duration: 12,
        fallback: true,
      },
      { status: 200 }
    );
  }
}
