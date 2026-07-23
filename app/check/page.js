import { CheckClient } from "./check-client";

// Public, no-account ATS teaser — jobblast's lead magnet. Server component
// so the page gets real SEO metadata; the interactive part is the client
// component below it.
export const metadata = {
  title: "Free ATS resume checker",
  description:
    "Paste your resume and get an instant ATS-friendliness score with concrete issues — free, no account needed.",
};

export default function CheckPage() {
  return <CheckClient />;
}
