import { Card, CardContent } from "@repo/ui";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

export const StatCard = ({ label, value, sub, icon: Icon, tone = "default" }: StatCardProps): React.ReactElement => (
  <Card className="min-w-0">
    {/* @container makes the KPI number size relative to the card, not the
        viewport: in the tight three-up layout the digits shrink to fit next
        to the icon; on wider cards they grow back. */}
    <CardContent className="@container flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-lg font-semibold tracking-tight @xs:text-xl @sm:text-2xl">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);
