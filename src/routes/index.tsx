import { createFileRoute } from "@tanstack/react-router";
import { ManagerApp } from "@/components/manager-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ManagerApp />;
}
