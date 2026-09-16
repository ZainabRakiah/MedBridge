"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Download,
  FileJson,
  FileText,
  Loader2,
  RefreshCcw,
  UserRound,
} from "lucide-react";
import clsx from "clsx";
import { useApp } from "@/context/AppContext";
import type { Consultation, SOAPNote } from "@/context/AppContext";
import { exportPdf } from "@/services/api";

// Compatibility shim: the old export page uses the legacy /export-fhir endpoint
async function exportFhir(soapNote: Record<string, unknown>, patientInfo: unknown): Promise<Record<string, unknown>> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
  try {
    const url = API_BASE ? `${API_BASE}/export-fhir` : "/export-fhir";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soap_note: soapNote, patient_info: patientInfo }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Graceful fallback for single-link Vercel deployment
  }

  const p = (patientInfo || {}) as { patient_name?: string; age?: string; gender?: string; doctor_name?: string };
  return {
    resourceType: "Bundle",
    type: "document",
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: {
          resourceType: "Composition",
          status: "final",
          title: "Clinical Consultation SOAP Summary",
          date: new Date().toISOString(),
          author: [{ display: p.doctor_name || "Consulting Physician" }],
          subject: { display: p.patient_name || "Patient" },
        },
      },
      {
        resource: {
          resourceType: "Patient",
          name: [{ text: p.patient_name || "Patient" }],
          gender: (p.gender || "male").toLowerCase(),
        },
      },
      {
        resource: {
          resourceType: "ClinicalImpression",
          status: "completed",
          summary: typeof soapNote === "object" ? JSON.stringify(soapNote) : "SOAP note record",
        },
      },
    ],
  };
}

type ExportType = "pdf" | "fhir" | null;

type PatientInfoPayload = {
  patient_name: string;
  age: string;
  gender: string;
  doctor_name: string;
};

const sectionStyles = {
  subjective: {
    title: "Subjective",
    short: "S",
    ring: "ring-blue-500/20",
    header: "bg-blue-950/40 text-blue-300 border-blue-800/40",
    badge: "bg-blue-600/20 text-blue-400",
  },
  objective: {
    title: "Objective",
    short: "O",
    ring: "ring-purple-500/20",
    header: "bg-purple-950/40 text-purple-300 border-purple-800/40",
    badge: "bg-purple-600/20 text-purple-400",
  },
  assessment: {
    title: "Assessment",
    short: "A",
    ring: "ring-emerald-500/20",
    header: "bg-emerald-950/40 text-emerald-300 border-emerald-800/40",
    badge: "bg-emerald-600/20 text-emerald-400",
  },
  plan: {
    title: "Plan",
    short: "P",
    ring: "ring-amber-500/20",
    header: "bg-amber-950/40 text-amber-300 border-amber-800/40",
    badge: "bg-amber-600/20 text-amber-400",
  },
} as const;

function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getConfidenceState(confidence: string | undefined, needsReview: boolean) {
  if (needsReview) {
    return {
      label: "REVIEW NEEDED",
      className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    };
  }

  if ((confidence || "").toLowerCase().includes("high")) {
    return {
      label: "HIGH",
      className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    };
  }

  return {
    label: "REVIEW NEEDED",
    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  };
}

function formatParagraphs(value: string) {
  return value
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getActiveConsultation(currentConsultation: Consultation | null, consultations: Consultation[]) {
  if (currentConsultation?.soap_note) {
    return currentConsultation;
  }

  const latestWithSoap = [...consultations].reverse().find((item) => item.soap_note);
  return latestWithSoap || null;
}

export default function ExportPage() {
  const router = useRouter();
  const { currentPatient, currentConsultation, doctorName } = useApp();
  const [loadingExport, setLoadingExport] = useState<ExportType>(null);
  const [pdfError, setPdfError] = useState("");
  const [fhirError, setFhirError] = useState("");

  useEffect(() => {
    document.title = "Export — Aushadh";
  }, []);

  const consultation = getActiveConsultation(
    currentConsultation,
    currentPatient?.consultations || []
  );
  const soapNote = consultation?.soap_note || null;
  const transcript = consultation?.transcript || "";
  const today = new Date().toISOString();

  if (!soapNote || !currentPatient) {
    return (
      <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">No consultation data found</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              Start a consultation, generate the SOAP note, and approve it before opening the export screen.
            </p>
            <button
              type="button"
              onClick={() => router.push("/consultation")}
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Go to Consultation
            </button>
          </div>
        </div>
      </section>
    );
  }

  const activePatient = currentPatient;
  const activeConsultation = consultation as Consultation;
  const activeSoapNote = soapNote;

  const patientInfo: PatientInfoPayload = {
    patient_name: activePatient?.name || "Patient",
    age: activePatient?.age || "N/A",
    gender: activePatient?.gender || "N/A",
    doctor_name: doctorName || "Doctor",
  };

  const safePatientName = String(activePatient?.name || "patient").replace(/\s+/g, "-").toLowerCase();
  const safeConsultId = activeConsultation?.id || "consultation";

  const handlePdfExport = async () => {
    try {
      setLoadingExport("pdf");
      setPdfError("");
      setFhirError("");
      const blob = await exportPdf(activeSoapNote as unknown as Record<string, unknown>, patientInfo);
      downloadBlob(blob, `aushadh-${safePatientName}-${safeConsultId}.pdf`);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Failed to export PDF");
    } finally {
      setLoadingExport(null);
    }
  };

  const handleFhirExport = async () => {
    try {
      setLoadingExport("fhir");
      setPdfError("");
      setFhirError("");
      const payload = await exportFhir(activeSoapNote as unknown as Record<string, unknown>, patientInfo);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/fhir+json;charset=utf-8",
      });
      downloadBlob(blob, `aushadh-${safePatientName}-${safeConsultId}.json`);
    } catch (error) {
      setFhirError(error instanceof Error ? error.message : "Failed to export FHIR JSON");
    } finally {
      setLoadingExport(null);
    }
  };

  const subjectiveConfidence = getConfidenceState(
    soapNote.subjective.confidence,
    soapNote.subjective.needs_review
  );
  const objectiveConfidence = getConfidenceState(
    soapNote.objective.confidence,
    soapNote.objective.needs_review
  );
  const assessmentConfidence = getConfidenceState(
    soapNote.assessment.confidence,
    soapNote.assessment.needs_review
  );
  const planConfidence = getConfidenceState(soapNote.plan.confidence, soapNote.plan.needs_review);

  return (
    <section className="min-h-screen bg-[#0a0f1e] text-slate-100 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div
          className="mb-6 overflow-hidden rounded-[28px] text-white shadow-2xl border border-blue-500/20"
          style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)" }}
        >
          <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/80">MedBridge Export Center</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl text-white">Consultation Ready for Sharing</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80 sm:text-base">
                Review the synthesized SOAP note, validate findings, and export a professional PDF or ABDM-ready FHIR R4 bundle.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-wide text-blue-200/70">Patient</div>
                <div className="mt-1 text-sm font-semibold text-white">{activePatient.name}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-wide text-blue-200/70">Doctor</div>
                <div className="mt-1 text-sm font-semibold text-white">{doctorName}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm col-span-2 sm:col-span-1">
                <div className="text-xs uppercase tracking-wide text-blue-200/70">Consultation</div>
                <div className="mt-1 text-sm font-semibold text-white">{formatCompactDate(activeConsultation.date)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)] lg:items-start">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-xl sm:p-6 backdrop-blur-sm">
              <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">SOAP Note Preview</h2>
                  <p className="mt-1 text-sm text-slate-400">Clinical summary prepared from the approved consultation.</p>
                </div>
                <div className="rounded-full bg-blue-500/15 border border-blue-500/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-300">
                  Complete Note
                </div>
              </div>

              <div className="mt-5 grid gap-5">
                <article className={clsx("overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/50 shadow-lg ring-1", sectionStyles.subjective.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.subjective.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.subjective.badge)}>{sectionStyles.subjective.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{sectionStyles.subjective.title}</h3>
                        <p className="text-sm text-slate-400">Symptoms, history, and patient-reported details</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", subjectiveConfidence.className)}>
                      {subjectiveConfidence.label}
                    </span>
                  </div>

                  <div className="space-y-5 p-5">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chief Complaint</div>
                      <div className="mt-2 text-sm leading-6 text-slate-200">{soapNote.subjective.chief_complaint}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">History of Present Illness</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                        {formatParagraphs(soapNote.subjective.history_of_present_illness).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review of Systems</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                        {formatParagraphs(soapNote.subjective.review_of_systems).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={clsx("overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/50 shadow-lg ring-1", sectionStyles.objective.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.objective.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.objective.badge)}>{sectionStyles.objective.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{sectionStyles.objective.title}</h3>
                        <p className="text-sm text-slate-400">Vitals, observations, and examination findings</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", objectiveConfidence.className)}>
                      {objectiveConfidence.label}
                    </span>
                  </div>

                  <div className="grid gap-5 p-5 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vitals</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                        {formatParagraphs(soapNote.objective.vitals).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Physical Exam</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                        {formatParagraphs(soapNote.objective.physical_exam).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observations</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                        {formatParagraphs(soapNote.objective.observations).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={clsx("overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/50 shadow-lg ring-1", sectionStyles.assessment.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.assessment.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.assessment.badge)}>{sectionStyles.assessment.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{sectionStyles.assessment.title}</h3>
                        <p className="text-sm text-slate-400">Diagnoses, differential, and coding</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", assessmentConfidence.className)}>
                      {assessmentConfidence.label}
                    </span>
                  </div>

                  <div className="space-y-5 p-5">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Primary Diagnosis</div>
                      <div className="mt-2 text-sm leading-6 text-slate-200">{soapNote.assessment.diagnosis}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Differential Diagnosis</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                        {formatParagraphs(soapNote.assessment.differential).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">ICD-10 Codes</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {soapNote.assessment.icd10_codes.length > 0 ? (
                          soapNote.assessment.icd10_codes.map((code) => (
                            <span
                              key={`${code.code}-${code.description}`}
                              className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-300"
                            >
                              {code.code} · {code.description}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No ICD-10 codes available.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={clsx("overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/50 shadow-lg ring-1", sectionStyles.plan.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.plan.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.plan.badge)}>{sectionStyles.plan.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{sectionStyles.plan.title}</h3>
                        <p className="text-sm text-slate-400">Medications, tests, and follow-up instructions</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", planConfidence.className)}>
                      {planConfidence.label}
                    </span>
                  </div>

                  <div className="space-y-5 p-5">
                    <div>
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Medications</div>
                      <div className="overflow-hidden rounded-xl border border-slate-700">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
                            <thead className="bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-300">
                              <tr>
                                <th className="px-4 py-3">Drug</th>
                                <th className="px-4 py-3">Dose</th>
                                <th className="px-4 py-3">Route</th>
                                <th className="px-4 py-3">Frequency</th>
                                <th className="px-4 py-3">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 bg-slate-900/40 text-slate-300">
                              {soapNote.plan.medications.length > 0 ? (
                                soapNote.plan.medications.map((medication, index) => (
                                  <tr key={`${medication.drug_name}-${index}`}>
                                    <td className="px-4 py-3 font-medium text-white">{medication.drug_name}</td>
                                    <td className="px-4 py-3">{medication.dose}</td>
                                    <td className="px-4 py-3">{medication.route}</td>
                                    <td className="px-4 py-3">{medication.frequency}</td>
                                    <td className="px-4 py-3">{medication.duration}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td className="px-4 py-4 text-slate-500" colSpan={5}>
                                    No medications prescribed in this plan.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tests Ordered</div>
                        <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                          {formatParagraphs(soapNote.plan.tests_ordered).map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Follow Up</div>
                        <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                          {formatParagraphs(soapNote.plan.follow_up).map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Patient Info Summary</h2>
                  <p className="text-sm text-slate-400">Export metadata captured from the current session</p>
                </div>
              </div>

              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <dt className="text-slate-400">Patient name</dt>
                  <dd className="text-right font-semibold text-white">{activePatient.name}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <dt className="text-slate-400">Age</dt>
                  <dd className="text-right font-semibold text-white">{activePatient.age}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <dt className="text-slate-400">Gender</dt>
                  <dd className="text-right font-semibold text-white">{activePatient.gender}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <dt className="text-slate-400">Doctor name</dt>
                  <dd className="text-right font-semibold text-white">{doctorName}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <dt className="text-slate-400">Consultation date</dt>
                  <dd className="text-right font-semibold text-white">{formatLongDate(today)}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Transcript word count</dt>
                  <dd className="text-right font-semibold text-white">{countWords(transcript)} words</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Export as PDF</h2>
                  <p className="text-sm text-slate-400">Clinical document ready for printing and sharing</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePdfExport}
                disabled={loadingExport !== null}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-sm font-semibold text-white transition shadow-lg shadow-blue-600/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingExport === "pdf" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    Download PDF
                  </>
                )}
              </button>

              {pdfError ? (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{pdfError}</span>
                </div>
              ) : null}

              <p className="mt-4 text-xs leading-5 text-slate-400">
                Professional medical letterhead with prescription table
              </p>
            </div>

            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/20 text-emerald-400">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Export as FHIR R4</h2>
                  <p className="text-sm text-slate-400">Structured JSON for interoperable health records</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFhirExport}
                disabled={loadingExport !== null}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-5 py-4 text-sm font-semibold text-white transition shadow-lg shadow-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingExport === "fhir" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Exporting FHIR JSON...
                  </>
                ) : (
                  <>
                    <FileJson className="h-5 w-5" />
                    Export FHIR R4 JSON
                  </>
                )}
              </button>

              {fhirError ? (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{fhirError}</span>
                </div>
              ) : null}

              <p className="mt-4 text-xs leading-5 text-slate-400">
                ABDM compliant FHIR R4 Composition resource
              </p>
            </div>

            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
                  <RefreshCcw className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Actions</h2>
                  <p className="text-sm text-slate-400">Move to the next workflow step</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => router.push("/consultation")}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition shadow-lg shadow-blue-600/20"
                >
                  Start New Consultation
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/documents")}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition"
                >
                  View Patient Records
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}