import { DashboardShell } from "@/components/dashboard/shell";
import type { DashboardView } from "@/components/dashboard/types";

type DashboardProps = {
  routeView?: DashboardView;
};

export function Dashboard({ routeView = "overview" }: DashboardProps) {
  return <DashboardShell routeView={routeView} />;
}
