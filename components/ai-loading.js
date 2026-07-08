"use client";

import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import { BorderTrail } from "@/components/motion-primitives/border-trail";

// The reusable "Claude is thinking" treatment: wrap the affected card in
// <AiCard busy>…</AiCard> and/or show <AiLabel>Reading your resume…</AiLabel>.
// This is an AI-in-flight state, so the accent gradient is allowed here.

export function AiLabel({ children, className }) {
  return (
    <span role="status" className={className}>
      <TextShimmer accent duration={1.4} className="text-sm font-medium">
        {children}
      </TextShimmer>
    </span>
  );
}

export function AiCard({ busy = false, children, className }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 ${className ?? ""}`}
    >
      {children}
      {busy && <BorderTrail size={72} duration={2.6} />}
    </div>
  );
}
