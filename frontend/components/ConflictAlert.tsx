"use client";

import { ConflictItem } from "@/context/AppContext";
import { GitCompare, AlertTriangle } from "lucide-react";

interface ConflictAlertProps {
  conflict: ConflictItem;
}

const SEVERITY_STYLES = {
  HIGH: "border-red-500/50 bg-red-500/5",
  MODERATE: "border-amber-500/50 bg-amber-500/5",
  LOW: "border-blue-500/50 bg-blue-500/5",
};

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  medication_dose: "Medication Dose Conflict",
  allergy_status: "Allergy Status Conflict",
  diagnosis_date: "Diagnosis Date Conflict",
  dob: "Date of Birth Mismatch",
  lab_value: "Lab Value Conflict",
  medication_status: "Medication Status Conflict",
};

export default function ConflictAlertCard({ conflict }: ConflictAlertProps) {
  if (!conflict) return null;
  const severityStyle = SEVERITY_STYLES[(conflict.severity || "MODERATE") as keyof typeof SEVERITY_STYLES] || SEVERITY_STYLES.MODERATE;
  const rawType = conflict.conflict_type || "medication_dose";
  const typeLabel = CONFLICT_TYPE_LABELS[rawType] || String(rawType).replace(/_/g, " ");

  return (
    <div className={`rounded-2xl border p-5 ${severityStyle}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-xl bg-amber-500/10 shrink-0">
          <GitCompare className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
              conflict.severity === "HIGH" ? "text-red-400 bg-red-500/20 border border-red-500/30" :
              conflict.severity === "MODERATE" ? "text-amber-400 bg-amber-500/20 border border-amber-500/30" :
              "text-blue-400 bg-blue-500/20 border border-blue-500/30"
            }`}>
              ⚠ CONFLICT
            </span>
            <span className="text-xs text-slate-400">{typeLabel}</span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1">{conflict.field || "Clinical Conflict"}</h4>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1 font-medium">Source A</p>
          <p className="text-sm text-white font-semibold">{conflict.value_a || "Not specified"}</p>
          <p className="text-xs text-slate-500 mt-1">{conflict.source_a || "Document"}</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1 font-medium">Source B</p>
          <p className="text-sm text-white font-semibold">{conflict.value_b || "Not specified"}</p>
          <p className="text-xs text-slate-500 mt-1">{conflict.source_b || "Document"}</p>
        </div>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed">{conflict.description || "Clinical discrepancy noted."}</p>

      <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 border-t border-slate-700/50 pt-3">
        <AlertTriangle className="w-3.5 h-3.5" />
        Please verify the correct value with the original documents and clinician.
      </div>
    </div>
  );
}

