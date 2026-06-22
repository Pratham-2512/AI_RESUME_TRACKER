"use client";

import { useState } from "react";

type Metric = {
  impressions?: number;
  clicks?: number;
  costInLocalCurrency?: string;
  externalWebsiteConversions?: number;
  landingPageClicks?: number;
  likes?: number;
  shares?: number;
  dateRange?: {
    start: { year: number; month: number; day: number };
    end: { year: number; month: number; day: number };
  };
  pivotValues?: string[];
};

const PIVOTS = ["CAMPAIGN", "ACCOUNT", "CREATIVE"] as const;
const GRANULARITIES = ["DAILY", "MONTHLY", "ALL"] as const;

function fmt(n?: number) {
  if (n == null) return "—";
  return n.toLocaleString();
}
function fmtCost(s?: string) {
  if (!s) return "—";
  const n = parseFloat(s);
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}
function fmtDatePart(d?: { year: number; month: number; day: number }) {
  if (!d) return "—";
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
function pivotLabel(vals?: string[]) {
  if (!vals?.length) return "—";
  return vals.map((v) => v.split(":").pop()).join(", ");
}

type Totals = { impressions: number; clicks: number; cost: number; conversions: number; landingClicks: number; likes: number; shares: number };
function sumMetrics(rows: Metric[]): Totals {
  return rows.reduce<Totals>(
    (acc, r) => ({
      impressions: acc.impressions + (r.impressions ?? 0),
      clicks: acc.clicks + (r.clicks ?? 0),
      cost: acc.cost + parseFloat(r.costInLocalCurrency ?? "0"),
      conversions: acc.conversions + (r.externalWebsiteConversions ?? 0),
      landingClicks: acc.landingClicks + (r.landingPageClicks ?? 0),
      likes: acc.likes + (r.likes ?? 0),
      shares: acc.shares + (r.shares ?? 0),
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, landingClicks: 0, likes: 0, shares: 0 }
  );
}

export function LinkedInAnalyticsPanel() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [adAccountId, setAdAccountId] = useState("");
  const [campaignIds, setCampaignIds] = useState("");
  const [pivot, setPivot] = useState<typeof PIVOTS[number]>("CAMPAIGN");
  const [granularity, setGranularity] = useState<typeof GRANULARITIES[number]>("MONTHLY");
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  function parseDateStr(s: string) {
    const [year, month, day] = s.split("-").map(Number);
    return { year, month, day };
  }

  async function fetchAnalytics() {
    if (!adAccountId.trim()) {
      setError("Enter your LinkedIn Ad Account ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: adAccountId.trim(),
          campaignIds: campaignIds.trim()
            ? campaignIds.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          pivot,
          timeGranularity: granularity,
          startDate: parseDateStr(startDate),
          endDate: endDate ? parseDateStr(endDate) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `Error ${res.status}`);
        return;
      }
      setRows(json.data ?? []);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const totals = rows.length ? sumMetrics(rows) : null;
  const ctr = totals && totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : null;
  const cpc = totals && totals.clicks > 0
    ? (totals.cost / totals.clicks).toFixed(2)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        <div>
          <h2 className="text-xl font-bold tracking-tight">LinkedIn Campaign Analytics</h2>
          <p className="text-sm text-muted-foreground">Fetch performance data from your LinkedIn Ad Account via the Marketing API</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Query Parameters</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Ad Account ID */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Ad Account ID <span className="text-destructive">*</span></label>
            <input
              type="text"
              placeholder="e.g. 502840441"
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground">Found in Campaign Manager → Account Assets → Account</p>
          </div>

          {/* Campaign IDs */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Campaign IDs <span className="text-muted-foreground">(optional, comma-separated)</span></label>
            <input
              type="text"
              placeholder="e.g. 123456, 789012"
              value={campaignIds}
              onChange={(e) => setCampaignIds(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground">Leave blank to include all campaigns</p>
          </div>

          {/* Pivot */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Group By (Pivot)</label>
            <select
              value={pivot}
              onChange={(e) => setPivot(e.target.value as typeof PIVOTS[number])}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {PIVOTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Granularity */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Time Granularity</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as typeof GRANULARITIES[number])}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {GRANULARITIES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              Fetching…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Fetch Analytics
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      {fetched && totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Impressions", value: fmt(totals.impressions) },
            { label: "Clicks", value: fmt(totals.clicks) },
            { label: "CTR", value: ctr ? `${ctr}%` : "—" },
            { label: "Total Spend", value: `$${totals.cost.toFixed(2)}` },
            { label: "CPC", value: cpc ? `$${cpc}` : "—" },
            { label: "Conversions", value: fmt(totals.conversions) },
            { label: "Landing Clicks", value: fmt(totals.landingClicks) },
            { label: "Engagements", value: fmt(totals.likes + totals.shares) },
          ].map((s) => (
            <div key={s.label} className="card p-3 space-y-1 text-center">
              <div className="text-xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      {fetched && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{rows.length} rows · pivot: {pivot} · {granularity}</h3>
            <button
              onClick={() => {
                const header = "Pivot,Period Start,Period End,Impressions,Clicks,Spend,CPC,Conversions,Likes,Shares\n";
                const csvRows = rows.map((r) => {
                  const cost = parseFloat(r.costInLocalCurrency ?? "0");
                  const cpcRow = r.clicks ? (cost / r.clicks).toFixed(2) : "0";
                  return [
                    pivotLabel(r.pivotValues),
                    fmtDatePart(r.dateRange?.start),
                    fmtDatePart(r.dateRange?.end),
                    r.impressions ?? 0,
                    r.clicks ?? 0,
                    cost.toFixed(2),
                    cpcRow,
                    r.externalWebsiteConversions ?? 0,
                    r.likes ?? 0,
                    r.shares ?? 0,
                  ].join(",");
                });
                const blob = new Blob([header + csvRows.join("\n")], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `li-analytics-${adAccountId}.csv`;
                a.click();
              }}
              className="btn-outline btn-sm text-xs"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Pivot", "Period", "Impressions", "Clicks", "CTR", "Spend", "CPC", "Conversions", "Likes", "Shares"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const cost = parseFloat(r.costInLocalCurrency ?? "0");
                  const rowCtr = r.impressions && r.clicks
                    ? ((r.clicks / r.impressions) * 100).toFixed(2) + "%"
                    : "—";
                  const rowCpc = r.clicks && cost
                    ? "$" + (cost / r.clicks).toFixed(2)
                    : "—";
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-muted-foreground" title={r.pivotValues?.join(", ")}>
                        {pivotLabel(r.pivotValues)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        {fmtDatePart(r.dateRange?.start)} — {fmtDatePart(r.dateRange?.end)}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{fmt(r.impressions)}</td>
                      <td className="px-4 py-2 tabular-nums">{fmt(r.clicks)}</td>
                      <td className="px-4 py-2 tabular-nums">{rowCtr}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtCost(r.costInLocalCurrency)}</td>
                      <td className="px-4 py-2 tabular-nums">{rowCpc}</td>
                      <td className="px-4 py-2 tabular-nums">{fmt(r.externalWebsiteConversions)}</td>
                      <td className="px-4 py-2 tabular-nums">{fmt(r.likes)}</td>
                      <td className="px-4 py-2 tabular-nums">{fmt(r.shares)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fetched && rows.length === 0 && !loading && (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          No data returned for the selected date range and filters. Try a wider date range or check that your ad account has active campaigns.
        </div>
      )}

      {/* Permission note */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Required setup</p>
        <p>1. Your LinkedIn app must have the <code className="bg-muted px-1 rounded">r_ads_reporting</code> permission approved.</p>
        <p>2. Your connected LinkedIn account must have at least viewer access to the ad account.</p>
        <p>3. Reconnect LinkedIn after adding the new scope (the existing token may not include it).</p>
      </div>
    </div>
  );
}
