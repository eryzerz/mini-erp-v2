import { cn } from "@repo/ui";

import { formatIDR } from "@/lib/format";

export const AmountText = ({ value, className }: { value: string; className?: string }): React.ReactElement => (
  <span className={cn("tabular-nums", className)}>{formatIDR(value)}</span>
);
