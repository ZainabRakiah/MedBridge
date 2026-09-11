"use client";

import { TimelineEvent } from "@/context/AppContext";
import {
  Activity, Pill, FlaskConical, Stethoscope, Heart,
  AlertTriangle, ClipboardList, ArrowRight, Mic, FileText,
  CheckCircle2, Clock, XCircle,
} from "lucide-react";

const EVENT_CONFIG: Record<string, { icon: typeof Activity; color: string; bg: string; label: string }> = {
  diagnosis: { icon: Stethoscope, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", label: "Diagnosis" },
  medication_started: { icon: Pill, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Medication Started" },
  medication_stopped: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Medication Stopped" },
  medication_changed: { icon: ArrowRight, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "Medication Changed" },
  lab_result: { icon: FlaskConical, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30", label: "Lab Result" },
  procedure: { icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30", label: "Procedure" },
  hospitalization: { icon: Heart, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Hospitalization" },
  discharge: { icon: ClipboardList, color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/30", label: "Discharge" },
  consultation: { icon: Stethoscope, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", label: "Consultation" },
  allergy: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", label: "Allergy" },
  follow_up: { icon: Clock, color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/30", label: "Follow-up" },
  referral: { icon: ArrowRight, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30", label: "Referral" },
  symptoms: { icon: Mic, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/30", label: "Symptoms Reported" },
};

const DEFAULT_CONFIG = {
  icon: FileText,
  color: "text-slate-400",
  bg: "bg-slate-500/10 border-slate-500/30",
  label: "Event",
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400";
  const dot = pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {pct}%
    </span>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    clinician_verified: { label: "✓ Verified", className: "text-emerald-400 bg-emerald-500/10" },
    patient_reported: { label: "Patient", className: "text-blue-400 bg-blue-500/10" },
    unverified: { label: "Unverified", className: "text-amber-400 bg-amber-500/10" },
    review_required: { label: "⚠ Review", className: "text-red-400 bg-red-500/10" },
  };
  const cfg = configs[status] || configs.unverified;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

interface PatientTimelineProps {
  events: TimelineEvent[];
  showSource?: boolean;
}

export default function PatientTimeline({ events, showSource = true }: PatientTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No timeline events yet</p>
        <p className="text-sm mt-1">Upload medical documents to build the patient timeline</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[22px] top-0 bottom-0 w-px bg-slate-700/60" />

      <div className="space-y-4">
        {events.map((event, idx) => {
          const cfg = EVENT_CONFIG[event.event_type] || DEFAULT_CONFIG;
          const Icon = cfg.icon;
          const isAbnormal = event.metadata?.abnormal as boolean;

          return (
            <div key={event.id || idx} className="flex gap-4 group">
              {/* Icon bubble */}
              <div className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-full border flex items-center justify-center ${cfg.bg} transition-transform group-hover:scale-110`}>
                <Icon className={`w-5 h-5 ${cfg.color}`} />
              </div>

              {/* Content card */}
              <div className={`flex-1 bg-slate-800/50 border rounded-xl p-4 hover:bg-slate-800/80 transition-all ${
                isAbnormal ? "border-amber-500/40" : "border-slate-700/50"
              }`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {isAbnormal && (
                      <span className="ml-2 text-xs text-amber-400 font-medium">⚠ Abnormal</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ConfidenceBadge confidence={event.confidence} />
                    <VerificationBadge status={event.verification_status} />
                  </div>
                </div>

                <p className="mt-1 text-sm text-white font-medium">{event.description}</p>

                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span>{event.date || "Date unknown"}</span>
                  {Boolean(showSource && event.metadata?.source_label) && (
                    <>
                      <span>•</span>
                      <span>{String(event.metadata.source_label)}</span>
                    </>
                  )}
                  {event.source_type === "voice" && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-pink-400">
                        <Mic className="w-3 h-3" /> Voice description
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
