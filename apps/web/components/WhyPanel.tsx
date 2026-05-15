"use client";

import { motion } from "framer-motion";
import { Lock, Search, Cpu, Scale } from "lucide-react";

const principles = [
  {
    icon: <Lock className="h-5 w-5 text-accent" />,
    title: "Cryptography, not statistics",
    description:
      "Tier 1 signature verification is mathematically deterministic. The only \"100% accurate\" path that exists.",
  },
  {
    icon: <Search className="h-5 w-5 text-info" />,
    title: "Inspectable forensics",
    description:
      "Tier 2 ELA and noise residuals are visible artefacts — not a black box.",
  },
  {
    icon: <Cpu className="h-5 w-5 text-warning" />,
    title: "AI as one input, never a verdict",
    description:
      "Tier 3 is shown with model name and confidence — the analyst signs the report, not the model.",
  },
];

export default function WhyPanel() {
  return (
    <div id="how-it-works" className="mt-24 space-y-8 scroll-m-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Provenance over prediction
        </h2>
        <p className="mt-4 text-muted-foreground">
          A confidence score from a classifier is not evidence an analyst can put into a report. We produce a structured, signed chain of evidence a commander can read — built on three principles.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {principles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-background">
              {p.icon}
            </div>
            <h3 className="mb-2 font-semibold text-foreground">{p.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {p.description}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4 text-center text-sm"
      >
        <Scale className="h-4 w-4 text-accent flex-shrink-0" />
        <span className="text-muted-foreground">
          Aligned with EU AI Act Article 50 (live 2 Aug 2026) and the Commission&apos;s Code of Practice.
        </span>
      </motion.div>
    </div>
  );
}
