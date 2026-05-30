import { createFileRoute } from "@tanstack/react-router";
import { CommunityModule } from "@/components/community";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community · ForestGuard AI" },
      { name: "description", content: "Submit wildlife sightings, AI-verify reports, and earn eSewa-style conservation rewards." },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community Protection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Locals submit sightings. AI verifies. Verified reporters earn eSewa-style points.
        </p>
      </div>
      <CommunityModule />
    </div>
  );
}
