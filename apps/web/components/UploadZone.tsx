"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Link, X, FileImage, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onSubmit: (file?: File, url?: string, query?: string) => void;
  isLoading?: boolean;
}

export default function UploadZone({ onSubmit, isLoading }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [queryValue, setQueryValue] = useState("");
  const [mode, setMode] = useState<"file" | "url">("file");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setMode("file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMode("file");
    }
  };

  const handleSubmit = () => {
    if (mode === "file" && selectedFile) {
      onSubmit(selectedFile, undefined, queryValue || undefined);
    } else if (mode === "url" && urlValue.trim()) {
      onSubmit(undefined, urlValue.trim(), queryValue || undefined);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const canSubmit =
    !isLoading &&
    ((mode === "file" && selectedFile !== null) ||
      (mode === "url" && urlValue.trim().length > 0));

  return (
    <div className="w-full space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl bg-card p-1">
        <button
          onClick={() => setMode("file")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            mode === "file"
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload File
        </button>
        <button
          onClick={() => setMode("url")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            mode === "url"
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link className="h-4 w-4" />
          Paste URL
        </button>
      </div>

      {/* File upload zone */}
      <AnimatePresence mode="wait">
        {mode === "file" ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {selectedFile ? (
              <div className="flex items-center gap-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <FileImage className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={clearFile}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`group cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all md:p-12 ${
                  dragActive
                    ? "border-accent bg-accent/5 glow-accent-sm"
                    : "border-border hover:border-accent/40 hover:bg-card/50"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card transition-colors group-hover:bg-accent/10">
                  <Upload
                    className={`h-6 w-6 transition-colors ${
                      dragActive
                        ? "text-accent"
                        : "text-muted-foreground group-hover:text-accent"
                    }`}
                  />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Drop an image here or{" "}
                  <span className="text-accent">browse</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, WebP up to 10MB
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="url"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Query (optional) */}
      <input
        type="text"
        value={queryValue}
        onChange={(e) => setQueryValue(e.target.value)}
        placeholder="Optional: describe a claim to check against..."
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
      />

      {/* Submit */}
      <motion.button
        onClick={handleSubmit}
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.01 } : {}}
        whileTap={canSubmit ? { scale: 0.98 } : {}}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all ${
          canSubmit
            ? "bg-accent text-background glow-accent-sm hover:brightness-110"
            : "cursor-not-allowed bg-card text-muted-foreground"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing…
          </>
        ) : (
          <>
            <Shield className="h-4 w-4" />
            Run Verification
          </>
        )}
      </motion.button>
    </div>
  );
}

function Shield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
