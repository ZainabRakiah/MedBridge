"use client";

import { useApp } from "@/context/AppContext";
import { generateReferral } from "@/services/api";
import { useState } from "react";
import { ArrowRight, Loader2, Download, FileText } from "lucide-react";

export default function ReferralPage() {
  const { currentPatient, patients } = useApp();
  const activePatient = currentPatient || (patients && patients.length > 0 ? patients[0] : null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState<Record<string, unknown> | null>(null);

  const generate = async () => {
    if (!activePatient || !reason.trim()) return;
    setLoading(true);
    try {
      const result = await generateReferral(activePatient, reason);
      setReferral(result);
    } finally {
      setLoading(false);
    }
  };

  const downloadReferral = () => {
    if (!referral) return;
    const text = referral.referral_letter
      ? String(referral.referral_letter)
      : Object.entries(referral)
          .filter(([k]) => k !== "disclaimer")
          .map(([k, v]) => `${k.replace(/_/g, " ").toUpperCase()}:\n${Array.isArray(v) ? v.join("\n") : v}`)
          .join("\n\n");
    const blob = new Blob([`MEDBRIDGE REFERRAL DRAFT\n\n${text}\n\n---\n${referral.disclaimer || "AI-generated draft — requires clinician review before submission"}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `referral_${activePatient?.name?.replace(/\s+/g, "_") || "patient"}.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ArrowRight className="w-7 h-7 text-pink-400" />
            Referral Preparation
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI-generated referral draft — requires clinician review and approval</p>
        </div>

        {!activePatient ? (
          <div className="text-center py-20 text-slate-500">
            <FileText className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p>Select a patient to generate a referral</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Referral Reason *</h3>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Patient requires cardiology assessment for chest discomfort and elevated troponin..."
                rows={4}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={generate}
                  disabled={loading || !reason.trim()}
                  className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 shadow-lg shadow-pink-600/20 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Generate Referral Draft
                </button>
                {referral && (
                  <button onClick={downloadReferral} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl text-sm transition-all cursor-pointer">
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
              </div>
            </div>

            {referral && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Referral Summary — DRAFT</h2>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-400">DRAFT — REQUIRES REVIEW</span>
                </div>

                {referral.referral_letter ? (
                  <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-700/60 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {String(referral.referral_letter)}
                  </div>
                ) : null}

                {[
                  ["reason_for_referral", "Reason for Referral"],
                  ["previous_treatment", "Previous Treatment"],
                ].map(([key, label]) => Boolean(referral[key]) ? (
                  <div key={key}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</h3>
                    <p className="text-sm text-slate-300">{String(referral[key])}</p>
                  </div>
                ) : null)}

                {[
                  ["relevant_history", "Relevant History"],
                  ["current_medications", "Current Medications"],
                  ["relevant_investigations", "Relevant Investigations"],
                  ["questions_for_specialist", "Questions for Specialist"],
                ].map(([key, label]) => Array.isArray(referral[key]) && (referral[key] as string[]).length > 0 ? (
                  <div key={key}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</h3>
                    <ul className="space-y-1">
                      {(referral[key] as string[]).map((item, i) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-pink-400 mt-0.5">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null)}

                <div className="p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <p className="text-xs text-amber-400 font-medium">{String(referral.disclaimer || "AI-generated draft — requires clinician review and signature before clinical submission")}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
