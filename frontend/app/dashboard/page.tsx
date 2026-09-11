"use client";

import { useApp, Patient, createEmptyPatient } from "@/context/AppContext";
import Link from "next/link";
import { useState } from "react";
import {
  Plus, Upload, Mic, AlertTriangle, GitCompare, CheckSquare,
  Pill, Stethoscope, Activity, FileText, QrCode,
  ArrowRight, Clock, Heart, User, Shield,
} from "lucide-react";

export default function DashboardPage() {
  const { patients, currentPatient, setCurrentPatient, addPatient, deletePatient } = useApp();
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newSex, setNewSex] = useState("M");

  const patient = currentPatient;

  const createPatient = () => {
    if (!newName.trim()) return;
    const p = createEmptyPatient({
      name: newName.trim(),
      age: newAge,
      sex: newSex,
    });
    addPatient(p);
    setCurrentPatient(p);
    setShowNewPatient(false);
    setNewName("");
    setNewAge("");
  };

  const recentEvents = patient?.timeline?.slice(0, 4) || [];
  const safetyCount = patient?.safety_flags?.filter(f => f.severity === "HIGH").length || 0;
  const conflictCount = patient?.conflicts?.length || 0;
  const missingCount = patient?.missing_info?.filter(m => m.importance === "HIGH").length || 0;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">MedBridge Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">AI-powered medical history bridge</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewPatient(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              New Patient
            </button>
            <Link href="/documents" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm border border-slate-700">
              <Upload className="w-4 h-4" />
              Upload Records
            </Link>
            <Link href="/consultation" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-emerald-600/20">
              <Mic className="w-4 h-4" />
              Start Consultation
            </Link>
          </div>
        </div>

        {/* New Patient Modal */}
        {showNewPatient && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-lg font-semibold text-white mb-4">Register New Patient</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Patient Name *</label>
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Age</label>
                    <input
                      value={newAge}
                      onChange={e => setNewAge(e.target.value)}
                      placeholder="54"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Sex</label>
                    <select
                      value={newSex}
                      onChange={e => setNewSex(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewPatient(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={createPatient}
                  disabled={!newName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-40"
                >
                  Create Patient
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Patient selector */}
        {patients.length > 0 && (
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-400 font-medium">Patient:</span>
            <div className="flex gap-2 flex-wrap items-center">
              {patients.map(p => {
                const isSelected = currentPatient?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`inline-flex items-center rounded-xl transition-all border ${
                      isSelected
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/25"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700/80 border-slate-700"
                    }`}
                  >
                    <button
                      onClick={() => setCurrentPatient(p)}
                      className="px-4 py-1.5 text-sm font-medium text-left"
                    >
                      {p.name || "Unnamed"}
                    </button>
                    {patients.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove patient "${p.name || "Unnamed"}"?`)) {
                            deletePatient(p.id);
                          }
                        }}
                        title={`Delete ${p.name || "patient"}`}
                        aria-label={`Delete ${p.name || "patient"}`}
                        className={`pr-2.5 pl-1 py-1.5 text-xs font-bold transition-colors ${
                          isSelected
                            ? "text-blue-200 hover:text-white"
                            : "text-slate-500 hover:text-rose-400"
                        }`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!patient ? (
          /* No patient selected */
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-blue-600/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No patient selected</h2>
            <p className="text-slate-400 text-sm mb-6">Create or select a patient to view their medical bridge</p>
            <button
              onClick={() => setShowNewPatient(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-5 h-5" />
              Create First Patient
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Patient header */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{patient.name || "Unnamed Patient"}</h2>
                      <p className="text-sm text-slate-400">
                        {patient.age && `${patient.age}y`}
                        {patient.sex && ` • ${patient.sex}`}
                        {patient.blood_group && ` • ${patient.blood_group}`}
                      </p>
                    </div>
                  </div>
                  {patient.clinical_summary?.current_complaint && (
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                      <p className="text-xs text-slate-500 font-medium mb-1">CURRENT COMPLAINT</p>
                      <p className="text-sm text-white">{patient.clinical_summary.current_complaint}</p>
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Updated {new Date(patient.updated_at).toLocaleDateString()}</p>
                  <p>{patient.documents.length} documents</p>
                </div>
              </div>
            </div>

            {/* Flags row */}
            {(safetyCount > 0 || conflictCount > 0 || missingCount > 0) && (
              <div className="grid grid-cols-3 gap-4">
                {safetyCount > 0 && (
                  <Link href="/medications" className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/30 hover:bg-red-500/12 transition-all">
                    <Shield className="w-6 h-6 text-red-400" />
                    <div>
                      <p className="text-sm font-semibold text-red-400">⚠ {safetyCount} Safety Flag{safetyCount > 1 ? "s" : ""}</p>
                      <p className="text-xs text-slate-400">Require immediate review</p>
                    </div>
                  </Link>
                )}
                {conflictCount > 0 && (
                  <Link href="/summary" className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/30 hover:bg-amber-500/12 transition-all">
                    <GitCompare className="w-6 h-6 text-amber-400" />
                    <div>
                      <p className="text-sm font-semibold text-amber-400">⚠ {conflictCount} Conflict{conflictCount > 1 ? "s" : ""}</p>
                      <p className="text-xs text-slate-400">Document conflicts detected</p>
                    </div>
                  </Link>
                )}
                {missingCount > 0 && (
                  <Link href="/summary" className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/8 border border-blue-500/30 hover:bg-blue-500/12 transition-all">
                    <CheckSquare className="w-6 h-6 text-blue-400" />
                    <div>
                      <p className="text-sm font-semibold text-blue-400">⚠ {missingCount} Missing</p>
                      <p className="text-xs text-slate-400">High-priority gaps</p>
                    </div>
                  </Link>
                )}
              </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <Stethoscope className="w-5 h-5 text-blue-400" />
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Conditions</span>
                </div>
                <p className="text-2xl font-bold text-white">{patient.conditions.length}</p>
                <div className="mt-2 space-y-1">
                  {patient.conditions.slice(0, 2).map((c, i) => (
                    <p key={i} className="text-xs text-slate-400 truncate">• {c}</p>
                  ))}
                </div>
              </div>
              <div className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <Pill className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Active Medications</span>
                </div>
                <p className="text-2xl font-bold text-white">{patient.medications.filter(m => m.status === "active").length}</p>
                <div className="mt-2 space-y-1">
                  {patient.medications.slice(0, 2).map((m, i) => (
                    <p key={i} className="text-xs text-slate-400 truncate">• {m.name} {m.strength}</p>
                  ))}
                </div>
              </div>
              <div className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <Heart className="w-5 h-5 text-orange-400" />
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Allergies</span>
                </div>
                <p className="text-2xl font-bold text-white">{patient.allergies.length}</p>
                <div className="mt-2 space-y-1">
                  {patient.allergies.slice(0, 2).map((a, i) => (
                    <p key={i} className="text-xs text-orange-400 truncate">• {a}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline + Actions */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent timeline */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Recent Timeline
                  </h3>
                  <Link href="/timeline" className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {recentEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No events yet — upload documents to build the timeline</p>
                ) : (
                  <div className="space-y-3">
                    {recentEvents.map((event, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm text-white">{event.description}</p>
                          <p className="text-xs text-slate-500">{event.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  {[
                    { href: "/documents", label: "Upload Medical Records", icon: Upload, color: "text-blue-400 bg-blue-500/10" },
                    { href: "/summary", label: "Review AI Clinical Summary", icon: FileText, color: "text-emerald-400 bg-emerald-500/10" },
                    { href: "/medications", label: "Medication Safety Check", icon: Shield, color: "text-amber-400 bg-amber-500/10" },
                    { href: "/timeline", label: "View Patient Timeline", icon: Activity, color: "text-purple-400 bg-purple-500/10" },
                    { href: "/triage", label: "Generate Triage Card + QR", icon: QrCode, color: "text-cyan-400 bg-cyan-500/10" },
                    { href: "/referral", label: "Generate Referral", icon: ArrowRight, color: "text-pink-400 bg-pink-500/10" },
                  ].map(({ href, label, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700/50 transition-all group border border-transparent hover:border-slate-700"
                    >
                      <div className={`p-1.5 rounded-lg ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 ml-auto transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Safety disclaimer */}
            <div className="p-4 bg-slate-900/60 border border-slate-700/50 rounded-2xl text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-amber-400 font-semibold">⚠ AI Safety Notice:</span>{" "}
                MedBridge is an AI-assisted clinical information tool. It does not diagnose conditions or replace a qualified healthcare professional.
                AI-generated information may contain errors and must be reviewed before clinical use.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
