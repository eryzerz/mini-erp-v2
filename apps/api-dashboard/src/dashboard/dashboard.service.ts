import { Injectable } from "@nestjs/common";
import type { DashboardSummary, InvoiceStatus } from "@repo/contracts";
import { InvoiceStatus as InvoiceStatusValue } from "@repo/contracts";
import { formatMoney } from "@repo/common";

import { InvoicesClient } from "./invoices.client";
import type { DashboardQueryDto } from "./dashboard.dto";

const statuses: InvoiceStatus[] = [
  InvoiceStatusValue.DRAFT,
  InvoiceStatusValue.SENT,
  InvoiceStatusValue.PAID,
  InvoiceStatusValue.CANCELLED,
];

/**
 * Read-aggregate: takes the raw aggregates from the invoices service (via the
 * forwarded user JWT) and shapes them into the DashboardSummary contract —
 * money formatting and zero-defaulted status counts.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly invoices: InvoicesClient) {}

  async summary(token: string, query: DashboardQueryDto): Promise<DashboardSummary> {
    const raw = await this.invoices.summary(token, query.from, query.to);

    return {
      revenue: formatMoney(raw.revenue),
      outstanding: formatMoney(raw.outstanding),
      overdue: formatMoney(raw.overdue),
      countsByStatus: Object.fromEntries(
        statuses.map((status) => [status, raw.countsByStatus[status] ?? 0]),
      ) as Record<InvoiceStatus, number>,
      recentInvoices: raw.recentInvoices,
      monthlyRevenue: raw.monthlyRevenue.map((row) => ({
        month: row.month,
        revenue: formatMoney(row.revenue),
      })),
    };
  }
}
