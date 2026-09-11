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
    document.title = "New Consultation — Aushadh";
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

  // ── Recording functions ──
  const startRecording = useCallback(async () => {
    try {
      setRecordError("");
      setRecordWarning("");
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
      setRecordError("Transcription failed. Please re-record.");
    }
  }, [setIsRecording]);

  const stopRecording = useCallback(async () => {
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
          if (!result?.transcript?.trim()) {
            setRecordWarning("No speech detected in recording. Please try again.");
            return;
          }
          setTranscript(result.transcript);
          setEditedTranscript(result.transcript);
          setLanguage(result.language);
          setAudioDuration(result.duration);
          setStep(3);
        } catch {
          setRecordError("Transcription failed. Please re-record.");
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Select Patient</h2>
        <p className="text-gray-500 text-sm mb-6">
          Search for an existing patient or register a new one
        </p>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient by name or phone..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((p) => {
                const lastVisit = p.consultations.length > 0
                  ? new Date(p.consultations[p.consultations.length - 1].date).toLocaleDateString()
                  : "No visits";
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.age} yrs • {p.phone || "No phone"}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
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
          <div className="border border-primary/20 bg-primary/5 rounded-xl p-5 mb-6 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{currentPatient.name}</div>
                  <div className="text-xs text-gray-500">
                    {currentPatient.age} yrs • {currentPatient.gender}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCurrentPatient(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {currentPatient.phone && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Phone className="h-3 w-3" />
                {currentPatient.phone}
              </div>
            )}

            {/* Badges */}
            <div className="space-y-2">
              {currentPatient.allergies && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-danger font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Allergies:
                  </span>
                  {(Array.isArray(currentPatient.allergies) ? currentPatient.allergies : (currentPatient.allergies as unknown as string).split(",")).map((a) => (
                    <span
                      key={a}
                      className="text-xs bg-danger/10 text-danger px-2 py-0.5 rounded-full"
                    >
                      {a.trim()}
                    </span>
                  ))}
                </div>
              )}
              {currentPatient.chronic_conditions && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-warning font-medium flex items-center gap-1">
                    <Heart className="h-3 w-3" /> Chronic:
                  </span>
                  {currentPatient.chronic_conditions
                    .split(",")
                    .filter((c) => !c.trim().startsWith("BG:"))
                    .map((c) => (
                      <span
                        key={c}
                        className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full"
                      >
                        {c.trim()}
                      </span>
                    ))}
                </div>
              )}

              {/* Last 2 consultations */}
              {currentPatient.consultations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-500 mb-2">Recent Visits</div>
                  {currentPatient.consultations.slice(-2).map((c) => (
                    <div key={c.id} className="text-xs text-gray-500 mb-1">
                      {new Date(c.date).toLocaleDateString()} —{" "}
                      {c.soap_note?.assessment?.diagnosis || "No diagnosis"}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Start Consultation <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* New patient link / form */}
        {!currentPatient && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="text-sm text-primary font-medium hover:underline"
            >
              {showNewForm ? "Cancel" : "New Patient? Register here →"}
            </button>

            {showNewForm && (
              <div className="mt-4 space-y-3 animate-fade-in">
                <input
                  type="text"
                  placeholder="Patient Name *"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Age *"
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                  />
                  <select
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
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
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
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
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Allergies (comma separated)"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={newPatient.allergies}
                  onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Chronic Conditions (comma separated)"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={newPatient.chronic_conditions}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, chronic_conditions: e.target.value })
                  }
                />
                <button
                  onClick={handleCreatePatient}
                  disabled={!newPatient.name.trim() || !newPatient.age.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium text-gray-900">{currentPatient.name}</span>
              <span className="text-xs text-gray-500">
                {currentPatient.age} yrs • {currentPatient.gender}
              </span>
            </div>
            {currentPatient.allergies && (
              <span className="text-xs bg-danger/10 text-danger px-2 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {Array.isArray(currentPatient.allergies)
                  ? currentPatient.allergies.join(", ")
                  : currentPatient.allergies}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Recording tip: Place device between doctor and patient
          </div>
        </div>
      )}

      {/* Transcribing overlay */}
      {isTranscribing && (
        <div className="fixed inset-0 z-50 bg-white/90 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
          <div className="text-lg font-semibold text-gray-900 mt-4">
            Transcribing your consultation... please wait
          </div>
        </div>
      )}

      {/* Main record button */}
      <div className="mb-6">
        <button
          onClick={isRecording ? undefined : startRecording}
          className={clsx(
            "h-32 w-32 rounded-full mx-auto flex items-center justify-center transition-all",
            isRecording
              ? "bg-danger/10 animate-pulse-ring"
              : "bg-gray-100 hover:bg-gray-200 cursor-pointer"
          )}
        >
          {isRecording ? (
            <Mic className="h-14 w-14 text-danger" />
          ) : (
            <Mic className="h-14 w-14 text-gray-400" />
          )}
        </button>
        <div className="mt-4 text-sm font-medium text-gray-500">
          {isRecording ? (
            <span className="flex items-center justify-center gap-2 text-danger">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
              Recording...
            </span>
          ) : (
            "Tap to Start Recording"
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
                ? "bg-accent animate-wave"
                : "bg-gray-200 h-3"
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
          isRecording ? "text-danger" : "text-gray-300"
        )}
      >
        {formatTime(timer)}
      </div>

      {/* Stop button */}
      {isRecording && (
        <button
          onClick={stopRecording}
          className="inline-flex items-center gap-2 bg-danger hover:bg-danger/90 text-white font-semibold px-8 py-3 rounded-xl transition-colors animate-fade-in"
        >
          <Square className="h-4 w-4 fill-current" />
          Stop & Transcribe
        </button>
      )}

      {/* Error */}
      {recordError && (
        <div className="mt-6 bg-danger/10 border border-danger/20 text-danger text-sm p-4 rounded-xl flex items-start justify-between gap-3">
          <span>{recordError}</span>
          <button
            onClick={() => setRecordError("")}
            className="text-danger/80 hover:text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {recordWarning && (
        <div className="mt-4 bg-warning/10 border border-warning/20 text-warning text-sm p-4 rounded-xl flex items-start justify-between gap-3">
          <span>{recordWarning}</span>
          <button
            onClick={() => setRecordWarning("")}
            className="text-warning/80 hover:text-warning"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Back */}
      <button
        onClick={() => setStep(1)}
        className="mt-8 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
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
        <div className="fixed inset-0 z-50 bg-white/95 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
          <div className="text-xl font-semibold text-gray-900">
            {isCheckingDrugSafety
              ? "Checking drug safety..."
              : "AI is analyzing your consultation..."}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-bold text-gray-900">Review Transcript</h2>
          {language && (
            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
              {language.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-1">
          Edit any errors before generating SOAP note
        </p>
        <p className="text-xs text-gray-400 mb-6">{wordCount} words</p>

        <textarea
          className="w-full min-h-[300px] p-4 border border-gray-200 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
          value={editedTranscript}
          onChange={(e) => setEditedTranscript(e.target.value)}
        />

        {/* Doctor name */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Name (Dr.)
          </label>
          <input
            type="text"
            placeholder="e.g. Dr. Sharma"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
          />
        </div>

        {generateError && (
          <div className="mt-4 bg-danger/10 border border-danger/20 text-danger text-sm p-4 rounded-xl flex items-start justify-between gap-3">
            <span>{generateError}</span>
            <button
              onClick={() => setGenerateError("")}
              className="text-danger/80 hover:text-danger"
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
            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Re-record
          </button>
          <button
            onClick={handleGenerate}
            disabled={!editedTranscript.trim() || !doctorName.trim() || isGenerating}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Review SOAP Note</h2>
          <p className="text-sm text-gray-500 mb-3">
            Review carefully before approving — AI assistance requires physician verification
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>
              <strong>Patient:</strong> {currentPatient?.name}
            </span>
            <span>
              <strong>Doctor:</strong> {doctorName}
            </span>
          </div>
        </div>

        {/* Drug interaction warning */}
        {interactions.length > 0 && (
          <div className="bg-danger/5 border border-danger/20 rounded-2xl p-5 mb-6 animate-fade-in">
            <div className="flex items-center gap-2 text-danger font-semibold mb-3">
              <AlertTriangle className="h-5 w-5" />
              Drug Interaction Detected
            </div>
            {interactions.map((intr, i) => (
              <div key={i} className="text-sm text-gray-700 mb-2 last:mb-0">
                <span className="font-medium">{intr.drug1}</span>
                {" + "}
                <span className="font-medium">{intr.drug2}</span>
                {" → "}
                <span
                  className={clsx(
                    "font-semibold",
                    intr.severity === "HIGH" ? "text-danger" : "text-warning"
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
        {sections.map(({ key, label, short, icon: SectionIcon }) => {
          const section = editedSoap[key];
          const isEditing = editingSection === key;
          const confidence = section.confidence;
          const needsReview = section.needs_review;

          return (
            <div
              key={key}
              className={clsx(
                "bg-white rounded-2xl shadow-sm border mb-4 overflow-hidden transition-all",
                needsReview
                  ? "border-l-4 border-l-warning border-warning/20"
                  : "border-gray-100"
              )}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{short}</span>
                  </div>
                  <div className="font-semibold text-gray-900">{label}</div>
                  <span
                    className={clsx(
                      "text-xs px-2.5 py-0.5 rounded-full font-medium",
                      confidence === "HIGH"
                        ? "bg-accent/10 text-accent"
                        : "bg-warning/10 text-warning"
                    )}
                  >
                    {confidence === "HIGH" ? "HIGH CONFIDENCE" : "⚠ REVIEW NEEDED"}
                  </span>
                </div>
                <button
                  onClick={() => setEditingSection(isEditing ? null : key)}
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  {isEditing ? <Check className="h-5 w-5" /> : <Edit3 className="h-4 w-4" />}
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
                      <div className="text-xs font-medium text-gray-500 mb-2">ICD-10 Codes</div>
                      <div className="flex flex-wrap gap-2">
                        {editedSoap.assessment.icd10_codes.map((c, i) => (
                          <span
                            key={i}
                            className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium"
                          >
                            {c.code} — {c.description}
                          </span>
                        ))}
                        {editedSoap.assessment.icd10_codes.length === 0 && (
                          <span className="text-xs text-gray-400">No codes generated</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {key === "plan" && (
                  <div className="space-y-4">
                    {/* Medications table */}
                    {editedSoap.plan.medications.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-primary text-white">
                              <th className="px-3 py-2 text-left font-medium rounded-tl-lg">
                                Drug
                              </th>
                              <th className="px-3 py-2 text-left font-medium">Dose</th>
                              <th className="px-3 py-2 text-left font-medium">Route</th>
                              <th className="px-3 py-2 text-left font-medium">Frequency</th>
                              <th className="px-3 py-2 text-left font-medium rounded-tr-lg">
                                Duration
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {editedSoap.plan.medications.map((med, i) => (
                              <tr
                                key={i}
                                className={clsx(
                                  "border-b border-gray-100",
                                  i % 2 === 0 ? "bg-gray-50/50" : "bg-white"
                                )}
                              >
                                {isEditing ? (
                                  <>
                                    <td className="px-2 py-1.5">
                                      <input
                                        className="w-full px-2 py-1 border rounded text-xs"
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
                                        className="w-full px-2 py-1 border rounded text-xs"
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
                                        className="w-full px-2 py-1 border rounded text-xs"
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
                                        className="w-full px-2 py-1 border rounded text-xs"
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
                                        className="w-full px-2 py-1 border rounded text-xs"
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
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                      {med.drug_name}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{med.dose}</td>
                                    <td className="px-3 py-2 text-gray-600">{med.route}</td>
                                    <td className="px-3 py-2 text-gray-600">{med.frequency}</td>
                                    <td className="px-3 py-2 text-gray-600">{med.duration}</td>
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
                      <div className="text-xs font-medium text-gray-500 mb-2">Tests Ordered</div>
                      {isEditing ? (
                        <input
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          value={editedSoap.plan.tests_ordered}
                          onChange={(e) =>
                            updateSoapField("plan", "tests_ordered", e.target.value)
                          }
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {editedSoap.plan.tests_ordered ? (
                            editedSoap.plan.tests_ordered.split(",").map((t, i) => (
                              <span
                                key={i}
                                className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full"
                              >
                                {t.trim()}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">None ordered</span>
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
            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Back to Review
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold py-3.5 rounded-xl transition-colors text-lg"
          >
            <Check className="h-5 w-5" />
            Approve & Save to EHR
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {showSuccessToast && (
        <div className="fixed top-20 right-4 z-[60] rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-lg">
          ✓ Consultation saved successfully!
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
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      {editing ? (
        <textarea
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[60px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="text-sm text-gray-800 leading-relaxed">
          {value || <span className="text-gray-400 italic">Not recorded</span>}
        </div>
      )}
    </div>
  );
}
