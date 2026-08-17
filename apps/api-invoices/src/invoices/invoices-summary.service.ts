import { Injectable } from "@nestjs/common";
import type { InvoiceStatus, InvoicesSummaryDto } from "@repo/contracts";
import { InvoiceStatus as InvoiceStatusValue } from "@repo/contracts";

import { PrismaService } from "../prisma.service";
import { toInvoiceDto } from "./invoice.mapper";

interface DateWindow {
  issueDate?: { gte?: Date; lte?: Date };
}

/**
 * Raw dashboard aggregates computed over the invoices database, scoped to one
 * company (the caller's companyId comes from the forwarded user JWT). The
 * dashboard service has no database (wayfinder ticket 06) and re-shapes this
 * payload via the typed InvoicesSummaryDto boundary contract.
 */
@Injectable()
export class InvoicesSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(companyId: string, from?: Date, to?: Date): Promise<InvoicesSummaryDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowOnIssueDate = (hasDateFilters: boolean): DateWindow =>
      hasDateFilters
        ? { issueDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {};

    const [paidAgg, sentAgg, overdueAgg, counts, recent, monthly] = await Promise.all([
      // Revenue: PAID invoices windowed by paidAt (flows window by when they happened).
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          ...(from || to
            ? { paidAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
            : {}),
          status: InvoiceStatusValue.PAID,
        },
        _sum: { total: true },
      }),
      // Outstanding: SENT invoices, windowed by issueDate (balances window by issue).
      this.prisma.invoice.aggregate({
        where: { companyId, ...windowOnIssueDate(!!(from || to)), status: InvoiceStatusValue.SENT },
        _sum: { total: true },
      }),
      // Overdue: SENT invoices past their due date.
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          ...windowOnIssueDate(!!(from || to)),
          status: InvoiceStatusValue.SENT,
          dueDate: { lt: today },
        },
        _sum: { total: true },
      }),
      this.prisma.invoice.groupBy({
        by: ["status"],
        where: { companyId, ...windowOnIssueDate(!!(from || to)) },
        _count: { _all: true },
      }),
      this.prisma.invoice.findMany({
        where: { companyId, ...windowOnIssueDate(!!(from || to)) },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Monthly revenue via SQL aggregation (date_trunc over the locked indexes).
      this.prisma.$queryRaw<{ month: string; revenue: string }[]>`
        SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS month,
               COALESCE(SUM("total"), 0)::text AS revenue
        FROM "Invoice"
        WHERE "companyId" = ${companyId}::uuid
          AND status = 'PAID'
          AND "paidAt" IS NOT NULL
          AND "paidAt" >= COALESCE(${from ?? null}::timestamptz, '-infinity'::timestamptz)
          AND "paidAt" <= COALESCE(${to ?? null}::timestamptz, 'infinity'::timestamptz)
        GROUP BY date_trunc('month', "paidAt")
        ORDER BY month ASC
      `,
    ]);

    const countsByStatus: Partial<Record<InvoiceStatus, number>> = {};
    for (const row of counts) {
      countsByStatus[row.status] = row._count._all;
    }

    return {
      revenue: Number(paidAgg._sum.total ?? 0),
      outstanding: Number(sentAgg._sum.total ?? 0),
      overdue: Number(overdueAgg._sum.total ?? 0),
      countsByStatus,
      recentInvoices: recent.map(toInvoiceDto),
      monthlyRevenue: monthly.map((row) => ({ month: row.month, revenue: Number(row.revenue) })),
    };
  }
}
