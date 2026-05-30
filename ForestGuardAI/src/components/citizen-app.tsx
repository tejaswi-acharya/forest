import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCitizenView, postCommunityReport } from "@/lib/forest.functions";

const USERS = [
  { id: "u_ram", name: "Ram Bahadur Tamang" },
  { id: "u_sita", name: "Sita Chaudhary" },
  { id: "u_min", name: "Min Gurung" },
  { id: "u_anjali", name: "Anjali Magar" },
];

function formatAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const reviewLabel = (s: "pending" | "approved" | "rejected") =>
  s === "approved" ? { txt: "Approved · paid out", cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" } :
  s === "rejected" ? { txt: "Rejected by officer", cls: "text-rose-300 bg-rose-500/15 border-rose-500/30" } :
  { txt: "Under officer review", cls: "text-amber-300 bg-amber-500/15 border-amber-500/30" };

const REPORT_LABELS = ["deer", "elephant", "leopard", "rhesus_monkey", "peacock", "rhino", "tiger", "wild_boar"] as const;

type UploadClassificationResponse = {
  ok: boolean;
  labels: string[];
  topLabel: string | null;
  topConfidence: number | null;
  detections: Array<{ label: string; confidence: number }>;
  error?: string;
  message?: string;
};

function prettyLabel(label: string) {
  return label.replace(/_/g, " ");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function CitizenApp() {
  const fn = useServerFn(getCitizenView);
  const submit = useServerFn(postCommunityReport);
  const qc = useQueryClient();

  const [userId, setUserId] = useState("u_ram");
  const { data } = useQuery({
    queryKey: ["citizen", userId],
    queryFn: () => fn({ data: { userId } }),
    refetchInterval: 5000,
  });

  const [tab, setTab] = useState<"home" | "report" | "reports">("home");
  const [form, setForm] = useState({
    species: "tiger",
    description: "",
    location: "Bardia · Sector 4",
  });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [classification, setClassification] = useState<UploadClassificationResponse | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);

  const user = data?.user;
  const reports = data?.reports ?? [];

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  async function classifyImage(nextFile: File) {
    setClassifying(true);
    setClassificationError(null);
    try {
      const formData = new FormData();
      formData.append("image", nextFile);
      const response = await fetch("/api/classify-image", {
        method: "POST",
        body: formData,
      });
      const body = await response.json() as UploadClassificationResponse;
      if (!response.ok || !body.ok) {
        setClassification(null);
        setClassificationError(body.error ?? body.message ?? "Could not classify image");
        return;
      }
      setClassification(body);
      if (body.topLabel) {
        setForm(f => ({ ...f, species: body.topLabel ?? f.species }));
      }
    } catch {
      setClassification(null);
      setClassificationError("Could not classify image right now.");
    } finally {
      setClassifying(false);
    }
  }

  async function onImageChange(file: File | null) {
    setImageFile(file);
    setImageDataUrl(null);
    setClassification(null);
    setClassificationError(null);

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);

    if (!file) {
      setImagePreviewUrl(null);
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setImagePreviewUrl(nextPreview);
    const dataUrl = await readFileAsDataUrl(file);
    setImageDataUrl(dataUrl);
    void classifyImage(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const u = USERS.find(x => x.id === userId)!;
    setBusy(true);
    try {
      await submit({ data: {
        ...form,
        hasImage: Boolean(imageFile),
        imageDataUrl: imageDataUrl ?? undefined,
        imageName: imageFile?.name,
        imageMimeType: imageFile?.type,
        userId,
        userName: u.name,
      } });
      setToast("Report sent. Awaiting forest officer review.");
      setForm(f => ({ ...f, description: "", species: classification?.topLabel ?? f.species }));
      onImageChange(null);
      qc.invalidateQueries({ queryKey: ["citizen", userId] });
      setTab("reports");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1410] text-foreground flex flex-col items-center py-6 px-3">
      <div className="w-full max-w-[420px] flex items-center justify-between mb-3 px-1">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">eSewa · ForestGuard</div>
        <Link to="/" className="text-[11px] font-mono text-muted-foreground hover:text-primary">officer view →</Link>
      </div>

      {/* Phone frame */}
      <div className="w-full max-w-[420px] rounded-[2rem] border border-border bg-panel shadow-2xl overflow-hidden flex flex-col" style={{ minHeight: 720 }}>
        {/* Status bar */}
        <div className="px-5 pt-3 pb-1 flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>9:41</span>
          <span>5G · 88%</span>
        </div>

        {/* Brand bar */}
        <div className="px-5 pt-2 pb-4 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">eSewa Wallet</div>
              <div className="text-lg font-semibold tracking-tight">ForestGuard Rewards</div>
            </div>
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="text-[11px] bg-white/15 border border-white/20 rounded-md h-7 px-2 outline-none"
            >
              {USERS.map(u => <option key={u.id} value={u.id} className="text-foreground">{u.name}</option>)}
            </select>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-75">Available points</div>
              <div className="text-3xl font-semibold tabular-nums leading-tight">{user?.points ?? 0}</div>
              <div className="text-[10px] opacity-75 mt-0.5">1 pt = NPR 2 · ≈ NPR {((user?.points ?? 0) * 2).toLocaleString()} redeemable</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] opacity-75">Trust score</div>
              <div className="text-xl font-semibold">{user?.trustScore ?? 0}</div>
              <div className="text-[10px] opacity-75">% approved · rank #{data?.rank ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 pt-3 grid grid-cols-3 gap-1 text-xs">
          {(["home", "report", "reports"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`h-9 rounded-md ${tab === t ? "bg-primary/15 text-foreground border border-primary/30" : "text-muted-foreground"}`}>
              {t === "home" ? "Home" : t === "report" ? "Report sighting" : "My reports"}
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {toast && (
            <div className="mb-3 text-xs rounded-md border border-primary/40 bg-primary/10 px-3 py-2">{toast}</div>
          )}

          {tab === "home" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">How it works</div>
                <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <li>1. Spot wildlife or signs (pugmarks, scat, herd).</li>
                  <li>2. Submit a sighting with a photo.</li>
                  <li>3. ForestGuard AI scores it. Officer confirms in the dashboard.</li>
                  <li>4. Redeem points to your eSewa wallet anytime.</li>
                </ol>
              </div>
              <button onClick={() => setTab("report")}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium text-sm">
                + Report a sighting
              </button>
              <div className="rounded-xl border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Top earners this month</div>
                <ul className="space-y-1.5">
                  {(data?.leaderboard ?? []).map((u, i) => (
                    <li key={u.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono mr-2">#{i + 1}</span>
                      <span className="flex-1 truncate">{u.name}</span>
                      <span className="text-primary font-semibold">{u.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === "report" && (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/35 p-3 space-y-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Attach photo</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={e => { void onImageChange(e.target.files?.[0] ?? null); }}
                    className="mt-1 block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-panel/80 file:text-foreground"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-lg border border-border bg-panel/70 overflow-hidden min-h-[180px]">
                    {imagePreviewUrl ? (
                      <img src={imagePreviewUrl} alt="Upload preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full min-h-[180px] place-items-center px-4 text-center text-xs text-muted-foreground">
                        Upload a photo to classify it into the ForestGuard species labels.
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-panel/70 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">AI suggestion</div>
                    <div className="mt-1 text-sm font-semibold">
                      {classifying ? "Classifying image..." : classification?.topLabel ? prettyLabel(classification.topLabel) : "Waiting for upload"}
                      {typeof classification?.topConfidence === "number" && (
                        <span className="ml-2 text-xs font-mono text-primary">
                          {Math.round(classification.topConfidence * 100)}%
                        </span>
                      )}
                    </div>
                    {classificationError && (
                      <div className="mt-2 text-xs text-rose-300">{classificationError}</div>
                    )}
                    <div className="mt-3 grid grid-cols-1 gap-1.5">
                      {(classification?.detections ?? []).slice(0, 4).map(item => (
                        <div key={item.label} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
                          <span className="capitalize">{prettyLabel(item.label)}</span>
                          <span className="font-mono text-primary">{Math.round(item.confidence * 100)}%</span>
                        </div>
                      ))}
                      {classification && classification.detections.length === 0 && (
                        <div className="text-xs text-muted-foreground">No matching wildlife label detected yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Species sighted</label>
                <select
                  className="mt-1 w-full bg-input border border-border rounded-lg h-10 px-3 text-sm"
                  value={form.species}
                  onChange={e => setForm(f => ({ ...f, species: e.target.value }))}
                  required
                >
                  {REPORT_LABELS.map(label => (
                    <option key={label} value={label}>{prettyLabel(label)}</option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  The uploaded image will suggest one of the 8 dashboard labels, and you can still adjust it before submitting.
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Where</label>
                <input className="mt-1 w-full bg-input border border-border rounded-lg h-10 px-3 text-sm"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">What did you see?</label>
                <textarea className="mt-1 w-full bg-input border border-border rounded-lg p-3 text-sm min-h-24"
                  placeholder="When, how many, behaviour, distance from village…"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div className="text-[11px] text-muted-foreground rounded-md bg-secondary/40 border border-border p-2.5">
                Honest reports build your trust score. Fake or unverifiable reports are penalised after officer review.
              </div>
              <button disabled={busy}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50">
                {busy ? "Sending…" : "Submit to forest office"}
              </button>
            </form>
          )}

          {tab === "reports" && (
            <ul className="space-y-2">
              {reports.length === 0 && (
                <li className="text-xs text-muted-foreground text-center py-10">No reports yet.</li>
              )}
              {reports.map(r => {
                const lbl = reviewLabel(r.reviewStatus);
                return (
                  <li key={r.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{r.species}</div>
                      <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${lbl.cls}`}>
                        {lbl.txt}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{r.description}</div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 font-mono flex flex-wrap gap-x-3">
                      <span>{r.location}</span>
                      <span>{formatAgo(r.timestamp)}</span>
                      <span>AI {r.confidenceScore}%</span>
                      {r.reviewStatus !== "pending" && (
                        <span className={r.pointsAwarded >= 0 ? "text-primary" : "text-rose-300"}>
                          {r.pointsAwarded >= 0 ? `+${r.pointsAwarded}` : r.pointsAwarded} pts
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground mt-4 text-center max-w-[420px]">
        Demo prototype · ForestGuard AI partners with eSewa to pay out approved sightings directly to local reporters.
      </div>
    </div>
  );
}
