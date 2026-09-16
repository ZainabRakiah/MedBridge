import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient_id, statement } = body || {};

    const event = {
      id: `voice_${Date.now()}`,
      patient_id: patient_id || "patient",
      date: new Date().toISOString().split("T")[0],
      event_type: "symptoms",
      description: statement || "Reported symptoms via voice intake",
      confidence: 0.9,
      verification_status: "patient_reported",
      metadata: { source_label: "Voice intake via MedBridge" },
    };

    return NextResponse.json([event]);
  } catch (err: any) {
    return NextResponse.json([], { status: 200 });
  }
}
