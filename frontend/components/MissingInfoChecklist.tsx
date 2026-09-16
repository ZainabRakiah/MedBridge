"use client";

import { MissingInfoItem } from "@/context/AppContext";
import { CheckSquare, Square, AlertCircle, Clock, Info } from "lucide-react";
import { useState } from "react";

interface MissingInfoChecklistProps {
  items: MissingInfoItem[];
}

const IMPORTANCE_CONFIG = {
  HIGH: { dot: "bg-red-400", text: "text-red-400", label: "High Priority" },
  MODERATE: { dot: "bg-amber-400", text: "text-amber-400", label: "Moderate" },
  LOW: { dot: "bg-blue-400", text: "text-blue-400", label: "Low Priority" },
};

const CATEGORY_ICONS: Record<string, typeof AlertCircle> = {
  medication: AlertCircle,
  allergy: AlertCircle,
  lab: Clock,
  symptom: Clock,
  history: Info,
  demographics: Info,
};

export default function MissingInfoChecklist({ items }: MissingInfoChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const highPriority = safeItems.filter((i) => i.importance === "HIGH");
  const moderate = safeItems.filter((i) => i.importance === "MODERATE");
  const low = safeItems.filter((i) => i.importance !== "HIGH" && i.importance !== "MODERATE");

  if (safeItems.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500">
        <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No missing information detected</p>
      </div>
    );
  }

  const renderGroup = (label: string, groupItems: MissingInfoItem[]) => {
    if (groupItems.length === 0) return null;
    return (
      <div className="mb-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{label}</h4>
        <div className="space-y-2">
          {groupItems.map((item, idx) => {
            if (!item) return null;
            const itemId = item.id || `m_${idx}`;
            const Icon = CATEGORY_ICONS[item.category || "info"] || Info;
            const done = checked.has(itemId);
            const impKey = (item.importance || "MODERATE") as keyof typeof IMPORTANCE_CONFIG;
            const imp = IMPORTANCE_CONFIG[impKey] || IMPORTANCE_CONFIG.MODERATE;
            return (
              <div
                key={itemId}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  done ? "border-emerald-500/30 bg-emerald-500/5 opacity-60" : "border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/70"
                }`}
                onClick={() => toggle(itemId)}
              >
                <div className="mt-0.5 shrink-0">
                  {done ? (
                    <CheckSquare className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${imp.dot}`} />
                    <p className={`text-sm font-medium ${done ? "line-through text-slate-500" : "text-white"}`}>
                      {item.description || "Missing clinical detail"}
                    </p>
                  </div>
                  {item.suggested_action && !done && (
                    <p className="text-xs text-slate-500 leading-relaxed">{item.suggested_action}</p>
                  )}
                </div>
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${imp.text} opacity-60`} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const completedCount = checked.size;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Verification progress</span>
          <span className="text-white font-medium">{completedCount}/{safeItems.length}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / safeItems.length) * 100}%` }}
          />
        </div>
      </div>

      {renderGroup("⚠ High Priority — Verify Immediately", highPriority)}
      {renderGroup("Moderate Priority", moderate)}
      {renderGroup("Low Priority", low)}

      <p className="text-xs text-slate-600 mt-2 text-center">
        Click items to mark as reviewed. This does not update the medical record.
      </p>
    </div>
  );
}

