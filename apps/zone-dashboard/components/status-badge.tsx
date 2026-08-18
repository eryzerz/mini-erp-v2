import { Badge } from "@repo/ui";
import type { InvoiceStatus } from "@repo/contracts";

const STATUS_STYLE: Record<InvoiceStatus, { variant: "default" | "secondary" | "success" | "warning" | "muted" | "destructive"; label: string }> = {
  DRAFT: { variant: "muted", label: "Draft" },
  SENT: { variant: "warning", label: "Sent" },
  PAID: { variant: "success", label: "Paid" },
  CANCELLED: { variant: "destructive", label: "Cancelled" },
};

export const StatusBadge = ({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }): React.ReactElement => {
  const style = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1">
      {overdue && status === "SENT" ? (
        <Badge variant="destructive" className="h-5">
          Overdue
        </Badge>
      ) : (
        <Badge variant={style.variant} className="h-5">
          {style.label}
        </Badge>
      )}
    </span>
  );
};
