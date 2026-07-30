import { PricingClient } from "./pricing-client";
import { paywallEnabled } from "@/lib/entitlements";

// Public pricing page. Server component so it gets real metadata; the toggle
// and the table are the client component beside it.
export const metadata = {
  title: "Pricing",
  description:
    "jobblast plans in euro — Free, Pro and Unlimited. The ATS resume score is free on every plan, and every plan is free while jobblast is in early access.",
};

export default function PricingPage() {
  // Two conditions, both required. PAYWALL_ENABLED on its own only turns the
  // limits into real blocks; without a Stripe key there is still no way to
  // take a payment, so the page must not offer one.
  const live = paywallEnabled() && Boolean(process.env.STRIPE_SECRET_KEY);
  return <PricingClient live={live} />;
}
