import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const card = await req.json();
    const patientName = card.patient_name || "Patient";
    const token = `MEDBRIDGE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220" fill="none"><rect width="220" height="220" fill="#ffffff" rx="16"/><rect x="20" y="20" width="50" height="50" rx="6" fill="#0f172a"/><rect x="28" y="28" width="34" height="34" rx="4" fill="#ffffff"/><rect x="35" y="35" width="20" height="20" rx="2" fill="#0f172a"/><rect x="150" y="20" width="50" height="50" rx="6" fill="#0f172a"/><rect x="158" y="28" width="34" height="34" rx="4" fill="#ffffff"/><rect x="165" y="35" width="20" height="20" rx="2" fill="#0f172a"/><rect x="20" y="150" width="50" height="50" rx="6" fill="#0f172a"/><rect x="28" y="158" width="34" height="34" rx="4" fill="#ffffff"/><rect x="35" y="165" width="20" height="20" rx="2" fill="#0f172a"/><rect x="85" y="30" width="12" height="12" fill="#0f172a"/><rect x="105" y="30" width="12" height="12" fill="#0f172a"/><rect x="125" y="30" width="12" height="12" fill="#0f172a"/><rect x="85" y="55" width="20" height="12" fill="#0f172a"/><rect x="115" y="55" width="15" height="12" fill="#0f172a"/><rect x="30" y="85" width="12" height="20" fill="#0f172a"/><rect x="55" y="85" width="15" height="12" fill="#0f172a"/><rect x="85" y="85" width="50" height="50" rx="8" fill="#06b6d4"/><rect x="98" y="98" width="24" height="24" rx="4" fill="#ffffff"/><rect x="150" y="85" width="20" height="15" fill="#0f172a"/><rect x="180" y="85" width="15" height="15" fill="#0f172a"/><rect x="150" y="110" width="15" height="20" fill="#0f172a"/><rect x="175" y="115" width="20" height="15" fill="#0f172a"/><rect x="85" y="150" width="15" height="20" fill="#0f172a"/><rect x="110" y="150" width="25" height="15" fill="#0f172a"/><rect x="85" y="180" width="30" height="15" fill="#0f172a"/><rect x="125" y="175" width="15" height="20" fill="#0f172a"/><rect x="150" y="150" width="20" height="20" fill="#0f172a"/><rect x="180" y="150" width="15" height="15" fill="#0f172a"/><rect x="150" y="180" width="15" height="15" fill="#0f172a"/><rect x="175" y="175" width="20" height="20" fill="#0f172a"/></svg>`;
    const base64 = Buffer.from(svg).toString("base64");

    return NextResponse.json({
      token,
      expires_at: expiresAt,
      record_id: `REC-${patientName.toUpperCase().replace(/\s+/g, "-")}-2026`,
      qr_image_base64: `data:image/svg+xml;base64,${base64}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
  }
}
