"use client";

import { SafetyFlag } from "@/context/AppContext";
import { AlertTriangle, ShieldAlert, Info, CheckCircle2 } from "lucide-react";

interface SafetyAlertProps {
  flag: SafetyFlag;
  compact?: boolean;
}

const SEVERITY_CONFIG = {
  HIGH: {
    border: "border-red-500/50",
    bg: "bg-red-500/8",
    badge: "bg-red-500/20 text-red-400 border border-red-500/30",
    icon: ShieldAlert,
    iconColor: "text-red-400",
    label: "HIGH",
    glow: "shadow-red-500/10",
  },
  MODERATE: {
    border: "border-amber-500/50",
    bg: "bg-amber-500/8",
    badge: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    label: "MODERATE",
    glow: "shadow-amber-500/10",
  },
  LOW: {
    border: "border-blue-500/50",
    bg: "bg-blue-500/8",
    badge: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    icon: Info,
    iconColor: "text-blue-400",
    label: "LOW",
    glow: "",
  },
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  interaction: "Drug Interaction",
  duplicate: "Duplicate Medication",
  allergy_conflict: "Allergy Conflict",
  dose_ambiguity: "Dose Ambiguity",
  contraindication: "Contraindication",
};

export default function SafetyAlertCard({ flag, compact = false }: SafetyAlertProps) {
  const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.MODERATE;
  const Icon = cfg.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
        <Icon className={`w-4 h-4 shrink-0 ${cfg.iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{flag.description}</p>
          <p className="text-xs text-slate-400 mt-0.5">{flag.drug1}{flag.drug2 ? ` + ${flag.drug2}` : ""}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-lg ${cfg.border} ${cfg.bg} ${cfg.glow}`}>
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${flag.severity === "HIGH" ? "bg-red-500/20" : flag.severity === "MODERATE" ? "bg-amber-500/20" : "bg-blue-500/20"}`}>
          <Icon className={`w-6 h-6 ${cfg.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
              {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
            </span>
          </div>

          {/* Drug names */}
          {(flag.drug1 || flag.drug2) && (
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-white">
              <span className="px-2 py-0.5 bg-slate-700 rounded-lg">{flag.drug1}</span>
              {flag.drug2 && (
                <>
                  <span className="text-slate-500">+</span>
                  <span className="px-2 py-0.5 bg-slate-700 rounded-lg">{flag.drug2}</span>
                </>
              )}
            </div>
          )}

          <p className="text-sm text-slate-300 leading-relaxed">{flag.description}</p>

          {/* Action */}
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
            <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">{flag.action}</p>
          </div>

          <p className="mt-2 text-xs text-slate-600">Source: {flag.source}</p>
        </div>
      </div>

      {flag.requires_verification && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2 text-xs text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Requires verification by qualified clinician or pharmacist
        </div>
      )}
    </div>
  );
}
