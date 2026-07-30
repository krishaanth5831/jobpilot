import { NextResponse } from "next/server";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";
import { usageSummary } from "@/lib/entitlements";

// GET /api/usage — this account's tier and where it stands against every
// limit, for the meters on Settings.
//
// Read-only and derived: it reports what lib/entitlements.js already knows and
// changes nothing. While PAYWALL_ENABLED is off it still returns real counts,
// with `enforced: false` so the UI can say the limits are not being applied yet
// instead of implying someone is about to be cut off.
export async function GET() {
  const { data, userId } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json(await usageSummary(userId));
}
