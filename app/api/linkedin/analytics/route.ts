import { NextRequest, NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";

// Current LinkedIn Marketing API version
const LI_VERSION = "202506";

type DatePart = { year: number; month: number; day: number };

function buildDateRange(start: DatePart, end?: DatePart): string {
  const s = `start:(year:${start.year},month:${start.month},day:${start.day})`;
  const e = end ? `,end:(year:${end.year},month:${end.month},day:${end.day})` : "";
  return `(${s}${e})`;
}

export async function POST(req: NextRequest) {
  const db = createDb();

  // Load stored LinkedIn token
  const { data: profile } = await db
    .from("profiles")
    .select("linkedin_access_token, linkedin_token_expiry")
    .eq("singleton", true)
    .single();

  if (!profile?.linkedin_access_token) {
    return NextResponse.json({ error: "LinkedIn not connected" }, { status: 401 });
  }
  if (profile.linkedin_token_expiry && new Date(profile.linkedin_token_expiry) < new Date()) {
    return NextResponse.json({ error: "LinkedIn token expired — reconnect" }, { status: 401 });
  }

  const body = (await req.json()) as {
    adAccountId: string;   // numeric ID, e.g. "502840441"
    campaignIds?: string[]; // optional list of campaign IDs to filter
    pivot?: string;         // CAMPAIGN | ACCOUNT | CREATIVE — default CAMPAIGN
    timeGranularity?: string; // DAILY | MONTHLY | ALL — default MONTHLY
    startDate: DatePart;
    endDate?: DatePart;
  };

  if (!body.adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }

  const pivot = body.pivot ?? "CAMPAIGN";
  const timeGranularity = body.timeGranularity ?? "MONTHLY";
  const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${body.adAccountId}`);
  const dateRange = buildDateRange(body.startDate, body.endDate);

  const fields = [
    "impressions",
    "clicks",
    "costInLocalCurrency",
    "externalWebsiteConversions",
    "landingPageClicks",
    "likes",
    "shares",
    "dateRange",
    "pivotValues",
  ].join(",");

  let url =
    `https://api.linkedin.com/rest/adAnalytics` +
    `?q=analytics` +
    `&pivot=${pivot}` +
    `&timeGranularity=${timeGranularity}` +
    `&dateRange=${dateRange}` +
    `&accounts=List(${accountUrn})` +
    `&fields=${fields}`;

  if (body.campaignIds?.length) {
    const campaignList = body.campaignIds
      .map((id) => encodeURIComponent(`urn:li:sponsoredCampaign:${id}`))
      .join(",");
    url += `&campaigns=List(${campaignList})`;
  }

  const liRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${profile.linkedin_access_token}`,
      "LinkedIn-Version": LI_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  if (!liRes.ok) {
    const body = await liRes.text();
    console.error("[linkedin/analytics] API error:", liRes.status, body);
    if (liRes.status === 403) {
      return NextResponse.json(
        { error: "Access denied — ensure r_ads_reporting permission and reconnect LinkedIn" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: `LinkedIn API error ${liRes.status}` },
      { status: liRes.status }
    );
  }

  const json = await liRes.json();
  return NextResponse.json({ data: json.elements ?? [], error: null });
}
