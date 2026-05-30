import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCommunity, reviewCommunityReport } from "@/lib/forest.functions";

function formatAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

const statusBadge = (s: "likely_real" | "uncertain" | "likely_fake") =>
  s === "likely_real" ? "border-primary/40 bg-primary/10 text-primary" :
  s === "uncertain" ? "border-warning/40 bg-warning/10 text-warning" :
  "border-critical/40 bg-critical/10 text-critical-foreground";

const reviewBadge = (s: "pending" | "approved" | "rejected") =>
  s === "approved" ? "border-primary/40 bg-primary/10 text-primary" :
  s === "rejected" ? "border-critical/40 bg-critical/10 text-critical-foreground" :
  "border-warning/40 bg-warning/10 text-warning";

const HIGH_RISK_SPECIES = ["tiger", "leopard", "elephant", "rhino"];

export function CommunityModule() {
  const fn = useServerFn(getCommunity);
  const review = useServerFn(reviewCommunityReport);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["community"], queryFn: () => fn(), refetchInterval: 5000 });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, decision: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    try {
      await review({ data: { id, decision, officialName: "Officer Thapa" } });
      qc.invalidateQueries({ queryKey: ["community"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    } finally {
      setBusyId(null);
    }
  }

  const pending = data?.pending ?? [];
  const reviewed = data?.reviewed ?? [];
  const trustByUser = new Map((data?.leaderboard ?? []).map(u => [u.id, u.trustScore]));

  function buildSignals(r: typeof pending[number]) {
    const tags: string[] = [];
    const trustScore = trustByUser.get(r.userId) ?? 0;
    if (r.hasImage) tags.push("Photo attached");
    if (r.description.length > 30) tags.push("Detailed description");
    if (HIGH_RISK_SPECIES.some(s => r.species.toLowerCase().includes(s))) tags.push("Protected species match");
    if (/house|home|residential|village/i.test(r.description)) tags.push("Residential proximity");
    if (trustScore >= 75) tags.push("High reporter trust");
    return tags;
  }

  function extractInfo(r: typeof pending[number]) {
    const direction = /house|home|residential|village/i.test(r.description)
      ? "residential"
      : /farm|field/i.test(r.description)
        ? "agricultural"
        : "unknown";
    const threat = HIGH_RISK_SPECIES.some(s => r.species.toLowerCase().includes(s)) ? "HIGH" : "MEDIUM";
    return { species: r.species, direction, threat };
  }

  function rejectionReason(r: typeof reviewed[number]) {
    if (!r.hasImage) return "Reason: low photo quality";
    if (/ridge|langtang/i.test(r.location)) return "Reason: location mismatch";
    return "Reason: species mismatch";
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="panel">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Pending Community Reports</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Edge AI scores each submission. Officer confirms before points are issued.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-warning/40 bg-warning/10 text-warning">
              {pending.length} awaiting review
            </span>
          </div>
          <ul className="divide-y divide-border max-h-[640px] overflow-y-auto">
            {pending.length === 0 && (
              <li className="px-4 py-10 text-center text-xs text-muted-foreground">
                No pending submissions. Queue is clear.
              </li>
            )}
            {pending.map(r => {
              const signals = buildSignals(r);
              const extracted = extractInfo(r);
              return (
              <li key={r.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.species}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.description}</div>
                    <div className="mt-2 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-[11px] font-mono">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI extracted</div>
                      <div className="mt-1 flex flex-wrap gap-x-3">
                        <span>species={extracted.species}</span>
                        <span>direction={extracted.direction}</span>
                        <span>threat={extracted.threat}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${statusBadge(r.status)}`}>
                    AI · {r.confidenceScore}%
                  </span>
                </div>
                {signals.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span>Signals:</span>
                    {signals.map(sig => (
                      <span key={sig} className="px-1.5 py-0.5 rounded border border-border bg-panel/60">
                        {sig}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-2 font-mono flex flex-wrap gap-x-3">
                  <span>{r.userName}</span>
                  <span>{r.location}</span>
                  <span>{formatAgo(r.timestamp)}</span>
                  <span>{r.hasImage ? "📎 image" : "no image"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[11px] font-mono text-muted-foreground">
                    AI suggests:{" "}
                    <span className={r.aiSuggestion === "approve" ? "text-primary" : "text-critical-foreground"}>
                      {r.aiSuggestion === "approve" ? "ACCEPT — dispatch verification" : "REJECT — low confidence"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(r.id, "reject")}
                      disabled={busyId === r.id}
                      className="h-8 px-3 rounded-md border border-critical/40 bg-critical/10 text-xs hover:bg-critical/20 disabled:opacity-50"
                    >
                      Reject (-5 pts)
                    </button>
                    <button
                      onClick={() => decide(r.id, "approve")}
                      disabled={busyId === r.id}
                      className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      Approve (+pts)
                    </button>
                  </div>
                </div>
              </li>
            );})}
          </ul>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Review History</h3>
            <span className="text-[11px] font-mono text-muted-foreground">officer-confirmed</span>
          </div>
          <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {reviewed.map(r => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{r.species}</div>
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${reviewBadge(r.reviewStatus)}`}>
                    {r.reviewStatus} · {r.confidenceScore}%
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 font-mono flex flex-wrap gap-x-3">
                  <span>{r.userName}</span>
                  <span>{r.location}</span>
                  <span>{formatAgo(r.timestamp)}</span>
                  {r.reviewedBy && <span>by {r.reviewedBy}</span>}
                  {r.reviewStatus === "rejected" && (
                    <span className="px-1.5 py-0.5 rounded border border-critical/40 bg-critical/10 text-critical-foreground">
                      {rejectionReason(r)}
                    </span>
                  )}
                  <span className={r.pointsAwarded >= 0 ? "text-primary" : "text-critical-foreground"}>
                    {r.pointsAwarded >= 0 ? `+${r.pointsAwarded}` : r.pointsAwarded} pts
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <h3 className="text-sm font-semibold">Review Workflow</h3>
          <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li><span className="text-foreground font-mono mr-1.5">1.</span>Citizen submits sighting via the eSewa-style ForestGuard app.</li>
            <li><span className="text-foreground font-mono mr-1.5">2.</span>Edge AI scores authenticity (species + photo + reporter trust).</li>
            <li><span className="text-foreground font-mono mr-1.5">3.</span>High confidence → officer dispatches a field check.</li>
            <li><span className="text-foreground font-mono mr-1.5">4.</span>Low confidence → officer rejects, reporter loses trust.</li>
            <li><span className="text-foreground font-mono mr-1.5">5.</span>Decision triggers eSewa-style point payout.</li>
          </ol>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Reward Leaderboard</h3>
            <span className="text-[11px] font-mono text-muted-foreground">eSewa points</span>
          </div>
          <ul className="divide-y divide-border">
            {(data?.leaderboard ?? []).map((u, i) => (
              <li key={u.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{u.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">trust {u.trustScore} · {u.reportsCount} reports</div>
                </div>
                <div className="text-sm font-semibold text-primary tabular-nums">{u.points} pts</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
