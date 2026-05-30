import { createFileRoute } from "@tanstack/react-router";
import { CitizenApp } from "@/components/citizen-app";

export const Route = createFileRoute("/citizen")({
  head: () => ({
    meta: [
      { title: "ForestGuard · eSewa Citizen App" },
      { name: "description", content: "Submit wildlife sightings and earn eSewa-style points after forest officer verification." },
    ],
  }),
  component: () => <CitizenApp />,
});
