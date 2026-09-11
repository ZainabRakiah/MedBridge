"use client";

import { useApp, TriageCard } from "@/context/AppContext";
import { generateTriageCard, generateQRCode } from "@/services/api";
import { useState } from "react";
import { QrCode, Shield, Pill, Heart, AlertTriangle, Loader2, Printer, Download, Clock, User } from "lucide-react";

export default function TriagePage() {
  const { currentPatient, updateTriageCard } = useApp();
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<{ qr_image_base64: string; expires_at: string; token: string } | null>(null);

  const patient = currentPatient;
  const card = patient?.triage_card;

  const generateCard = async () => {
    if (!patient) return;
    setLoading(true);
    try {
      const result = await generateTriageCard(patient);
      updateTriageCard(patient.id, result as unknown as TriageCard);
    } finally {
      setLoading(false);
    }
  };

  const getQR = async () => {
    if (!card) return;
    setQrLoading(true);
    try {
      const result = await generateQRCode(card);
      setQrData(result);
    } finally {
      setQrLoading(false);
    }
  };

  const print = () => window.print();

  const downloadQR = () => {
    if (!qrData?.qr_image_base64) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${qrData.qr_image_base64}`;
    a.download = `medbridge_qr_${patient?.name?.replace(/\s+/g, "_") || "patient"}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <QrCode className="w-7 h-7 text-cyan-400" />
              Emergency Triage Card
            </h1>
            <p className="text-slate-400 text-sm mt-1">Critical patient information for emergency/triage staff</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generateCard}
              disabled={loading || !patient}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 shadow-lg shadow-cyan-600/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Generate Card
            </button>
            {card && (
              <>
                <button onClick={getQR} disabled={qrLoading} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-sm transition-all">
                  {qrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Generate QR
                </button>
                <button onClick={print} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-sm transition-all">
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </>
            )}
          </div>
        </div>

        {!patient ? (
          <div className="text-center py-20 text-slate-500">
            <QrCode className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p>Select a patient to generate a triage card</p>
          </div>
        ) : !card ? (
          <div className="text-center py-20 bg-slate-800/30 border border-slate-700/50 rounded-2xl">
            <Shield className="w-14 h-14 mx-auto mb-3 text-cyan-400/30" />
            <p className="text-slate-400 font-medium">No triage card generated yet</p>
            <p className="text-sm text-slate-500 mt-1 mb-5">Upload documents and run the full analysis first</p>
            <button
              onClick={generateCard}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Generate Triage Card
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Triage card */}
            <div className="lg:col-span-2">
              {/* Card header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/10">
                <div className="bg-cyan-600/20 border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">MedBridge — Emergency Handoff</p>
                    <h2 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                      <User className="w-6 h-6 text-cyan-400" />
                      {card.patient_name}
                    </h2>
                    {card.blood_group && (
                      <span className="mt-1 inline-block px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-sm font-bold text-red-400">
                        Blood: {card.blood_group}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div className="flex items-center gap-1 text-slate-400 mb-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(card.last_updated).toLocaleString()}
                    </div>
                    <p className="text-amber-400 text-xs font-semibold">⚠ AI-generated — verify before use</p>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Allergies */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-orange-400" />
                      <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider">Allergies</h3>
                    </div>
                    {card.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {card.allergies.map((a, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/40 text-sm font-bold text-orange-400">
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-400">NKDA (No Known Drug Allergies)</p>}
                  </div>

                  {/* Medications */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Pill className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Current Medications</h3>
                    </div>
                    {card.current_medications.length > 0 ? (
                      <div className="space-y-1.5">
                        {card.current_medications.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <p className="text-sm text-white">{m}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-400">None documented</p>}
                  </div>

                  {/* Conditions */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Known Conditions</h3>
                    </div>
                    {card.known_conditions.length > 0 ? (
                      <div className="space-y-1">
                        {card.known_conditions.map((c, i) => (
                          <p key={i} className="text-sm text-slate-300">• {c}</p>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-400">None documented</p>}
                  </div>

                  {/* Current complaint */}
                  {card.current_symptoms && (
                    <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Complaint</h3>
                      <p className="text-sm text-white">{card.current_symptoms}</p>
                    </div>
                  )}

                  {/* Critical warnings */}
                  {card.critical_warnings.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">Critical Warnings</h3>
                      </div>
                      {card.critical_warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-sm text-red-300">{w}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI flags */}
                  {card.ai_flags.length > 0 && (
                    <div className="p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">AI Flags</h3>
                      {card.ai_flags.map((f, i) => <p key={i} className="text-xs text-amber-300">• {f}</p>)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="space-y-5">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 text-center">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  Emergency QR
                </h3>

                {qrData?.qr_image_base64 ? (
                  <>
                    <div className="p-3 bg-white rounded-xl inline-block mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${qrData.qr_image_base64}`}
                        alt="Emergency QR Code"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      Expires: {new Date(qrData.expires_at).toLocaleDateString()}
                    </p>
                    <button onClick={downloadQR} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm transition-all">
                      <Download className="w-4 h-4" />
                      Download QR
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-48 h-48 mx-auto mb-3 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center">
                      <QrCode className="w-16 h-16 text-slate-600" />
                    </div>
                    <button
                      onClick={getQR}
                      disabled={qrLoading}
                      className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    >
                      {qrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                      Generate QR
                    </button>
                  </>
                )}

                <div className="mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-700/50 text-left">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    🔒 QR contains only a signed token. No medical data is encoded. Token expires in 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-slate-900/60 border border-slate-700/50 rounded-2xl text-center">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="text-amber-400 font-semibold">⚠ Emergency Card Disclaimer:</span>{" "}
            This card is AI-generated from uploaded documents and requires verification by a qualified clinician before clinical use.
            QR codes link to a signed secure token only — no PHI is stored in the QR payload.
          </p>
        </div>
      </div>
    </div>
  );
}
