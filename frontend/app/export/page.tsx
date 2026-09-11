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
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${API_BASE}/export-fhir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soap_note: soapNote, patient_info: patientInfo }),
  });
  if (!res.ok) throw new Error("FHIR export failed");
  return res.json();
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
    ring: "ring-blue-100",
    header: "bg-blue-50 text-blue-700 border-blue-100",
    badge: "bg-blue-100 text-blue-700",
  },
  objective: {
    title: "Objective",
    short: "O",
    ring: "ring-purple-100",
    header: "bg-purple-50 text-purple-700 border-purple-100",
    badge: "bg-purple-100 text-purple-700",
  },
  assessment: {
    title: "Assessment",
    short: "A",
    ring: "ring-green-100",
    header: "bg-green-50 text-green-700 border-green-100",
    badge: "bg-green-100 text-green-700",
  },
  plan: {
    title: "Plan",
    short: "P",
    ring: "ring-orange-100",
    header: "bg-orange-50 text-orange-700 border-orange-100",
    badge: "bg-orange-100 text-orange-700",
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
      className: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
    };
  }

  if ((confidence || "").toLowerCase().includes("high")) {
    return {
      label: "HIGH",
      className: "bg-green-100 text-green-700 ring-1 ring-green-200",
    };
  }

  return {
    label: "REVIEW NEEDED",
    className: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
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
    patient_name: activePatient.name,
    age: activePatient.age,
    gender: activePatient.gender,
    doctor_name: doctorName,
  };

  const handlePdfExport = async () => {
    try {
      setLoadingExport("pdf");
      setPdfError("");
      setFhirError("");
      const blob = await exportPdf(activeSoapNote as unknown as Record<string, unknown>, patientInfo);
      downloadBlob(blob, `aushadh-${activePatient.name.replace(/\s+/g, "-").toLowerCase()}-${activeConsultation.id}.pdf`);
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
      downloadBlob(blob, `aushadh-${activePatient.name.replace(/\s+/g, "-").toLowerCase()}-${activeConsultation.id}.json`);
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
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div
          className="mb-6 overflow-hidden rounded-[28px] text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, #1a5276 0%, #21618c 55%, #2980b9 100%)" }}
        >
          <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/70">Aushadh Export Center</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Consultation ready for sharing</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                Review the final SOAP note, validate coded findings, and export a professional PDF or ABDM-ready FHIR R4 bundle.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-wide text-white/70">Patient</div>
                <div className="mt-1 text-sm font-semibold">{activePatient.name}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-wide text-white/70">Doctor</div>
                <div className="mt-1 text-sm font-semibold">{doctorName}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm col-span-2 sm:col-span-1">
                <div className="text-xs uppercase tracking-wide text-white/70">Consultation</div>
                <div className="mt-1 text-sm font-semibold">{formatCompactDate(activeConsultation.date)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)] lg:items-start">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">SOAP Note Preview</h2>
                  <p className="mt-1 text-sm text-slate-500">Read-only clinical summary prepared from the approved consultation.</p>
                </div>
                <div className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  Complete Note
                </div>
              </div>

              <div className="mt-5 grid gap-5">
                <article className={clsx("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ring-1", sectionStyles.subjective.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.subjective.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.subjective.badge)}>{sectionStyles.subjective.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold">{sectionStyles.subjective.title}</h3>
                        <p className="text-sm text-current/75">Symptoms, history, and patient-reported details</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", subjectiveConfidence.className)}>
                      {subjectiveConfidence.label}
                    </span>
                  </div>

                  <div className="space-y-5 p-5">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chief Complaint</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{soapNote.subjective.chief_complaint}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">History of Present Illness</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {formatParagraphs(soapNote.subjective.history_of_present_illness).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review of Systems</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {formatParagraphs(soapNote.subjective.review_of_systems).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={clsx("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ring-1", sectionStyles.objective.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.objective.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.objective.badge)}>{sectionStyles.objective.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold">{sectionStyles.objective.title}</h3>
                        <p className="text-sm text-current/75">Vitals, observations, and examination findings</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", objectiveConfidence.className)}>
                      {objectiveConfidence.label}
                    </span>
                  </div>

                  <div className="grid gap-5 p-5 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vitals</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {formatParagraphs(soapNote.objective.vitals).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Physical Exam</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {formatParagraphs(soapNote.objective.physical_exam).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observations</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {formatParagraphs(soapNote.objective.observations).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={clsx("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ring-1", sectionStyles.assessment.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.assessment.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.assessment.badge)}>{sectionStyles.assessment.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold">{sectionStyles.assessment.title}</h3>
                        <p className="text-sm text-current/75">Diagnoses, differential, and coding</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", assessmentConfidence.className)}>
                      {assessmentConfidence.label}
                    </span>
                  </div>

                  <div className="space-y-5 p-5">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary Diagnosis</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{soapNote.assessment.diagnosis}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Differential Diagnosis</div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {formatParagraphs(soapNote.assessment.differential).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">ICD-10 Codes</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {soapNote.assessment.icd10_codes.length > 0 ? (
                          soapNote.assessment.icd10_codes.map((code) => (
                            <span
                              key={`${code.code}-${code.description}`}
                              className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800"
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

                <article className={clsx("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ring-1", sectionStyles.plan.ring)}>
                  <div className={clsx("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", sectionStyles.plan.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold", sectionStyles.plan.badge)}>{sectionStyles.plan.short}</span>
                      <div>
                        <h3 className="text-lg font-semibold">{sectionStyles.plan.title}</h3>
                        <p className="text-sm text-current/75">Medications, tests, and follow-up instructions</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", planConfidence.className)}>
                      {planConfidence.label}
                    </span>
                  </div>

                  <div className="space-y-5 p-5">
                    <div>
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Medications</div>
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Drug</th>
                                <th className="px-4 py-3">Dose</th>
                                <th className="px-4 py-3">Route</th>
                                <th className="px-4 py-3">Frequency</th>
                                <th className="px-4 py-3">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                              {soapNote.plan.medications.length > 0 ? (
                                soapNote.plan.medications.map((medication, index) => (
                                  <tr key={`${medication.drug_name}-${index}`}>
                                    <td className="px-4 py-3 font-medium text-slate-900">{medication.drug_name}</td>
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
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tests Ordered</div>
                        <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                          {formatParagraphs(soapNote.plan.tests_ordered).map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow Up</div>
                        <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
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
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Patient Info Summary</h2>
                  <p className="text-sm text-slate-500">Export metadata captured from the current session</p>
                </div>
              </div>

              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <dt className="text-slate-500">Patient name</dt>
                  <dd className="text-right font-semibold text-slate-900">{activePatient.name}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <dt className="text-slate-500">Age</dt>
                  <dd className="text-right font-semibold text-slate-900">{activePatient.age}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <dt className="text-slate-500">Gender</dt>
                  <dd className="text-right font-semibold text-slate-900">{activePatient.gender}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <dt className="text-slate-500">Doctor name</dt>
                  <dd className="text-right font-semibold text-slate-900">{doctorName}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <dt className="text-slate-500">Consultation date</dt>
                  <dd className="text-right font-semibold text-slate-900">{formatLongDate(today)}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Transcript word count</dt>
                  <dd className="text-right font-semibold text-slate-900">{countWords(transcript)} words</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Export as PDF</h2>
                  <p className="text-sm text-slate-500">Clinical document ready for printing and sharing</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePdfExport}
                disabled={loadingExport !== null}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
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
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{pdfError}</span>
                </div>
              ) : null}

              <p className="mt-4 text-sm leading-6 text-slate-500">
                Professional medical letterhead with prescription table
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Export as FHIR R4</h2>
                  <p className="text-sm text-slate-500">Structured JSON for interoperable health records</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFhirExport}
                disabled={loadingExport !== null}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
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
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{fhirError}</span>
                </div>
              ) : null}

              <p className="mt-4 text-sm leading-6 text-slate-500">
                ABDM compliant FHIR R4 Composition resource
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <RefreshCcw className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
                  <p className="text-sm text-slate-500">Move to the next workflow step</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => router.push("/consultation")}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  Start New Consultation
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/records")}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10"
                >
                  View Patient Records
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/analytics")}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10"
                >
                  Go to Analytics
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-primary/10 bg-primary/[0.03] p-5 text-sm leading-6 text-slate-600 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Export readiness</div>
                  <p className="mt-1">
                    Review badges highlight sections that may need clinician verification before sharing the note externally.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}