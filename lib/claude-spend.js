// The shared-key allowance.
//
// Accounts without their own Claude key don't have to settle for the free
// built-in model: they run real Claude on the server's key until they have
// spent ALLOWANCE_USD, then fall back to the free model (lib/free-model.js).
// An account that pastes its own key on the Settings page skips all of this
// and is never metered — it is spending its own credits, not the server's.
//
// Money is counted in integer MICRO-DOLLARS, never floats. Anthropic prices
// per million tokens, so a per-token price in micro-dollars is exactly the
// per-MTok dollar price ($5/MTok = 5 micro-dollars/token) and every charge
// lands on a whole number. Accumulating thousands of float fractions would
// drift; this cannot.

import { auth } from "./auth";
import { getDb, emptyUserData } from "./db";
import { modelRate } from "./claude-models";

const MICROS_PER_USD = 1_000_000;

/** What each account may spend on the server's key, once, for its lifetime. */
const ALLOWANCE_USD = 1;
const ALLOWANCE_MICROS = ALLOWANCE_USD * MICROS_PER_USD;

const microsToUsd = (micros) => micros / MICROS_PER_USD;

/** True when the server has a key to lend out at all. */
export const sharedKeyAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * What one Claude response cost, in micro-dollars.
 *
 * Thinking tokens are already inside `output_tokens`, so they need no
 * separate term. The cache fields are always zero today (nothing in this app
 * sets cache_control) but are priced anyway so that turning caching on later
 * cannot silently under-bill the allowance: writes cost 1.25x input, reads
 * 0.1x. Those two are the only non-integer terms, so they round up — the
 * meter should never charge the owner for tokens it forgot to count.
 */
function costMicros(model, usage) {
  const rate = modelRate(model);
  if (!rate || !usage) return 0;
  const base =
    (usage.input_tokens ?? 0) * rate.input + (usage.output_tokens ?? 0) * rate.output;
  const cache =
    (usage.cache_creation_input_tokens ?? 0) * rate.input * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * rate.input * 0.1;
  return base + Math.ceil(cache);
}

/** The signed-in account's email, or null when there is no session. */
async function currentEmail() {
  const session = await auth();
  return session?.user?.email ?? null;
}

const emptyLedger = () => ({ micros: 0, calls: 0, firstUsedAt: null, exhaustedAt: null });

/**
 * How much of the allowance this account has left.
 * `exhausted` is what the provider check actually keys on.
 */
export async function readAllowance() {
  const db = await getDb();
  const email = await currentEmail();
  const ledger = (email && db.data.users[email]?.sharedClaude) || emptyLedger();
  const remaining = Math.max(0, ALLOWANCE_MICROS - ledger.micros);
  return {
    spentUsd: microsToUsd(ledger.micros),
    remainingUsd: microsToUsd(remaining),
    allowanceUsd: ALLOWANCE_USD,
    calls: ledger.calls,
    exhausted: remaining === 0,
    exhaustedAt: ledger.exhaustedAt,
  };
}

/**
 * Charge one response to the account's allowance.
 *
 * Read-modify-write on a single document: two Claude calls that finish at the
 * same instant can lose one of the two increments, so an account can overrun
 * the allowance by roughly one request's cost. That ceiling is a fraction of a
 * cent on Haiku and about 3 cents on Sonnet, which is not worth a lock — but
 * it is why the cap is checked BEFORE the call rather than trusted after it.
 */
export async function chargeAllowance(model, usage) {
  const micros = costMicros(model, usage);
  if (micros <= 0) return;

  const db = await getDb();
  const email = await currentEmail();
  if (!email) return;

  // The money is already spent at Anthropic by the time this runs, so a
  // missing bucket must not swallow the charge — create it rather than
  // returning and letting the account spend the allowance twice.
  const bucket = (db.data.users[email] ??= emptyUserData());

  const ledger = { ...emptyLedger(), ...(bucket.sharedClaude ?? {}) };
  ledger.micros += micros;
  ledger.calls += 1;
  ledger.firstUsedAt ??= new Date().toISOString();
  if (ledger.micros >= ALLOWANCE_MICROS && !ledger.exhaustedAt) {
    ledger.exhaustedAt = new Date().toISOString();
  }
  bucket.sharedClaude = ledger;
  await db.write();
}
