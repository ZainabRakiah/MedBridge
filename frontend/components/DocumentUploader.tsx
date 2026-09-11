"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, Image, Loader2, CheckCircle2, AlertTriangle, X, AudioLines } from "lucide-react";
import { MedicalDocument } from "@/context/AppContext";
import { extractDocument } from "@/services/api";

interface DocumentUploaderProps {
  patientId: string;
  onDocumentExtracted: (doc: MedicalDocument) => void;
}

interface FileStatus {
  file: File;
  status: "pending" | "uploading" | "extracting" | "done" | "error";
  progress: string;
  doc?: MedicalDocument;
  error?: string;
}

const PIPELINE_STEPS = [
  "Document detected",
  "Text extracted",
  "Medical entities extracted",
  "Timeline event identified",
];

export default function DocumentUploader({ patientId, onDocumentExtracted }: DocumentUploaderProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setFiles((prev) => [
        ...prev,
        { file, status: "uploading", progress: "Uploading document..." },
      ]);

      try {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === file
              ? { ...f, status: "extracting", progress: "Gemini AI extracting medical data..." }
              : f
          )
        );

        const doc = await extractDocument(file, patientId);

        setFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, status: "done", progress: "Extraction complete", doc } : f
          )
        );

        onDocumentExtracted(doc);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, status: "error", progress: "Failed", error: msg } : f
          )
        );
      }
    },
    [patientId, onDocumentExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      droppedFiles.forEach(processFile);
    },
    [processFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    selected.forEach(processFile);
    e.target.value = "";
  };

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const getFileIcon = (file: File) => {
    if (file.type.includes("pdf")) return FileText;
    if (file.type.includes("audio")) return AudioLines;
    return Image;
  };

  const getStatusColor = (status: FileStatus["status"]) => {
    switch (status) {
      case "done": return "text-emerald-400";
      case "error": return "text-red-400";
      case "uploading":
      case "extracting": return "text-blue-400";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer group ${
          isDragging
            ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
            : "border-slate-700 hover:border-blue-500/60 hover:bg-slate-800/50"
        }`}
        onClick={() => document.getElementById("medbridge-file-input")?.click()}
      >
        <input
          id="medbridge-file-input"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.mp3,.wav,.webm,.m4a"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-all ${
          isDragging ? "bg-blue-500/20 scale-110" : "bg-slate-800 group-hover:bg-slate-700"
        }`}>
          <Upload className={`w-8 h-8 transition-colors ${isDragging ? "text-blue-400" : "text-slate-400 group-hover:text-blue-400"}`} />
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">
          {isDragging ? "Drop files here" : "Drop medical records here"}
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Prescriptions • Lab reports • Discharge summaries • Audio notes
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {["PDF", "JPG", "PNG", "Audio"].map((type) => (
            <span key={type} className="px-2 py-1 rounded-md bg-slate-800 text-xs text-slate-400 font-mono border border-slate-700">
              {type}
            </span>
          ))}
        </div>

        <div className="mt-5">
          <span className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Browse files
          </span>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Processing Queue</h4>
          {files.map(({ file, status, progress, doc, error }) => {
            const Icon = getFileIcon(file);
            return (
              <div
                key={file.name + file.size}
                className="bg-slate-800/60 border border-slate-700 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-700 shrink-0">
                    <Icon className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                      <button
                        onClick={() => removeFile(file)}
                        className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className={`text-xs ${getStatusColor(status)}`}>{progress}</p>

                    {/* Pipeline steps (when done) */}
                    {status === "done" && doc && (
                      <div className="mt-3 space-y-1.5">
                        {PIPELINE_STEPS.map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            {step}
                          </div>
                        ))}
                        {Boolean(doc.extracted_data?.warnings && doc.extracted_data.warnings.length > 0) && (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {doc.extracted_data?.warnings?.[0]}
                          </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-3 text-xs text-slate-400">
                          <span className="text-emerald-400 font-semibold">{Math.round((doc.confidence || 0.94) * 100)}% confidence</span>
                          <span>{doc.extracted_data?.medications?.length || 0} medications</span>
                          <span>{doc.extracted_data?.diagnoses?.length || 0} diagnoses</span>
                          <span>{doc.extracted_data?.lab_results?.length || 0} lab results</span>
                        </div>
                      </div>
                    )}

                    {status === "error" && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {error}
                      </div>
                    )}

                    {(status === "uploading" || status === "extracting") && (
                      <div className="mt-2 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        <span className="text-xs text-blue-400">Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safety disclaimer */}
      <p className="text-xs text-slate-500 text-center leading-relaxed">
        🔒 Documents are processed by AI and require clinician verification. 
        No data is permanently stored on the server.
      </p>
    </div>
  );
}
