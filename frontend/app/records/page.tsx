"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAllPatients, searchPatients, deletePatient } from "@/services/ehr";
import Navbar from "@/components/Navbar";

type TabKey = "profile" | "history" | "medications";

function splitCsv(value?: string | string[]): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item?.trim())
    .filter((item) => Boolean(item));
}

function formatDate(value?: string): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value?: string): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function RecordsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<any[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [expandedConsultationId, setExpandedConsultationId] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadPatients = () => {
    const all = getAllPatients() || [];
    setPatients(all);
    setFilteredPatients(all);

    if (selectedId) {
      const stillExists = all?.some((p: any) => p?.id === selectedId);
      if (!stillExists) {
        setSelectedId("");
        setActiveTab("profile");
        setExpandedConsultationId("");
      }
    }
  };

  useEffect(() => {
    document.title = "Patient Records — Aushadh";
    loadPatients();
  }, []);

  useEffect(() => {
    if (searchQuery?.trim()) {
      setFilteredPatients(searchPatients(searchQuery?.trim()) || []);
      return;
    }
    setFilteredPatients(patients || []);
  }, [searchQuery, patients]);

  const full = patients?.find((p: any) => p?.id === selectedId);

  const currentMedicationNames = (() => {
    const seen: Record<string, boolean> = {};
    (full?.consultations || []).forEach((consultation: any) => {
      (consultation?.soap_note?.plan?.medications || []).forEach((med: any) => {
        const drugName = med?.drug_name?.trim?.() || "";
        if (drugName && !seen[drugName]) {
          seen[drugName] = true;
        }
      });
    });
    return Object.keys(seen);
  })();

  const sortedConsultations = [...(full?.consultations || [])].sort((a: any, b: any) => {
    const aTime = new Date(a?.date || "").getTime();
    const bTime = new Date(b?.date || "").getTime();
    return bTime - aTime;
  });

  const handleDeletePatient = () => {
    if (!full?.id) return;
    deletePatient(full?.id);
    setShowDeleteModal(false);
    setSelectedId("");
    setActiveTab("profile");
    setExpandedConsultationId("");
    loadPatients();
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="pt-20 px-4 sm:px-6 lg:px-8 pb-6">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[30%_70%] gap-6">
          <aside className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col min-h-[74vh]">
            <h1 className="text-2xl font-bold text-[#1a5276]">Patient Records</h1>

            <div className="mt-4">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event?.target?.value || "")}
                placeholder="Search by name, phone, or ID"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-[#1a5276] focus:ring-2 focus:ring-[#1a5276]/20"
              />
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredPatients?.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  <p>No patients yet — start your first consultation</p>
                  <button
                    onClick={() => router.push("/consultation")}
                    className="mt-3 rounded-lg bg-[#1a5276] px-3 py-2 text-xs font-semibold text-white hover:bg-[#15435f]"
                  >
                    Start New Consultation
                  </button>
                </div>
              ) : (
                filteredPatients?.map((patient: any) => {
                  const consultations = patient?.consultations || [];
                  const lastConsultation = [...consultations].sort((a: any, b: any) => {
                    const aTime = new Date(a?.date || "").getTime();
                    const bTime = new Date(b?.date || "").getTime();
                    return bTime - aTime;
                  })?.[0];

                  return (
                    <button
                      key={patient?.id}
                      onClick={() => {
                        setSelectedId(patient?.id || "");
                        setActiveTab("profile");
                        setExpandedConsultationId("");
                      }}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        selectedId === patient?.id
                          ? "border-[#1a5276] bg-[#1a5276]/5"
                          : "border-gray-200 bg-white hover:border-[#1a5276]/40"
                      }`}
                    >
                      <p className="font-semibold text-gray-900">{patient?.name || "Unnamed"}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {patient?.age || "-"} yrs • {patient?.gender || "-"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {consultations?.length || 0} consultation
                        {(consultations?.length || 0) === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Last: {lastConsultation?.date ? formatShortDate(lastConsultation?.date) : "No visits"}
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={() => router.push("/consultation")}
              className="mt-4 w-full rounded-xl bg-[#1a5276] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#15435f]"
            >
              New Consultation
            </button>
          </aside>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[74vh] p-4 sm:p-6">
            {!full ? (
              <div className="h-full min-h-[65vh] flex flex-col items-center justify-center text-center px-4">
                <div className="text-5xl">📋</div>
                <p className="mt-4 text-lg font-semibold text-gray-800">
                  Select a patient to view their records
                </p>
                <button
                  onClick={() => router.push("/consultation")}
                  className="mt-5 rounded-xl bg-[#1a5276] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#15435f]"
                >
                  Start New Consultation
                </button>
              </div>
            ) : (
              <>
                <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#1a5276]">{full?.name || "Unnamed"}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {full?.age || "-"} yrs • {full?.gender || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Total consultations: {full?.consultations?.length || 0}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push("/consultation")}
                      className="rounded-xl bg-[#1a5276] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#15435f]"
                    >
                      New Consultation
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </header>

                <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3">
                  {[
                    { key: "profile", label: "Profile" },
                    { key: "history", label: "Consultation History" },
                    { key: "medications", label: "Medications" },
                  ]?.map((tab: any) => (
                    <button
                      key={tab?.key}
                      onClick={() => setActiveTab(tab?.key as TabKey)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        activeTab === tab?.key
                          ? "bg-[#1a5276] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {tab?.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  {activeTab === "profile" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: "Name", value: full?.name || "-" },
                          { label: "Age", value: full?.age || "-" },
                          { label: "Gender", value: full?.gender || "-" },
                          { label: "Phone", value: full?.phone || "-" },
                        ]?.map((item: any) => (
                          <div key={item?.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-gray-500">{item?.label}</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{item?.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900">Allergies</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {splitCsv(full?.allergies)?.length > 0 ? (
                            splitCsv(full?.allergies)?.map((item) => (
                              <span
                                key={`allergy-${item}`}
                                className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
                              >
                                {item}
                              </span>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No allergies recorded</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900">Chronic Conditions</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {splitCsv(full?.chronic_conditions)?.length > 0 ? (
                            splitCsv(full?.chronic_conditions)?.map((item) => (
                              <span
                                key={`condition-${item}`}
                                className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700"
                              >
                                {item}
                              </span>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No chronic conditions</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900">Current Medications</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {currentMedicationNames?.length > 0 ? (
                            currentMedicationNames?.map((drugName: string) => (
                              <span
                                key={`current-med-${drugName}`}
                                className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
                              >
                                {drugName}
                              </span>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No medications recorded</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "history" && (
                    <div className="space-y-3">
                      {sortedConsultations?.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                          No consultations yet
                        </div>
                      ) : (
                        sortedConsultations?.map((consultation: any) => {
                          const isExpanded = expandedConsultationId === consultation?.id;
                          return (
                            <div key={consultation?.id} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                              <button
                                onClick={() =>
                                  setExpandedConsultationId(
                                    isExpanded ? "" : consultation?.id || ""
                                  )
                                }
                                className="w-full text-left p-4 hover:bg-gray-50 transition"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {formatDate(consultation?.date)}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-600">
                                      Doctor: {consultation?.doctorName || "Not specified"}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700">
                                      Diagnosis: {consultation?.soap_note?.assessment?.diagnosis || "Not recorded"}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {(consultation?.soap_note?.assessment?.icd10_codes || [])?.map((codeObj: any, idx: number) => (
                                      <span
                                        key={`${consultation?.id}-icd-${codeObj?.code || idx}`}
                                        className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                                      >
                                        {codeObj?.code || "N/A"}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="border-t border-gray-100 p-4 space-y-3">
                                  <div className="rounded-lg bg-blue-50 p-3">
                                    <p className="text-xs font-bold text-blue-700">S — Subjective</p>
                                    <p className="mt-1 text-sm text-gray-800">
                                      <span className="font-semibold">Chief Complaint:</span>{" "}
                                      {consultation?.soap_note?.subjective?.chief_complaint || "Not recorded"}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-800">
                                      <span className="font-semibold">HPI:</span>{" "}
                                      {consultation?.soap_note?.subjective?.history_of_present_illness || "Not recorded"}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-purple-50 p-3">
                                    <p className="text-xs font-bold text-purple-700">O — Objective</p>
                                    <p className="mt-1 text-sm text-gray-800">
                                      <span className="font-semibold">Vitals:</span>{" "}
                                      {consultation?.soap_note?.objective?.vitals || "Not recorded"}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-800">
                                      <span className="font-semibold">Physical Exam:</span>{" "}
                                      {consultation?.soap_note?.objective?.physical_exam || "Not recorded"}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-green-50 p-3">
                                    <p className="text-xs font-bold text-green-700">A — Assessment</p>
                                    <p className="mt-1 text-sm text-gray-800">
                                      <span className="font-semibold">Diagnosis:</span>{" "}
                                      {consultation?.soap_note?.assessment?.diagnosis || "Not recorded"}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {(consultation?.soap_note?.assessment?.icd10_codes || [])?.map((codeObj: any, idx: number) => (
                                        <span
                                          key={`${consultation?.id}-icd-full-${codeObj?.code || idx}`}
                                          className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                                        >
                                          {(codeObj?.code || "N/A") + " " + (codeObj?.description || "")}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="rounded-lg bg-orange-50 p-3">
                                    <p className="text-xs font-bold text-orange-700">P — Plan</p>

                                    <div className="mt-2 overflow-x-auto rounded-lg border border-orange-100 bg-white">
                                      <table className="min-w-full text-xs sm:text-sm">
                                        <thead className="bg-orange-100/70 text-orange-800">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-semibold">Drug</th>
                                            <th className="px-3 py-2 text-left font-semibold">Dose</th>
                                            <th className="px-3 py-2 text-left font-semibold">Route</th>
                                            <th className="px-3 py-2 text-left font-semibold">Frequency</th>
                                            <th className="px-3 py-2 text-left font-semibold">Duration</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(consultation?.soap_note?.plan?.medications || [])?.length > 0 ? (
                                            (consultation?.soap_note?.plan?.medications || [])?.map((med: any, index: number) => (
                                              <tr key={`${consultation?.id}-med-${index}`} className="border-t border-orange-100">
                                                <td className="px-3 py-2">{med?.drug_name || "-"}</td>
                                                <td className="px-3 py-2">{med?.dose || "-"}</td>
                                                <td className="px-3 py-2">{med?.route || "-"}</td>
                                                <td className="px-3 py-2">{med?.frequency || "-"}</td>
                                                <td className="px-3 py-2">{med?.duration || "-"}</td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td colSpan={5} className="px-3 py-3 text-center text-gray-500">
                                                No medications recorded
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <p className="mt-3 text-sm text-gray-800">
                                      <span className="font-semibold">Follow-up:</span>{" "}
                                      {consultation?.soap_note?.plan?.follow_up || "Not recorded"}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeTab === "medications" && (
                    <div className="space-y-3">
                      {(() => {
                        const patient = full;
                        const groups: Record<string, any[]> = {};
                        patient?.consultations?.forEach((c: any) => {
                          (c?.soap_note?.plan?.medications || []).forEach((med: any) => {
                            const drugName = med?.drug_name || "Unknown";
                            if (!groups[drugName]) groups[drugName] = [];
                            groups[drugName].push({ ...med, date: c?.date });
                          });
                        });

                        const names = Object.keys(groups);

                        if (names?.length === 0) {
                          return (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                              No medications recorded
                            </div>
                          );
                        }

                        return names?.map((drugName: string) => (
                          <div key={drugName} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                            <h4 className="text-base font-semibold text-[#1a5276]">{drugName}</h4>
                            <div className="mt-2 space-y-2">
                              {(groups?.[drugName] || [])?.map((prescription: any, idx: number) => (
                                <div
                                  key={`${drugName}-${idx}`}
                                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                                >
                                  <p>
                                    <span className="font-semibold">Date:</span>{" "}
                                    {formatShortDate(prescription?.date)}
                                  </p>
                                  <p>
                                    <span className="font-semibold">Dose:</span> {prescription?.dose || "-"}
                                  </p>
                                  <p>
                                    <span className="font-semibold">Frequency:</span>{" "}
                                    {prescription?.frequency || "-"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </section>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Delete patient record?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will remove {full?.name || "this patient"} and all linked consultations permanently.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePatient}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
