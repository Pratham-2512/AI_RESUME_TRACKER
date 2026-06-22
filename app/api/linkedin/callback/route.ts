import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${appUrl}/app/resumes?li_error=${encodeURIComponent(error)}`);
  }

  // CSRF check
  const cookieStore = await cookies();
  const savedState = cookieStore.get("li_oauth_state")?.value;
  cookieStore.delete("li_oauth_state");

  if (!state || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/app/resumes?li_error=state_mismatch`);
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/app/resumes?li_error=no_code`);
  }

  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ??
    `${appUrl}/api/linkedin/callback`;

  // Exchange code → access token
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("[linkedin/callback] token exchange failed:", body);
    return NextResponse.redirect(`${appUrl}/app/resumes?li_error=token_failed`);
  }

  const { access_token, expires_in } = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Get LinkedIn person sub (ID)
  const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const userInfo = (await userRes.json()) as { sub: string };

  // Persist token in the single-user profile
  const db = createDb();
  const expiry = new Date(Date.now() + expires_in * 1000).toISOString();
  await db
    .from("profiles")
    .update({
      linkedin_access_token: access_token,
      linkedin_token_expiry: expiry,
      linkedin_sub: userInfo.sub,
    })
    .eq("singleton", true);

  return NextResponse.redirect(`${appUrl}/app/resumes?li_connected=1`);
}
