"use client";

import { useApp, ClinicalSummary } from "@/context/AppContext";
import ConflictAlertCard from "@/components/ConflictAlert";
import MissingInfoChecklist from "@/components/MissingInfoChecklist";
import { generateClinicalSummary, exportFhirBundle } from "@/services/api";
import { useState } from "react";
import {
  FileText, AlertTriangle, GitCompare, CheckSquare, Brain,
  Download, Loader2, RefreshCw, ChevronDown, ChevronRight,
  Pill, Heart, ClipboardList, Stethoscope,
} from "lucide-react";

function Section({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: typeof FileText; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-700/30 transition-colors"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-blue-400" />
          {title}
        </h3>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export default function SummaryPage() {
  const { currentPatient, patients, updateClinicalSummary, updatePatientConflicts, updatePatientMissingInfo } = useApp();
  const [loading, setLoading] = useState(false);
  const [fhirLoading, setFhirLoading] = useState(false);

  const patient = currentPatient || (patients && patients.length > 0 ? patients[0] : null);
  const summary = patient?.clinical_summary;

  const generateSummary = async () => {
    if (!patient) return;
    setLoading(true);
    try {
      const result = await generateClinicalSummary(patient);
      updateClinicalSummary(patient.id, result as unknown as ClinicalSummary);
    } finally {
      setLoading(false);
    }
  };

  const downloadFhir = async () => {
    if (!patient) return;
    setFhirLoading(true);
    try {
      const bundle = await exportFhirBundle(patient);
      const blob = new Blob([bundle], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medbridge_fhir_${(patient.name || "patient").replace(/\s+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setFhirLoading(false);
    }
  };

  const relevantHistory = summary?.relevant_history || [];
  const allergies = summary?.allergies || [];
  const currentMeds = summary?.current_medications || [];
  const recentInvs = summary?.recent_investigations || [];
  const aiFlags = summary?.ai_flags || [];
  const questions = summary?.suggested_questions || [];
  const conflicts = patient?.conflicts || [];
  const missingInfo = patient?.missing_info || [];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="w-7 h-7 text-blue-400" />
              Clinical Summary & Verification
            </h1>
            <p className="text-slate-400 text-sm mt-1">AI-generated summary — requires clinician review before clinical use</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generateSummary}
              disabled={loading || !patient}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Generate Summary
            </button>
            <button
              onClick={downloadFhir}
              disabled={fhirLoading || !patient}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 cursor-pointer"
            >
              {fhirLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export FHIR
            </button>
          </div>
        </div>

        {!patient ? (
          <div className="text-center py-20 text-slate-500">
            <FileText className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p>Select a patient to view the clinical summary</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* AI Summary */}
            {summary ? (
              <>
                <Section title="Patient Snapshot" icon={Stethoscope}>
                  <div className="space-y-4">
                    {summary.patient_overview && (
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Overview</p>
                        <p className="text-sm text-slate-300">{summary.patient_overview}</p>
                      </div>
                    )}
                    {summary.current_complaint && (
                      <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                        <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Current Complaint</p>
                        <p className="text-sm text-white font-medium">{summary.current_complaint}</p>
                      </div>
                    )}
                  </div>
                </Section>

                <div className="grid md:grid-cols-2 gap-5">
                  <Section title="Relevant History" icon={ClipboardList}>
                    {relevantHistory.length > 0 ? (
                      <ul className="space-y-1.5">
                        {relevantHistory.map((h, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>{h}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-slate-500">None documented</p>}
                  </Section>

                  <Section title="Allergies" icon={Heart}>
                    {allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {allergies.map((a, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-sm text-orange-400 font-medium">
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">No allergies documented</p>}
                  </Section>

                  <Section title="Current Medications" icon={Pill}>
                    {currentMeds.length > 0 ? (
                      <div className="space-y-2">
                        {currentMeds.slice(0, 6).map((m, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                            <div>
                              <p className="text-sm text-white">{m.name} {m.strength}</p>
                              <p className="text-xs text-slate-500">{m.frequency}</p>
                            </div>
                            <span className={`text-xs font-mono ${(m.confidence || 0.9) >= 0.8 ? "text-emerald-400" : (m.confidence || 0.9) >= 0.6 ? "text-amber-400" : "text-red-400"}`}>
                              {Math.round((m.confidence || 0.9) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">No medications extracted</p>}
                  </Section>

                  <Section title="Recent Investigations" icon={FileText}>
                    {recentInvs.length > 0 ? (
                      <ul className="space-y-1.5">
                        {recentInvs.map((inv, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-purple-400 mt-0.5">•</span>{inv}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-slate-500">None documented</p>}
                  </Section>
                </div>

                {/* AI flags */}
                {aiFlags.length > 0 && (
                  <Section title={`AI Safety Flags (${aiFlags.length})`} icon={AlertTriangle}>
                    <div className="space-y-2">
                      {aiFlags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-200">{flag}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Suggested questions */}
                {questions.length > 0 && (
                  <Section title="Questions for Clinician Review" icon={ClipboardList} defaultOpen={false}>
                    <div className="space-y-2">
                      {questions.map((q, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-700">
                          <span className="text-blue-400 font-semibold text-sm">{i + 1}.</span>
                          <p className="text-sm text-slate-300">{q}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            ) : (
              <div className="text-center py-16 bg-slate-800/30 border border-slate-700/50 rounded-2xl">
                <Brain className="w-14 h-14 mx-auto mb-3 text-blue-400/30" />
                <p className="text-slate-400 font-medium">No clinical summary generated yet</p>
                <p className="text-sm text-slate-500 mt-1 mb-5">Upload documents and then click "Generate Summary"</p>
                <button
                  onClick={generateSummary}
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  Generate AI Summary
                </button>
              </div>
            )}

            {/* Conflicts */}
            {conflicts.length > 0 && (
              <Section title={`Document Conflicts (${conflicts.length})`} icon={GitCompare}>
                <div className="space-y-4">
                  {conflicts.map((c, i) => <ConflictAlertCard key={i} conflict={c} />)}
                </div>
              </Section>
            )}

            {/* Missing info */}
            {missingInfo.length > 0 && (
              <Section title={`Missing Information (${missingInfo.length})`} icon={CheckSquare}>
                <MissingInfoChecklist items={missingInfo} />
              </Section>
            )}

            {/* Safety disclaimer */}
            <div className="p-4 bg-slate-900/60 border border-slate-700/50 rounded-2xl text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-amber-400 font-semibold">⚠ AI Clinical Information Tool:</span>{" "}
                This summary is AI-generated and does not diagnose conditions or replace a qualified healthcare professional.
                All information requires verification before clinical use. Review and approve each section before finalizing.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
