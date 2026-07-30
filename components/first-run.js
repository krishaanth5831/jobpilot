"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { ProductTour } from "@/components/product-tour";

// The first-run sequence: questionnaire, then the dock walkthrough, then out
// of the way for good.
//
// Mounted as a sibling of the auth gate rather than inside it, so the app is
// already rendered underneath — the tour has to point at the real dock, which
// means the real dock has to exist behind it.
//
// Both stages are stored server-side, so finishing on a laptop means a phone
// does not ask again. A failure to save is not allowed to trap anyone in the
// flow: the stage closes locally either way.

export function FirstRun() {
  const { status } = useSession();
  const [stage, setStage] = useState(null); // null | "questions" | "tour"
  // A ref, not state: "have I already asked the server" changes nothing on
  // screen, and as state it would be a render inside an effect.
  const asked = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || asked.current) return;
    asked.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (!res.ok) return;
        const { needsOnboarding, needsTour } = await res.json();
        if (cancelled) return;
        if (needsOnboarding) setStage("questions");
        else if (needsTour) setStage("tour");
      } catch {
        /* never block the app on this */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const finishTour = useCallback(() => {
    setStage(null);
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tourDone: true }),
    }).catch(() => {});
  }, []);

  if (stage === "questions") {
    // The questionnaire has already been saved by the time it calls back.
    return <OnboardingFlow onDone={() => setStage("tour")} />;
  }
  if (stage === "tour") return <ProductTour onDone={finishTour} />;
  return null;
}
