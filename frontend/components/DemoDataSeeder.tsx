"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function DemoDataSeeder() {
  const { deletePatient } = useApp();

  useEffect(() => {
    // Remove Aarav Sharma demo patient if present in local storage
    const stored = localStorage.getItem("medbridge_patients");
    if (stored) {
      try {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          const aarav = list.find(
            (p: { id?: string; name?: string }) =>
              p.id === "demo_aarav_sharma" || (p.name || "").trim().toLowerCase() === "aarav sharma"
          );
          if (aarav && aarav.id) {
            deletePatient(aarav.id);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [deletePatient]);

  return null;
}

