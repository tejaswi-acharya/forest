import { createFileRoute } from "@tanstack/react-router";
import { AlertsPanel } from "@/components/dashboard";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts · ForestGuard AI" },
      { name: "description", content: "Live human intrusion, anomaly, wildlife and camera-health alerts." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alert Stream</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Critical = human intrusion in restricted zone. Warning = anomalous behavior or camera health.
        </p>
      </div>
      <AlertsPanel limit={50} />
    </div>
  );
}
