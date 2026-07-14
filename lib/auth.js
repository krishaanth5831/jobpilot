// Authentication (Auth.js v5) — self-hosted and free. The primary method is
// email + password (the Credentials provider below), so every visitor can
// create an account and sign in with no external setup. Google / GitHub /
// Microsoft are optional extras that light up only if their env vars exist.
//
// Sessions are JWTs (no database adapter), which is also what the Credentials
// provider requires. Each signed-in user gets their own data bucket (see
// lib/user-data.js), so their info follows their account.

import { randomBytes } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { verifyCredentials } from "./accounts";
import { updateManagedValues } from "./env-file";

// Optional OAuth providers — each turns on only when both env vars are set.
const OAUTH = [
  { id: "google", label: "Google", envId: "AUTH_GOOGLE_ID", envSecret: "AUTH_GOOGLE_SECRET", make: () => Google },
  { id: "github", label: "GitHub", envId: "AUTH_GITHUB_ID", envSecret: "AUTH_GITHUB_SECRET", make: () => GitHub },
  {
    id: "microsoft-entra-id",
    label: "Microsoft",
    envId: "AUTH_MICROSOFT_ENTRA_ID_ID",
    envSecret: "AUTH_MICROSOFT_ENTRA_ID_SECRET",
    // "common" lets both personal (Outlook) and work accounts sign in.
    make: () => MicrosoftEntraID({ issuer: "https://login.microsoftonline.com/common/v2.0" }),
  },
];

const activeOAuth = OAUTH.filter((c) => process.env[c.envId] && process.env[c.envSecret]);

// Email/password is always available; OAuth buttons come after it.
const providers = [
  Credentials({
    credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
    authorize: (creds) => verifyCredentials({ email: creds?.email, password: creds?.password }),
  }),
  ...activeOAuth.map((c) => c.make()),
];

// Accounts are always on now, but keep the flag for callers/layout.
export const authEnabled = true;
// OAuth providers to render as buttons (empty is fine — the form still shows).
export const enabledProviders = activeOAuth.map(({ id, label }) => ({ id, label }));

// Auth.js needs a signing secret to issue/verify session JWTs. If none is
// configured we generate one and persist it to .env.local so sessions
// survive restarts — zero-config, but overridable by setting AUTH_SECRET.
let secret = process.env.AUTH_SECRET;
if (!secret) {
  secret = randomBytes(32).toString("hex");
  process.env.AUTH_SECRET = secret;
  updateManagedValues({ AUTH_SECRET: secret }).catch((err) =>
    console.warn(
      "[auth] Couldn't persist a generated AUTH_SECRET to .env.local " +
        `(${err.message}); sessions will reset on restart until you set it.`
    )
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret,
  session: { strategy: "jwt" },
  trustHost: true,
  // Our own branded screen instead of the unstyled Auth.js default.
  pages: { signIn: "/signin" },
});
