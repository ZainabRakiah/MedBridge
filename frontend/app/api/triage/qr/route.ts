import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function POST(req: NextRequest) {
  try {
    const card = await req.json();
    const patientName = card.patient_name || "Patient";
    const token = `MEDBRIDGE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    const recordId = `REC-${String(patientName).toUpperCase().replace(/\s+/g, "-")}-2026`;

    // Construct structured emergency data payload for QR code scanners
    const qrPayload = JSON.stringify({
      title: "MEDBRIDGE EMERGENCY TRIAGE CARD",
      record_id: recordId,
      patient: patientName,
      blood_group: card.blood_group || "N/A",
      allergies: Array.isArray(card.allergies) ? card.allergies.join(", ") : card.allergies || "None",
      medications: Array.isArray(card.current_medications) ? card.current_medications.join(", ") : card.current_medications || "None",
      conditions: Array.isArray(card.known_conditions) ? card.known_conditions.join(", ") : card.known_conditions || "None",
      complaint: card.current_symptoms || "None",
      token,
      expires_at: expiresAt,
    });

    // Generate actual scannable SVG QR Code
    const svgString = await QRCode.toString(qrPayload, {
      type: "svg",
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    const base64 = Buffer.from(svgString).toString("base64");

    return NextResponse.json({
      token,
      expires_at: expiresAt,
      record_id: recordId,
      qr_image_base64: `data:image/svg+xml;base64,${base64}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to generate QR code: " + (err?.message || "Unknown error") }, { status: 500 });
  }
}
