import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startEdgeAI } from "@/lib/edge-ai-simulator";

const NAV = [
  { to: "/",            label: "Overview",    short: "OPS" },
  { to: "/live-camera", label: "Live Feed",   short: "LIV" },
  { to: "/cameras",     label: "Camera Grid", short: "CAM" },
  { to: "/alerts",      label: "Alerts",      short: "ALR" },
  { to: "/community",   label: "Community",   short: "CMR" },
  { to: "/about",       label: "System",      short: "SYS" },
] as const;

export function AppShell() {
  const { location } = useRouterState();
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    setNow(new Date().toISOString());
    // startEdgeAI();
    const t = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  if (location.pathname.startsWith("/citizen")) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-panel/70 backdrop-blur supports-[backdrop-filter]:bg-panel/60 sticky top-0 z-30">
        <div className="mx-auto max-w-[1500px] px-5 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-md bg-primary/15 border border-primary/30 grid place-items-center glow-primary">
              <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L4 9h3v9h10V9h3z" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">ForestGuard AI</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Wildlife Command · Nepal</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map(n => {
              const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 h-9 inline-flex items-center rounded-md text-sm transition-colors ${
                    active ? "bg-primary/15 text-foreground border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <span className="font-mono text-[10px] mr-2 opacity-60">{n.short}</span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="pulse-dot" />
              <span>LIVE</span>
              <span className="opacity-60">·</span>
              <span>{now.replace("T", " ").slice(0, 19)} UTC</span>
            </div>
            <Link to="/citizen" className="hidden sm:inline-flex h-7 items-center px-2.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/20">
              eSewa app
            </Link>
            <div className="text-xs px-2.5 h-7 rounded-md bg-secondary border border-border inline-flex items-center font-mono">
              OP-COM · NP
            </div>
          </div>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
          {NAV.map(n => {
            const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`shrink-0 px-3 h-8 inline-flex items-center rounded-md text-xs ${active ? "bg-primary/15 border border-primary/30" : "text-muted-foreground"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1500px] px-5 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        ForestGuard AI · Smart Wildlife Monitoring & Community Protection · v1.0 · eSewa × WWF Hackathon 2026
      </footer>
    </div>
  );
}
