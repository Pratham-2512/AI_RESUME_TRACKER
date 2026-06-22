import { NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { postText } = (await req.json()) as { postText: string };
  if (!postText?.trim()) {
    return NextResponse.json({ error: "postText required" }, { status: 400 });
  }

  // Load LinkedIn token from profile
  const db = createDb();
  const { data: profile } = await db
    .from("profiles")
    .select("linkedin_access_token,linkedin_sub,linkedin_token_expiry")
    .eq("singleton", true)
    .single();

  if (!profile?.linkedin_access_token || !profile?.linkedin_sub) {
    return NextResponse.json({ error: "LinkedIn not connected. Connect your account first." }, { status: 401 });
  }

  // Check token expiry
  if (profile.linkedin_token_expiry) {
    const expiry = new Date(profile.linkedin_token_expiry);
    if (expiry < new Date()) {
      return NextResponse.json({ error: "LinkedIn token expired. Reconnect your account." }, { status: 401 });
    }
  }

  const authorUrn = `urn:li:person:${profile.linkedin_sub}`;

  const ugcBody = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: postText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const liRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${profile.linkedin_access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202410",
    },
    body: JSON.stringify(ugcBody),
  });

  if (!liRes.ok) {
    const errBody = await liRes.text();
    console.error("[linkedin/post] LinkedIn API error:", liRes.status, errBody);
    return NextResponse.json(
      { error: `LinkedIn API error (${liRes.status}): ${errBody.slice(0, 200)}` },
      { status: 502 }
    );
  }

  // LinkedIn returns the post ID in the X-RestLi-Id header
  const postId = liRes.headers.get("x-restli-id") ?? liRes.headers.get("X-RestLi-Id") ?? "";
  const postUrl = postId
    ? `https://www.linkedin.com/feed/update/${postId}/`
    : "https://www.linkedin.com/feed/";

  return NextResponse.json({ data: { postUrl, postId } });
}
