"use client";

import { useId } from "react";
import { DemoExamples } from "@/components/DemoExamples";
import type { CaseIntake as CaseIntakeData } from "@/types/case";

export function CaseIntake({
  intake,
  setIntake,
  onSubmit,
  onPickDemo,
  loading,
  error,
  apiBase,
}: {
  intake: CaseIntakeData;
  setIntake: (next: CaseIntakeData) => void;
  onSubmit: () => void;
  onPickDemo: (slug: string, file: File) => void;
  loading: boolean;
  error: string | null;
  apiBase: string;
}) {
  const id = useId();
  const set = <K extends keyof CaseIntakeData>(k: K, v: CaseIntakeData[K]) =>
    setIntake({ ...intake, [k]: v });

  const ready =
    !!intake.mediaFile || intake.mediaUrl.trim().length > 0;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-400">
          Case Intake
        </p>
        <h2 className="text-xl font-semibold text-slate-100">
          Convert untrusted media into a defensible intelligence assessment.
        </h2>
        <p className="text-sm text-slate-400">
          We do not tell the analyst what to believe. We show which hypotheses
          survive the evidence.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="grid grid-cols-1 gap-4 rounded border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-2"
      >
        <Field label="Media file" htmlFor={`${id}-file`} col2>
          <input
            id={`${id}-file`}
            type="file"
            accept="image/*"
            onChange={(e) => set("mediaFile", e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-slate-100 file:hover:bg-slate-700"
          />
          {intake.mediaFile && (
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              {intake.mediaFile.name} ·{" "}
              {(intake.mediaFile.size / 1024).toFixed(1)} KB
            </p>
          )}
        </Field>

        <Field label="Media URL" htmlFor={`${id}-mediaUrl`}>
          <Input
            id={`${id}-mediaUrl`}
            value={intake.mediaUrl}
            onChange={(v) => set("mediaUrl", v)}
            placeholder="https://example.org/photo.jpg"
          />
        </Field>

        <Field label="Source URL (article / post)" htmlFor={`${id}-source`}>
          <Input
            id={`${id}-source`}
            value={intake.sourceUrl}
            onChange={(v) => set("sourceUrl", v)}
            placeholder="https://t.me/channel/123"
          />
        </Field>

        <Field label="Claim text" htmlFor={`${id}-claim`} col2>
          <textarea
            id={`${id}-claim`}
            value={intake.claimText}
            onChange={(e) => set("claimText", e.target.value)}
            placeholder="Briefly, what is being claimed about this media?"
            className="block min-h-[60px] w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
          />
        </Field>

        <Field label="Claimed location" htmlFor={`${id}-loc`}>
          <Input
            id={`${id}-loc`}
            value={intake.claimedLocation}
            onChange={(v) => set("claimedLocation", v)}
            placeholder="e.g. Bucharest, Romania"
          />
        </Field>

        <Field label="Claimed date / time" htmlFor={`${id}-dt`}>
          <Input
            id={`${id}-dt`}
            value={intake.claimedDateTime}
            onChange={(v) => set("claimedDateTime", v)}
            type="datetime-local"
          />
        </Field>

        <Field label="Claimed source" htmlFor={`${id}-claimedSrc`}>
          <Input
            id={`${id}-claimedSrc`}
            value={intake.claimedSource}
            onChange={(v) => set("claimedSource", v)}
            placeholder="e.g. Reuters wire, Telegram channel name"
          />
        </Field>

        <Field label="Operational relevance" htmlFor={`${id}-op`}>
          <Input
            id={`${id}-op`}
            value={intake.operationalRelevance}
            onChange={(v) => set("operationalRelevance", v)}
            placeholder="Why this matters — context for the analyst"
          />
        </Field>

        <Field label="Analyst notes" htmlFor={`${id}-notes`} col2>
          <textarea
            id={`${id}-notes`}
            value={intake.analystNotes}
            onChange={(e) => set("analystNotes", e.target.value)}
            placeholder="Initial observations, leads, prior knowledge…"
            className="block min-h-[60px] w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
          />
        </Field>

        <div className="col-span-full flex items-center gap-3 border-t border-slate-800 pt-3">
          <button
            type="submit"
            disabled={!ready || loading}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-40"
          >
            {loading ? "Creating case…" : "Create Case"}
          </button>
          <span className="font-mono text-[11px] text-slate-500">
            File or URL is required. All other fields make claim-level
            analysis stronger.
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="col-span-full rounded border border-red-700/60 bg-red-900/30 p-2 text-sm text-red-200"
          >
            {error}
          </p>
        )}
      </form>

      <section className="rounded border border-slate-800 bg-slate-950/40 p-4">
        <DemoExamples
          apiBase={apiBase}
          onPick={onPickDemo}
          disabled={loading}
        />
      </section>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  col2,
  children,
}: {
  label: string;
  htmlFor: string;
  col2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={"flex flex-col gap-1 " + (col2 ? "md:col-span-2" : "")}>
      <label
        htmlFor={htmlFor}
        className="font-mono text-[11px] uppercase tracking-widest text-slate-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  id,
  value,
  onChange,
  placeholder,
  type,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      id={id}
      type={type ?? "text"}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
    />
  );
}
