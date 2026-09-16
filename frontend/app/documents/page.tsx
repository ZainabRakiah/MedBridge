"use client";

import { useApp } from "@/context/AppContext";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import DocumentUploader from "@/components/DocumentUploader";
import { MedicalDocument } from "@/context/AppContext";
import { generateTimeline, checkMedicationSafety, detectConflicts, detectMissingInfo } from "@/services/api";
import { FileText, AlertTriangle, Pill, FlaskConical, Stethoscope, ArrowRight, Loader2 } from "lucide-react";

export default function DocumentsPage() {
  const { currentPatient, patients, setCurrentPatient, addDocument, updatePatientTimeline, updatePatientSafetyFlags, updatePatientConflicts, updatePatientMissingInfo } = useApp();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<MedicalDocument[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activePatient = currentPatient || (patients && patients.length > 0 ? patients[0] : null);

  const handleDocExtracted = useCallback((doc: MedicalDocument) => {
    if (!doc || !doc.id) return;
    let pid = currentPatient?.id;
    if (!pid && patients && patients.length > 0) {
      pid = patients[0].id;
      setCurrentPatient(patients[0]);
    }
    if (pid) {
      addDocument(pid, doc);
    }
    setUploadedDocs(prev => [...(prev || []).filter(Boolean), doc]);
  }, [currentPatient, patients, setCurrentPatient, addDocument]);

  const runFullAnalysis = async () => {
    const patient = activePatient;
    if (!patient) return;
    const patientDocs = Array.isArray(patient.documents) ? patient.documents : [];
    const safeUploadedDocs = Array.isArray(uploadedDocs) ? uploadedDocs : [];
    if (patientDocs.length === 0 && safeUploadedDocs.length === 0) return;
    setProcessing(true);

    try {
      const allDocsToAnalyze = Array.from(
        new Map(
          [...patientDocs, ...safeUploadedDocs]
            .filter((d): d is MedicalDocument => Boolean(d && d.id))
            .map(d => [d.id, d])
        ).values()
      );

      // 1. Generate timeline
      setProcessMsg("Building patient timeline...");
      const timeline = await generateTimeline(patient.id, allDocsToAnalyze) as MedicalDocument[];
      updatePatientTimeline(patient.id, (timeline || []) as any);

      // 2. Medication safety
      setProcessMsg("Running medication safety checks...");
      const meds = Array.isArray(patient.medications) ? patient.medications : [];
      if (meds.length > 0) {
        const safety = await checkMedicationSafety(meds, patient.allergies || []);
        updatePatientSafetyFlags(patient.id, (safety?.flags as any) || []);
      }

      // 3. Conflict detection
      setProcessMsg("Detecting document conflicts...");
      const conflicts = await detectConflicts(patient);
      updatePatientConflicts(patient.id, (conflicts as any)?.conflicts || []);

      // 4. Missing info
      setProcessMsg("Identifying missing information...");
      const missing = await detectMissingInfo(patient);
      updatePatientMissingInfo(patient.id, (missing as any)?.items || []);

      setProcessMsg("Analysis complete!");
      setTimeout(() => router.push("/summary"), 1200);
    } catch (err) {
      setProcessMsg(`Analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  };

  const patientDocs = Array.isArray(activePatient?.documents) ? activePatient.documents : [];
  const safeUploadedDocs = Array.isArray(uploadedDocs) ? uploadedDocs : [];

  const allDocs = Array.from(
    new Map(
      [...patientDocs, ...safeUploadedDocs]
        .filter((d): d is MedicalDocument => Boolean(d && d.id))
        .map(d => [d.id, d])
    ).values()
  );

  const noPatient = !activePatient;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Medical Document Intelligence</h1>
          <p className="text-slate-400 text-sm">Upload prescriptions, lab reports, discharge summaries — Gemini AI extracts and structures everything</p>
        </div>

        {noPatient && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">Please create or select a patient from the Dashboard before uploading documents.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upload area */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <DocumentUploader
                patientId={activePatient?.id || "demo_aarav_sharma"}
                onDocumentExtracted={handleDocExtracted}
              />
            </div>

            {/* Analysis trigger */}
            {allDocs.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={runFullAnalysis}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 cursor-pointer"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {processMsg}
                    </>
                  ) : (
                    <>
                      <Stethoscope className="w-5 h-5" />
                      Run Full Analysis (Timeline + Safety + Conflicts)
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Uploaded docs summary */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Extracted Data</h3>

            {allDocs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No documents uploaded yet</p>
            ) : (
              allDocs.map((doc) => {
                if (!doc || !doc.id) return null;
                const ext = doc.extracted_data || {
                  medications: [],
                  diagnoses: [],
                  lab_results: [],
                  warnings: [],
                };
                const docType = (doc.type || "document").replace(/_/g, " ");
                const confidence = typeof doc.confidence === "number" ? doc.confidence : 0.94;
                const confidencePct = Math.round(confidence * 100);

                return (
                  <div key={doc.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <FileText className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{doc.filename || "Uploaded Document"}</p>
                        <p className="text-xs text-slate-500 capitalize">{docType} • {doc.date || "Date unknown"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { icon: Pill, label: "Medications", count: Array.isArray(ext.medications) ? ext.medications.length : 0, color: "text-emerald-400" },
                        { icon: Stethoscope, label: "Diagnoses", count: Array.isArray(ext.diagnoses) ? ext.diagnoses.length : 0, color: "text-blue-400" },
                        { icon: FlaskConical, label: "Lab Results", count: Array.isArray(ext.lab_results) ? ext.lab_results.length : 0, color: "text-purple-400" },
                        { icon: AlertTriangle, label: "Warnings", count: Array.isArray(ext.warnings) ? ext.warnings.length : 0, color: "text-amber-400" },
                      ].map(({ icon: Icon, label, count, color }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${color}`} />
                          <span className="text-slate-400">{count} {label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${confidence >= 0.8 ? "bg-emerald-500" : confidence >= 0.6 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${confidencePct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{confidencePct}%</span>
                    </div>

                    {doc.verification_status === "unverified" && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        Requires clinician verification
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Safety disclaimer */}
        <div className="mt-8 p-4 bg-slate-900/60 border border-slate-700/50 rounded-2xl text-center">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="text-amber-400 font-semibold">AI Extraction Disclaimer:</span>{" "}
            All extracted medical information is AI-generated and requires verification by a qualified clinician before clinical use.
            Handwritten documents may have lower accuracy — always cross-reference with the original.
          </p>
        </div>
      </div>
    </div>
  );
}

