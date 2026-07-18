import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteNav } from "@/components/site-nav";
import { authEnabled, enabledProviders } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  // Vercel injects the deployment URL; fall back to localhost in dev.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ),
  title: {
    default: "jobblast — apply where you qualify",
    template: "%s · jobblast",
  },
  description:
    "AI job application copilot — upload your resume, get matched to jobs you qualify for, and a roadmap for the ones you don't.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers
          authEnabled={authEnabled}
          providers={enabledProviders}
          freeModel={Boolean(process.env.GROQ_API_KEY)}
        >
          {children}
          <SiteNav authEnabled={authEnabled} />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
