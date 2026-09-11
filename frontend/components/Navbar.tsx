"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  Activity, Upload, Mic, Shield, FileText,
  QrCode, ArrowRight, LayoutDashboard, Pill,
  Menu, X, Stethoscope,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: Upload },
  { href: "/timeline", label: "Timeline", icon: Activity },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/summary", label: "Summary", icon: FileText },
  { href: "/triage", label: "Triage", icon: QrCode },
  { href: "/consultation", label: "Scribe", icon: Mic },
  { href: "/referral", label: "Referral", icon: ArrowRight },
];

export default function Navbar() {
  const pathname = usePathname();
  const { currentPatient } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
              <Stethoscope className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <span className="text-base font-bold text-white">MedBridge</span>
              <span className="hidden sm:block text-[10px] text-slate-500 leading-none">AI Medical History Bridge</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Current patient indicator */}
            {currentPatient && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-slate-300 font-medium max-w-24 truncate">{currentPatient.name}</span>
              </div>
            )}

            {/* Safety flag badge */}
            {currentPatient && currentPatient.safety_flags?.some(f => f.severity === "HIGH") && (
              <Link href="/medications" className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400 font-semibold">
                <Shield className="w-3.5 h-3.5" />
                {currentPatient.safety_flags.filter(f => f.severity === "HIGH").length} High
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="lg:hidden bg-slate-950 border-t border-slate-800 px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-blue-600/20 text-blue-400" : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
