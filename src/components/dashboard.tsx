import { DashboardShell } from "@/components/dashboard/shell";
import type { DashboardRoute } from "@/components/dashboard/types";

type DashboardProps = {
  routeView?: DashboardRoute;
};

export function Dashboard({ routeView = "signals" }: DashboardProps) {
  return <DashboardShell routeView={routeView} />;
}
