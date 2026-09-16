"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Mic,
  MicOff,
  Square,
  AlertTriangle,
  Edit3,
  Check,
  ChevronRight,
  ArrowLeft,
  User,
  Phone,
  Clock,
  Pill,
  Heart,
  Shield,
  X,
} from "lucide-react";
import clsx from "clsx";
import StepIndicator from "@/components/StepIndicator";
import { useApp } from "@/context/AppContext";
import type { Patient, SOAPNote, Consultation } from "@/context/AppContext";
import { transcribeAudio, generateSoapNote as generateNote, checkLegacyInteractions as checkInteractions } from "@/services/api";
import {
  searchPatients as ehrSearch,
  createPatient,
  getPatientHistory,
  addConsultationToPatient,
} from "@/services/ehr";

const STEPS = ["Patient", "Record", "Review", "SOAP"];

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: string;
  description: string;
}

export default function ConsultationPage() {
  const router = useRouter();
  const {
    currentPatient,
    setCurrentPatient,
    setCurrentConsultation,
    addPatient,
    addConsultation,
    doctorName,
    setDoctorName,
    isRecording,
    setIsRecording,
  } = useApp();

  // ── Step state ──
  const [step, setStep] = useState(1);

  // ── Step 1 state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    allergies: "",
    chronic_conditions: "",
  });
  const [bloodGroup, setBloodGroup] = useState("O+");

  // ── Step 2 state ──
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [recordWarning, setRecordWarning] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Step 3 state ──
  const [editedTranscript, setEditedTranscript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingDrugSafety, setIsCheckingDrugSafety] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // ── Step 4 state ──
  const [soapNote, setSoapNote] = useState<SOAPNote | null>(null);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedSoap, setEditedSoap] = useState<SOAPNote | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    document.title = "AI Medical Scribe — MedBridge";
  }, []);

  // ── Search patients ──
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setSearchResults(ehrSearch(searchQuery.trim()));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // ── Timer for recording ──
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>("");

  // ── Recording functions ──
  const startRecording = useCallback(async () => {
    try {
      setRecordError("");
      setRecordWarning("");
      liveTranscriptRef.current = "";

      // Initialize Web Speech API for real-time speech capture
      if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
        try {
          const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-US";
          rec.onresult = (event: any) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript + " ";
            }
            const trimmed = fullText.trim();
            if (trimmed) {
              liveTranscriptRef.current = trimmed;
              setTranscript(trimmed);
              setEditedTranscript(trimmed);
            }
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        } catch {
          // Non-blocking
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTimer(0);
    } catch {
      setRecordError("Microphone permission required or recording failed. Please re-record.");
    }
  }, [setIsRecording]);

  const stopRecording = useCallback(async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        setIsRecording(false);
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setIsTranscribing(true);

        try {
          const result = await transcribeAudio(blob);
          const speechFromMic = liveTranscriptRef.current.trim();
          const isFallback = Boolean((result as any)?.fallback);
          const finalTranscript =
            (isFallback && speechFromMic) ? speechFromMic : (result?.transcript?.trim() || speechFromMic);

          if (!finalTranscript) {
            setRecordWarning("No speech detected in recording. Please try again.");
            return;
          }
          setTranscript(finalTranscript);
          setEditedTranscript(finalTranscript);
          setLanguage(result?.language || "en");
          setAudioDuration(result?.duration || 10);
          setStep(3);
        } catch {
          if (liveTranscriptRef.current.trim()) {
            const speech = liveTranscriptRef.current.trim();
            setTranscript(speech);
            setEditedTranscript(speech);
            setStep(3);
          } else {
            setRecordError("Transcription failed. Please re-record.");
          }
        } finally {
          setIsTranscribing(false);
        }
        resolve();
      };

      mediaRecorderRef.current!.stop();
    });
  }, [setIsRecording]);

  // ── Generate SOAP note ──
  const handleGenerate = async () => {
    if (!currentPatient || !editedTranscript.trim()) return;

    setIsGenerating(true);
    setGenerateError("");

    try {
      const history = getPatientHistory(currentPatient.id);
      const result = await generateNote(editedTranscript, history || undefined);
      const note = result as unknown as SOAPNote;
      setSoapNote(note);
      setEditedSoap(JSON.parse(JSON.stringify(note)));

      // Check drug interactions
      const meds = note.plan?.medications?.map((m) => m.drug_name).filter(Boolean) || [];
      if (meds.length >= 2) {
        setIsCheckingDrugSafety(true);
        const interactionResult = await checkInteractions(meds);
        setInteractions(interactionResult.interactions as DrugInteraction[]);
      }

      setStep(4);
    } catch {
      setGenerateError("Note generation failed. Please try again.");
    } finally {
      setIsCheckingDrugSafety(false);
      setIsGenerating(false);
    }
  };

  const resetLocalConsultationState = () => {
    setStep(1);
    setSearchQuery("");
    setSearchResults([]);
    setShowNewForm(false);
    setTranscript("");
    setEditedTranscript("");
    setLanguage("");
    setAudioDuration(0);
    setTimer(0);
    setIsTranscribing(false);
    setRecordError("");
    setRecordWarning("");
    setIsGenerating(false);
    setIsCheckingDrugSafety(false);
    setGenerateError("");
    setSoapNote(null);
    setEditedSoap(null);
    setInteractions([]);
    setEditingSection(null);
  };

  // ── Approve & Save ──
  const handleApprove = () => {
    if (!currentPatient || !editedSoap) return;

    const consultation: Consultation = {
      id: `CON-${Date.now()}`,
      date: new Date().toISOString(),
      transcript: editedTranscript,
      soap_note: editedSoap,
      audio_duration: audioDuration,
    };

    setCurrentConsultation(consultation);
    setCurrentPatient({
      ...currentPatient,
      consultations: [...currentPatient.consultations, consultation],
    });
    addConsultation(currentPatient.id, consultation);
    addConsultationToPatient(currentPatient.id, consultation);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
    resetLocalConsultationState();
    setTimeout(() => {
      router.push("/export");
    }, 900);
  };

  // ── Create new patient ──
  const handleCreatePatient = () => {
    if (!newPatient.name.trim() || !newPatient.age.trim()) return;

    const patient = createPatient({
      ...newPatient,
      chronic_conditions: newPatient.chronic_conditions
        ? `${newPatient.chronic_conditions}|BG:${bloodGroup}`
        : `BG:${bloodGroup}`,
    });
    addPatient(patient);
    setCurrentPatient(patient);
    setStep(2);
  };

  // ── Select existing patient ──
  const selectPatient = (patient: Patient) => {
    setCurrentPatient(patient);
    setSearchQuery("");
    setSearchResults([]);
  };

  // ── Soap editing helpers ──
  const updateSoapField = (
    section: "subjective" | "objective" | "assessment" | "plan",
    field: string,
    value: string
  ) => {
    if (!editedSoap) return;
    setEditedSoap({
      ...editedSoap,
      [section]: { ...editedSoap[section], [field]: value },
    });
  };

  const wordCount = editedTranscript.trim().split(/\s+/).filter(Boolean).length;

  // ═══════════════════════════════════════
  // STEP 1 — Patient Selection
  // ═══════════════════════════════════════
  const renderStep1 = () => (
    <div className="max-w-xl mx-auto">
      <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
        <h2 className="text-2xl font-bold text-white mb-1">Select Patient</h2>
        <p className="text-slate-400 text-sm mb-6">
          Search for an existing patient or register a new one
        </p>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search patient by name or phone..."
            className="w-full pl-11 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
              {searchResults.map((p) => {
                const lastVisit = p.consultations.length > 0
                  ? new Date(p.consultations[p.consultations.length - 1].date).toLocaleDateString()
                  : "No visits";
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-700/70 flex items-center justify-between border-b border-slate-700/50 last:border-0 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">
                        {p.age} yrs • {p.phone || "No phone"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-blue-400" />
                      {lastVisit}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected patient card */}
        {currentPatient && (
          <div className="border border-blue-500/30 bg-blue-600/10 rounded-xl p-5 mb-6 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-white">{currentPatient.name}</div>
                  <div className="text-xs text-slate-400">
                    {currentPatient.age} yrs • {currentPatient.gender || currentPatient.sex || "N/A"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCurrentPatient(null)}
                className="text-slate-400 hover:text-white transition-colors"
                title="Deselect patient"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {currentPatient.phone && (
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                {currentPatient.phone}
              </div>
            )}

            {/* Badges */}
            <div className="space-y-2">
              {currentPatient.allergies && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-rose-400" /> Allergies:
                  </span>
                  {(Array.isArray(currentPatient.allergies) ? currentPatient.allergies : String(currentPatient.allergies || "").split(",")).map((a) => (
                    <span
                      key={String(a)}
                      className="text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2.5 py-0.5 rounded-full"
                    >
                      {String(a).trim()}
                    </span>
                  ))}
                </div>
              )}
              {(currentPatient.chronic_conditions || currentPatient.conditions) && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <Heart className="h-3 w-3 text-amber-400" /> Chronic:
                  </span>
                  {(Array.isArray(currentPatient.chronic_conditions)
                    ? currentPatient.chronic_conditions
                    : Array.isArray(currentPatient.conditions)
                    ? currentPatient.conditions
                    : String(currentPatient.chronic_conditions || "").split(",")
                  )
                    .filter((c) => !String(c).trim().startsWith("BG:"))
                    .map((c) => (
                      <span
                        key={String(c)}
                        className="text-xs bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-0.5 rounded-full"
                      >
                        {String(c).trim()}
                      </span>
                    ))}
                </div>
              )}

              {/* Last 2 consultations */}
              {currentPatient.consultations && currentPatient.consultations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/60">
                  <div className="text-xs font-medium text-slate-400 mb-2">Recent Visits</div>
                  {currentPatient.consultations.slice(-2).map((c) => (
                    <div key={c.id} className="text-xs text-slate-400 mb-1">
                      {new Date(c.date).toLocaleDateString()} —{" "}
                      <span className="text-slate-300">{c.soap_note?.assessment?.diagnosis || "No diagnosis"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25"
            >
              Start Consultation <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* New patient link / form */}
        {!currentPatient && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="text-sm text-blue-400 font-medium hover:text-blue-300 transition-colors"
            >
              {showNewForm ? "Cancel" : "New Patient? Register here →"}
            </button>

            {showNewForm && (
              <div className="mt-4 space-y-3 animate-fade-in">
                <input
                  type="text"
                  placeholder="Patient Name *"
                  className="w-full px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Age *"
                    className="px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                  />
                  <select
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                  >
                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                      <option key={bg}>{bg}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Phone Number"
                    className="px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Allergies (comma separated)"
                  className="w-full px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  value={newPatient.allergies}
                  onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Chronic Conditions (comma separated)"
                  className="w-full px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  value={newPatient.chronic_conditions}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, chronic_conditions: e.target.value })
                  }
                />
                <button
                  onClick={handleCreatePatient}
                  disabled={!newPatient.name.trim() || !newPatient.age.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25"
                >
                  Create Patient & Continue <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // STEP 2 — Record Consultation
  // ═══════════════════════════════════════
  const renderStep2 = () => (
    <div className="max-w-lg mx-auto text-center">
      {/* Patient info box */}
      {currentPatient && (
        <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl shadow-xl p-4 mb-8 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <span className="font-semibold text-white block">{currentPatient.name}</span>
                <span className="text-xs text-slate-400">
                  {currentPatient.age} yrs • {currentPatient.gender || currentPatient.sex || "N/A"}
                </span>
              </div>
            </div>
            {currentPatient.allergies && (
              <span className="text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-rose-400" />
                {Array.isArray(currentPatient.allergies)
                  ? currentPatient.allergies.join(", ")
                  : currentPatient.allergies}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2.5 pt-2 border-t border-slate-800">
            Recording tip: Place microphone between clinician and patient
          </div>
        </div>
      )}

      {/* Transcribing overlay */}
      {isTranscribing && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
          <div className="text-lg font-semibold text-white mt-4">
            Transcribing consultation with Whisper...
          </div>
          <p className="text-xs text-slate-400 mt-1">Processing audio stream</p>
        </div>
      )}

      {/* Main record button */}
      <div className="mb-6">
        <button
          onClick={isRecording ? undefined : startRecording}
          className={clsx(
            "h-32 w-32 rounded-full mx-auto flex items-center justify-center transition-all cursor-pointer shadow-2xl",
            isRecording
              ? "bg-rose-500/20 text-rose-400 border-2 border-rose-500 shadow-rose-500/30 animate-pulse"
              : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
          )}
        >
          {isRecording ? (
            <Mic className="h-14 w-14 text-rose-400 animate-pulse" />
          ) : (
            <Mic className="h-14 w-14 text-slate-400" />
          )}
        </button>
        <div className="mt-4 text-sm font-medium">
          {isRecording ? (
            <span className="flex items-center justify-center gap-2 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              Recording active...
            </span>
          ) : (
            <span className="text-slate-400">Tap to Start Recording</span>
          )}
        </div>
      </div>

      {/* Waveform bars */}
      <div className="flex items-end justify-center gap-1.5 h-12 mb-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={clsx(
              "w-1.5 rounded-full transition-all",
              isRecording
                ? "bg-rose-500 animate-wave"
                : "bg-slate-700 h-3"
            )}
            style={
              isRecording
                ? {
                    height: `${16 + Math.random() * 24}px`,
                    animationDelay: `${i * 0.15}s`,
                  }
                : undefined
            }
          />
        ))}
      </div>

      {/* Timer */}
      <div
        className={clsx(
          "text-3xl font-mono font-bold mb-6",
          isRecording ? "text-rose-400" : "text-slate-600"
        )}
      >
        {formatTime(timer)}
      </div>

      {/* Stop button */}
      {isRecording && (
        <button
          onClick={stopRecording}
          className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-rose-600/30 animate-fade-in"
        >
          <Square className="h-4 w-4 fill-current" />
          Stop & Transcribe
        </button>
      )}

      {/* Error */}
      {recordError && (
        <div className="mt-6 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm p-4 rounded-xl flex items-start justify-between gap-3 text-left">
          <span>{recordError}</span>
          <button
            onClick={() => setRecordError("")}
            className="text-rose-400 hover:text-rose-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {recordWarning && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm p-4 rounded-xl flex items-start justify-between gap-3 text-left">
          <span>{recordWarning}</span>
          <button
            onClick={() => setRecordWarning("")}
            className="text-amber-400 hover:text-amber-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Back */}
      <button
        onClick={() => setStep(1)}
        className="mt-8 text-sm text-slate-400 hover:text-white flex items-center gap-1.5 mx-auto transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Patient Selection
      </button>
    </div>
  );

  // ═══════════════════════════════════════
  // STEP 3 — Review Transcript
  // ═══════════════════════════════════════
  const renderStep3 = () => (
    <div className="max-w-3xl mx-auto">
      {/* Generating overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
          <div className="text-xl font-semibold text-white mt-4">
            {isCheckingDrugSafety
              ? "Checking drug safety interactions..."
              : "Google Gemini is synthesizing clinical SOAP note..."}
          </div>
          <p className="text-xs text-slate-400 mt-1">Powered exclusively by Google Gemini 3.8 Flash</p>
        </div>
      )}

      <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-bold text-white">Review Transcript</h2>
          {language && (
            <span className="text-xs bg-blue-500/15 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full font-semibold">
              {language.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-1">
          Review or edit transcript before generating the structured clinical SOAP note
        </p>
        <p className="text-xs text-slate-500 mb-6">{wordCount} words detected</p>

        <textarea
          className="w-full min-h-[300px] p-4 bg-slate-800/90 border border-slate-700 rounded-xl text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y transition-colors"
          value={editedTranscript}
          onChange={(e) => setEditedTranscript(e.target.value)}
        />

        {/* Doctor name */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Attending Clinician (Dr.)
          </label>
          <input
            type="text"
            placeholder="e.g. Dr. Zainab"
            className="w-full px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
          />
        </div>

        {generateError && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm p-4 rounded-xl flex items-start justify-between gap-3">
            <span>{generateError}</span>
            <button
              onClick={() => setGenerateError("")}
              className="text-rose-400 hover:text-rose-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setTranscript("");
              setEditedTranscript("");
              setStep(2);
            }}
            className="px-6 py-3 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Re-record
          </button>
          <button
            onClick={handleGenerate}
            disabled={!editedTranscript.trim() || !doctorName.trim() || isGenerating}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25"
          >
            Generate SOAP Note <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // STEP 4 — SOAP Note Review
  // ═══════════════════════════════════════
  const renderStep4 = () => {
    if (!editedSoap) return null;

    const sections: {
      key: "subjective" | "objective" | "assessment" | "plan";
      label: string;
      short: string;
      icon: typeof Shield;
    }[] = [
      { key: "subjective", label: "Subjective", short: "S", icon: User },
      { key: "objective", label: "Objective", short: "O", icon: Search },
      { key: "assessment", label: "Assessment", short: "A", icon: Shield },
      { key: "plan", label: "Plan", short: "P", icon: Pill },
    ];

    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl shadow-xl p-6 mb-6 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-1">Review SOAP Note</h2>
          <p className="text-sm text-slate-400 mb-3">
            Review carefully before approving — AI assistance requires physician verification
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>
              <strong className="text-slate-300">Patient:</strong> {currentPatient?.name}
            </span>
            <span>
              <strong className="text-slate-300">Doctor:</strong> {doctorName}
            </span>
          </div>
        </div>

        {/* Drug interaction warning */}
        {interactions.length > 0 && (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-5 mb-6 animate-fade-in text-rose-200">
            <div className="flex items-center gap-2 text-rose-400 font-semibold mb-3">
              <AlertTriangle className="h-5 w-5" />
              Drug Interaction Detected
            </div>
            {interactions.map((intr, i) => (
              <div key={i} className="text-sm text-slate-300 mb-2 last:mb-0">
                <span className="font-semibold text-white">{intr.drug1}</span>
                {" + "}
                <span className="font-semibold text-white">{intr.drug2}</span>
                {" → "}
                <span
                  className={clsx(
                    "font-bold",
                    intr.severity === "HIGH" ? "text-rose-400" : "text-amber-400"
                  )}
                >
                  {intr.severity}
                </span>
                {" — "}
                {intr.description}
              </div>
            ))}
          </div>
        )}

        {/* SOAP section cards */}
        {sections.map(({ key, label, short }) => {
          const section = editedSoap[key];
          const isEditing = editingSection === key;
          const confidence = section.confidence;
          const needsReview = section.needs_review;

          return (
            <div
              key={key}
              className={clsx(
                "bg-slate-900/70 rounded-2xl border mb-4 overflow-hidden shadow-xl transition-all",
                needsReview
                  ? "border-amber-500/40 border-l-4 border-l-amber-500"
                  : "border-slate-700/60"
              )}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-600/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-400">{short}</span>
                  </div>
                  <div className="font-semibold text-white">{label}</div>
                  <span
                    className={clsx(
                      "text-xs px-2.5 py-0.5 rounded-full font-medium border",
                      confidence === "HIGH"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    )}
                  >
                    {confidence === "HIGH" ? "HIGH CONFIDENCE" : "⚠ REVIEW NEEDED"}
                  </span>
                </div>
                <button
                  onClick={() => setEditingSection(isEditing ? null : key)}
                  className="text-slate-400 hover:text-blue-400 transition-colors p-1"
                  title={isEditing ? "Done editing" : "Edit section"}
                >
                  {isEditing ? <Check className="h-5 w-5 text-emerald-400" /> : <Edit3 className="h-4 w-4" />}
                </button>
              </div>

              {/* Card body */}
              <div className="px-6 py-4">
                {key === "subjective" && (
                  <div className="space-y-3">
                    <SoapField
                      label="Chief Complaint"
                      value={editedSoap.subjective.chief_complaint}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("subjective", "chief_complaint", v)}
                    />
                    <SoapField
                      label="History of Present Illness"
                      value={editedSoap.subjective.history_of_present_illness}
                      editing={isEditing}
                      onChange={(v) =>
                        updateSoapField("subjective", "history_of_present_illness", v)
                      }
                    />
                    <SoapField
                      label="Review of Systems"
                      value={editedSoap.subjective.review_of_systems}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("subjective", "review_of_systems", v)}
                    />
                  </div>
                )}

                {key === "objective" && (
                  <div className="space-y-3">
                    <SoapField
                      label="Vitals"
                      value={editedSoap.objective.vitals}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("objective", "vitals", v)}
                    />
                    <SoapField
                      label="Physical Examination"
                      value={editedSoap.objective.physical_exam}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("objective", "physical_exam", v)}
                    />
                    <SoapField
                      label="Observations"
                      value={editedSoap.objective.observations}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("objective", "observations", v)}
                    />
                  </div>
                )}

                {key === "assessment" && (
                  <div className="space-y-3">
                    <SoapField
                      label="Diagnosis"
                      value={editedSoap.assessment.diagnosis}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("assessment", "diagnosis", v)}
                    />
                    <SoapField
                      label="Differential Diagnosis"
                      value={editedSoap.assessment.differential}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("assessment", "differential", v)}
                    />
                    {/* ICD-10 codes */}
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-2">ICD-10 Codes</div>
                      <div className="flex flex-wrap gap-2">
                        {editedSoap.assessment.icd10_codes.map((c, i) => (
                          <span
                            key={i}
                            className="text-xs bg-blue-500/15 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full font-medium"
                          >
                            {c.code} — {c.description}
                          </span>
                        ))}
                        {editedSoap.assessment.icd10_codes.length === 0 && (
                          <span className="text-xs text-slate-500">No codes generated</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {key === "plan" && (
                  <div className="space-y-4">
                    {/* Medications table */}
                    {editedSoap.plan.medications.length > 0 && (
                      <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="bg-slate-800 text-slate-200">
                              <th className="px-3 py-2.5 font-medium">Drug</th>
                              <th className="px-3 py-2.5 font-medium">Dose</th>
                              <th className="px-3 py-2.5 font-medium">Route</th>
                              <th className="px-3 py-2.5 font-medium">Frequency</th>
                              <th className="px-3 py-2.5 font-medium">Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editedSoap.plan.medications.map((med, i) => (
                              <tr
                                key={i}
                                className={clsx(
                                  "border-b border-slate-800 text-slate-300",
                                  i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-800/30"
                                )}
                              >
                                {isEditing ? (
                                  <>
                                    <td className="px-2 py-1.5">
                                      <input
                                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                                        value={med.drug_name}
                                        onChange={(e) => {
                                          const meds = [...editedSoap.plan.medications];
                                          meds[i] = { ...meds[i], drug_name: e.target.value };
                                          setEditedSoap({
                                            ...editedSoap,
                                            plan: { ...editedSoap.plan, medications: meds },
                                          });
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <input
                                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                                        value={med.dose}
                                        onChange={(e) => {
                                          const meds = [...editedSoap.plan.medications];
                                          meds[i] = { ...meds[i], dose: e.target.value };
                                          setEditedSoap({
                                            ...editedSoap,
                                            plan: { ...editedSoap.plan, medications: meds },
                                          });
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <input
                                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                                        value={med.route}
                                        onChange={(e) => {
                                          const meds = [...editedSoap.plan.medications];
                                          meds[i] = { ...meds[i], route: e.target.value };
                                          setEditedSoap({
                                            ...editedSoap,
                                            plan: { ...editedSoap.plan, medications: meds },
                                          });
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <input
                                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                                        value={med.frequency}
                                        onChange={(e) => {
                                          const meds = [...editedSoap.plan.medications];
                                          meds[i] = { ...meds[i], frequency: e.target.value };
                                          setEditedSoap({
                                            ...editedSoap,
                                            plan: { ...editedSoap.plan, medications: meds },
                                          });
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <input
                                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                                        value={med.duration}
                                        onChange={(e) => {
                                          const meds = [...editedSoap.plan.medications];
                                          meds[i] = { ...meds[i], duration: e.target.value };
                                          setEditedSoap({
                                            ...editedSoap,
                                            plan: { ...editedSoap.plan, medications: meds },
                                          });
                                        }}
                                      />
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 font-medium text-white">
                                      {med.drug_name}
                                    </td>
                                    <td className="px-3 py-2 text-slate-300">{med.dose}</td>
                                    <td className="px-3 py-2 text-slate-300">{med.route}</td>
                                    <td className="px-3 py-2 text-slate-300">{med.frequency}</td>
                                    <td className="px-3 py-2 text-slate-300">{med.duration}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Tests Ordered */}
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-2">Tests Ordered</div>
                      {isEditing ? (
                        <input
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                          value={editedSoap.plan.tests_ordered}
                          onChange={(e) =>
                            updateSoapField("plan", "tests_ordered", e.target.value)
                          }
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {editedSoap.plan.tests_ordered ? (
                            (Array.isArray(editedSoap.plan.tests_ordered)
                              ? editedSoap.plan.tests_ordered
                              : String(editedSoap.plan.tests_ordered).split(",")
                            ).map((t, i) => (
                              <span
                                key={i}
                                className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1 rounded-full"
                              >
                                {String(t).trim()}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">None ordered</span>
                          )}
                        </div>
                      )}
                    </div>

                    <SoapField
                      label="Follow-up"
                      value={editedSoap.plan.follow_up}
                      editing={isEditing}
                      onChange={(v) => updateSoapField("plan", "follow_up", v)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setStep(3)}
            className="px-6 py-3 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Back to Review
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/25 text-lg"
          >
            <Check className="h-5 w-5" />
            Approve & Save to Patient Record
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 pb-16">
      {showSuccessToast && (
        <div className="fixed top-20 right-4 z-[60] rounded-xl border border-emerald-500/30 bg-emerald-950/90 text-emerald-300 px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
          ✓ Consultation saved successfully to patient record!
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <StepIndicator currentStep={step} steps={STEPS} />

        <div className="mt-2">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
    </div>
  );
}

// ── Reusable SOAP field component ──
function SoapField({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400 mb-1">{label}</div>
      {editing ? (
        <textarea
          className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[60px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="text-sm text-slate-200 leading-relaxed">
          {value || <span className="text-slate-500 italic">Not recorded</span>}
        </div>
      )}
    </div>
  );
}
