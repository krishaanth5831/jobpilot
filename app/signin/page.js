import { Suspense } from "react";
import { enabledProviders } from "@/lib/auth";
import { SignInCard } from "@/components/sign-in-card";

export const metadata = { title: "Sign in" };

// Auth.js redirects here for sign-in (pages.signIn in lib/auth.js). The card
// reads ?callbackUrl via useSearchParams, so it needs a Suspense boundary.
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInCard
        providers={enabledProviders}
        freeModel={Boolean(process.env.GROQ_API_KEY)}
      />
    </Suspense>
  );
}
