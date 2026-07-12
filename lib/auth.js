// Authentication (Auth.js v5) — entirely optional and entirely free:
// self-hosted, JWT sessions (no database adapter), and OAuth apps from
// Google / GitHub / Microsoft cost nothing to create.
//
// A provider is enabled only when its env vars are set. With NO providers
// configured, the app runs in single-user "local" mode with no login —
// the zero-config experience for someone running it on their own machine.
// With at least one provider, every user signs in and gets their own data
// bucket (see lib/user-data.js), so their stuff follows their account.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const providers = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
}
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    // "common" lets both personal (Outlook) and work accounts sign in.
    MicrosoftEntraID({ issuer: "https://login.microsoftonline.com/common/v2.0" })
  );
}

export const authEnabled = providers.length > 0;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
});
