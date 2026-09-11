"use client";

import { useApp } from "@/context/AppContext";
import SafetyAlertCard from "@/components/SafetyAlert";
import ConflictAlertCard from "@/components/ConflictAlert";
import { checkMedicationSafety } from "@/services/api";
import { useState } from "react";
import { Shield, Pill, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export default function MedicationsPage() {
  const { currentPatient, patients, updatePatientSafetyFlags } = useApp();
  const [loading, setLoading] = useState(false);

  const patient = currentPatient || (patients && patients.length > 0 ? patients[0] : null);
  const medications = patient?.medications || [];

  const runSafetyCheck = async () => {
    if (!patient || medications.length === 0) return;
    setLoading(true);
    try {
      const result = await checkMedicationSafety(medications, patient.allergies || []);
      updatePatientSafetyFlags(patient.id, result.flags as any);
    } finally {
      setLoading(false);
    }
  };

  const flags = patient?.safety_flags || [];
  const highFlags = flags.filter(f => f.severity === "HIGH");
  const moderateFlags = flags.filter(f => f.severity === "MODERATE");
  const lowFlags = flags.filter(f => f.severity === "LOW");

  const safetyStatus = highFlags.length > 0 ? "CRITICAL" : moderateFlags.length > 0 ? "REVIEW_REQUIRED" : flags.length === 0 && medications.length ? "OK" : "NOT_CHECKED";

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Shield className="w-7 h-7 text-amber-400" />
              Medication Safety Bridge
            </h1>
            <p className="text-slate-400 text-sm mt-1">Drug interactions • Duplicates • Allergy conflicts • Dose ambiguity</p>
          </div>
          <button
            onClick={runSafetyCheck}
            disabled={loading || !patient}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-40 shadow-lg shadow-amber-600/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Run Safety Check
          </button>
        </div>

        {!patient ? (
          <div className="text-center py-20 text-slate-500">
            <Shield className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p>Select a patient to check medication safety</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Medication list */}
            <div className="lg:col-span-1 space-y-4">
              {/* Status banner */}
              <div className={`p-4 rounded-2xl border text-center ${
                safetyStatus === "CRITICAL" ? "bg-red-500/10 border-red-500/40" :
                safetyStatus === "REVIEW_REQUIRED" ? "bg-amber-500/10 border-amber-500/40" :
                safetyStatus === "OK" ? "bg-emerald-500/10 border-emerald-500/40" :
                "bg-slate-800/50 border-slate-700/50"
              }`}>
                {safetyStatus === "CRITICAL" && <p className="text-red-400 font-bold text-lg">🚨 CRITICAL</p>}
                {safetyStatus === "REVIEW_REQUIRED" && <p className="text-amber-400 font-bold text-lg">⚠ REVIEW REQUIRED</p>}
                {safetyStatus === "OK" && <p className="text-emerald-400 font-bold text-lg">✓ No Issues Found</p>}
                {safetyStatus === "NOT_CHECKED" && <p className="text-slate-400 text-sm">Run safety check to analyze</p>}
                {flags.length > 0 && <p className="text-sm text-slate-400 mt-1">{flags.length} flag{flags.length > 1 ? "s" : ""} detected</p>}
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-400" />
                  Medication List ({medications.length})
                </h3>
                {medications.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No medications extracted yet</p>
                ) : (
                  <div className="space-y-3">
                    {medications.map((med, i) => {
                      const medName = (med.name || "").toLowerCase();
                      const hasFlag = flags.some(f => 
                        (f.drug1 && f.drug1.toLowerCase().includes(medName)) ||
                        (f.drug2 && f.drug2.toLowerCase().includes(medName)) ||
                        (f.title && f.title.toLowerCase().includes(medName)) ||
                        (f.description && f.description.toLowerCase().includes(medName))
                      );
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border ${
                            hasFlag ? "border-amber-500/40 bg-amber-500/5" : "border-slate-700/50 bg-slate-800/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{med.name}</p>
                              <p className="text-xs text-slate-400">{med.strength} • {med.frequency}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {hasFlag && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                              <span className={`text-xs font-mono ${med.confidence >= 0.8 ? "text-emerald-400" : med.confidence >= 0.6 ? "text-amber-400" : "text-red-400"}`}>
                                {Math.round(med.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-xs rounded-md ${
                              med.status === "active" ? "text-emerald-400 bg-emerald-500/10" :
                              med.status === "stopped" ? "text-red-400 bg-red-500/10" :
                              "text-amber-400 bg-amber-500/10"
                            }`}>
                              {med.status}
                            </span>
                            {med.verification_status === "clinician_verified" && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Allergies */}
              {patient.allergies.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    Documented Allergies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {patient.allergies.map((a, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-sm text-orange-400 font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Safety flags */}
            <div className="lg:col-span-2 space-y-5">
              {flags.length === 0 && safetyStatus !== "NOT_CHECKED" && (
                <div className="text-center py-16 text-slate-500">
                  <CheckCircle2 className="w-14 h-14 mx-auto mb-3 text-emerald-400/30" />
                  <p className="text-lg font-medium text-emerald-400">No safety flags detected</p>
                  <p className="text-sm mt-1">All medications passed the safety check</p>
                </div>
              )}

              {highFlags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">🚨 High Severity</h3>
                  <div className="space-y-4">{highFlags.map(f => <SafetyAlertCard key={f.id} flag={f} />)}</div>
                </div>
              )}
              {moderateFlags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">⚠ Moderate</h3>
                  <div className="space-y-4">{moderateFlags.map(f => <SafetyAlertCard key={f.id} flag={f} />)}</div>
                </div>
              )}
              {lowFlags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">ℹ Low</h3>
                  <div className="space-y-4">{lowFlags.map(f => <SafetyAlertCard key={f.id} flag={f} />)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-slate-900/60 border border-slate-700/50 rounded-2xl text-center">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="text-amber-400 font-semibold">Medication Safety Disclaimer:</span>{" "}
            Alerts are informational and require verification by a qualified clinician or pharmacist.
            Do not change or stop medication based solely on this system.
          </p>
        </div>
      </div>
    </div>
  );
}
