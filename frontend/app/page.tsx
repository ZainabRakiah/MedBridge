import type { Metadata } from "next";
import Link from "next/link";
import {
  Stethoscope, Upload, Activity, Shield, QrCode,
  FileText, GitCompare, CheckSquare, Mic, ChevronRight,
  ArrowRight, Pill, Brain, Database,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MedBridge — AI Medical History Bridge",
  description: "From messy medical history to a verified clinical handoff in seconds.",
};

const features = [
  { title: "Multimodal Document Extraction", desc: "Upload prescriptions, lab reports, discharge summaries. Gemini AI reads everything — even handwritten notes.", icon: Upload, color: "text-blue-400", bg: "bg-blue-500/10" },
  { title: "Patient Timeline", desc: "Every diagnosis, medication, lab result and procedure ordered chronologically with source attribution.", icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { title: "Medication Safety Bridge", desc: "Drug interactions, duplicates, allergy conflicts, dose ambiguity — all surfaced with actionable guidance.", icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10" },
  { title: "Conflict Detection", desc: "Identifies when the same medication appears at different doses in different documents. Never silently guesses.", icon: GitCompare, color: "text-red-400", bg: "bg-red-500/10" },
  { title: "Missing Information Engine", desc: "Surfaces what's absent: missing allergy reactions, undocumented onset dates, absent lab values.", icon: CheckSquare, color: "text-purple-400", bg: "bg-purple-500/10" },
  { title: "Emergency Triage Card + QR", desc: "Compact handoff with allergies, medications, conditions and a secure QR. No raw PHI in the QR payload.", icon: QrCode, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { title: "AI Medical Scribe", desc: "Live consultation recording, Whisper transcription, SOAP note generation with ICD-10 codes.", icon: Mic, color: "text-pink-400", bg: "bg-pink-500/10" },
  { title: "FHIR R4 Export", desc: "Full FHIR Bundle: Patient, Conditions, MedicationRequests, AllergyIntolerances, Observations.", icon: Database, color: "text-indigo-400", bg: "bg-indigo-500/10" },
  { title: "Human-in-the-Loop", desc: "AI generates. Clinician reviews. Every critical field is flagged, every uncertainty is visible.", icon: Brain, color: "text-teal-400", bg: "bg-teal-500/10" },
];

const steps = [
  { step: "01", title: "Upload Records", desc: "Drop prescriptions, lab reports, discharge summaries, handwritten notes, audio recordings.", icon: Upload },
  { step: "02", title: "AI Extracts & Structures", desc: "Gemini multimodal AI reads every document, extracts clinical data, scores confidence.", icon: Brain },
  { step: "03", title: "Review & Verify", desc: "Clinician reviews conflicts, missing info, safety flags, and approves the summary.", icon: Shield },
  { step: "04", title: "Generate Handoff", desc: "Clinical summary, triage card, QR code, and FHIR bundle — ready in seconds.", icon: QrCode },
];

const demoFlow = [
  "Upload prescriptions, lab reports, discharge summary, handwritten Rx, voice note",
  "Gemini extracts medications, diagnoses, lab values, allergies",
  "Timeline built automatically with source attribution",
  "⚠ Medication conflict detected",
  "⚠ Low-confidence handwritten medicine flagged",
  "⚠ Missing allergy reaction type surfaced",
  "Clinician reviews and verifies",
  "Emergency triage card generated",
  "Secure QR code generated (no raw PHI)",
  "FHIR R4 Bundle exported",
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0a0f1e] text-white min-h-[88vh] flex items-center">
        {/* Gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/15 border border-blue-500/30 px-5 py-2 text-sm mb-8 text-blue-400 font-medium">
              <Stethoscope className="h-4 w-4" />
              AI-Powered Medical History Bridge
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 tracking-tight">
              From messy records
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400">
                to clinical clarity.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              MedBridge ingests fragmented patient history — prescriptions, labs, discharge notes, handwritten Rx, voice — and turns it into a structured, verified clinical bridge.
            </p>

            {/* Flow visualization */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-400 mb-10">
              {["Prescriptions", "Lab reports", "Discharge notes", "Handwritten Rx", "Voice"].map((item, i, arr) => (
                <span key={item} className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">{item}</span>
                  {i < arr.length - 1 && <span className="text-slate-600">+</span>}
                </span>
              ))}
              <ArrowRight className="w-5 h-5 text-blue-400 mx-2" />
              <span className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 font-semibold">Verified Clinical Handoff</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-600/30 hover:shadow-blue-600/40 text-base"
              >
                Open MedBridge
                <ChevronRight className="h-5 w-5" />
              </Link>
              <Link
                href="/documents"
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all text-base"
              >
                <Upload className="h-5 w-5" />
                Upload Records
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-950 py-20 sm:py-28 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">How MedBridge Works</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Four steps from fragmented records to verified clinical handoff</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="relative text-center">
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-slate-700 to-transparent" />
                  )}
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 mb-4">
                    <Icon className="w-8 h-8 text-blue-400" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      {s.step.slice(-1)}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-[#0a0f1e] py-20 sm:py-28 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">What MedBridge Does</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">A complete clinical information system — not just a summarizer</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/60 rounded-2xl p-6 transition-all hover:-translate-y-1">
                  <div className={`inline-flex p-2.5 rounded-xl ${f.bg} mb-4`}>
                    <Icon className={`w-6 h-6 ${f.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Demo flow ── */}
      <section className="bg-slate-950 py-20 sm:py-28 border-t border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">The 60-Second Demo</h2>
            <p className="text-slate-400">A patient arrives with a stack of old records and a voice note. Here&apos;s what happens.</p>
          </div>
          <div className="space-y-3">
            {demoFlow.map((step, i) => (
              <div key={i} className={`flex items-start gap-4 p-4 rounded-xl ${
                step.startsWith("⚠") ? "bg-amber-500/8 border border-amber-500/20" : "bg-slate-800/40 border border-slate-700/40"
              }`}>
                <span className={`text-lg font-bold shrink-0 ${step.startsWith("⚠") ? "text-amber-400" : "text-blue-400"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className={`text-sm ${step.startsWith("⚠") ? "text-amber-300 font-medium" : "text-slate-300"}`}>{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-2xl font-bold text-white mb-2">&ldquo;From a messy stack of medical history</p>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-6">to a verified clinical handoff in seconds.&rdquo;</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-600/25"
            >
              Try MedBridge
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Safety disclaimer ── */}
      <section className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-slate-500 leading-relaxed">
            <span className="text-amber-400 font-semibold">⚠ Important Safety Notice:</span>{" "}
            MedBridge is an AI-assisted clinical information tool. It does not diagnose conditions or replace a qualified healthcare professional.
            AI-generated information may contain errors and must be reviewed by a clinician before clinical use.
            Medication alerts require verification by a qualified clinician or pharmacist.
            Do not change or stop medication based solely on this system.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-950 text-slate-500 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm">
          <p className="font-semibold text-slate-400 mb-1">MedBridge — AI Medical History Bridge</p>
          <p>Built for hackathon demonstration. Uses synthetic patient data for demos. Requires physician verification before clinical use.</p>
        </div>
      </footer>
    </>
  );
}
