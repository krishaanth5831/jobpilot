import Link from "next/link";

const steps = [
  {
    href: "/upload",
    title: "1 · Upload your resume",
    description: "Claude reads it and builds your candidate profile.",
  },
  {
    href: "/jobs",
    title: "2 · Find matching jobs",
    description: "Search job boards and see which ones you actually qualify for.",
  },
  {
    href: "/queue",
    title: "3 · Review & apply",
    description: "Tailored cover letters, ready for your one-click review.",
  },
  {
    href: "/roadmap",
    title: "4 · Close the gaps",
    description: "For dream jobs you don't qualify for yet — a plan to get there.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">jobpilot</h1>
        <p className="mt-3 text-lg text-neutral-500">
          Your AI copilot for job applications — it only applies where you qualify,
          and tells you how to qualify where you don&apos;t.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="rounded-xl border border-neutral-200 p-5 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <h2 className="font-semibold">{step.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{step.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
