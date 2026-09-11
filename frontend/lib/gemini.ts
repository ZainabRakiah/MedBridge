/**
 * MedBridge — Google Gemini Integration Service (Serverless Next.js)
 * Exclusively powered by Google Gemini 3.8 Flash (Sponsored by Google Antigravity)
 */

export const GEMINI_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  "";

export function stripJsonFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/i, "");
  return cleaned.trim();
}

export async function callGeminiGenerate({
  prompt,
  inlineData,
  systemInstruction,
  temperature = 0.2,
}: {
  prompt: string;
  inlineData?: { mimeType: string; data: string };
  systemInstruction?: string;
  temperature?: number;
}): Promise<string> {
  const models = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash"];
  const parts: any[] = [];

  if (inlineData) {
    parts.push({ inlineData });
  }
  parts.push({ text: prompt });

  const payload: any = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let lastError = "";

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        }
      } else {
        const errText = await res.text();
        lastError = `HTTP ${res.status} on ${model}: ${errText}`;
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  throw new Error(`Gemini generation failed: ${lastError}`);
}
