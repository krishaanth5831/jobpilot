import { Suspense } from "react";
import { ResetClient } from "./reset-client";

export const metadata = { title: "Reset password" };

// Public page for the password reset flow. Without ?token it's the "email
// me a link" form; with ?token (from the email) it's the new-password form.
// useSearchParams needs the Suspense boundary.
export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetClient />
    </Suspense>
  );
}
