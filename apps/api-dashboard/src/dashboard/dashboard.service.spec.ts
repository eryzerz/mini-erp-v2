import { Test } from "@nestjs/testing";
import { InvoiceStatus } from "@repo/contracts";
import type { InvoicesSummaryDto } from "@repo/contracts";

import { DashboardService } from "./dashboard.service";
import { InvoicesClient } from "./invoices.client";

const raw: InvoicesSummaryDto = {
  revenue: 1234.5,
  outstanding: 0,
  overdue: 99.5,
  countsByStatus: { [InvoiceStatus.PAID]: 3 },
  recentInvoices: [
    {
      id: "inv-1",
      number: "INV-2026-0001",
      customerId: "c-1",
      customer: { id: "c-1", name: "PT Maju Jaya" },
      status: InvoiceStatus.PAID,
      issueDate: "2026-07-01",
      dueDate: "2026-07-15",
      paidAt: "2026-07-10T00:00:00.000Z",
      currency: "IDR",
      subtotal: "1000.00",
      taxTotal: "110.00",
      total: "1110.00",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
      overdue: false,
    },
  ],
  monthlyRevenue: [
    { month: "2026-06", revenue: 500 },
    { month: "2026-07", revenue: 1234.5 },
  ],
};

describe("DashboardService (aggregation)", () => {
  let service: DashboardService;
  let invoices: { summary: jest.Mock };

  beforeEach(async () => {
    invoices = { summary: jest.fn().mockResolvedValue(raw) };
    const module = await Test.createTestingModule({
      providers: [DashboardService, { provide: InvoicesClient, useValue: invoices }],
    }).compile();
    service = module.get(DashboardService);
  });

  it("shapes raw aggregates into the DashboardSummary contract", async () => {
    const result = await service.summary("some.token", { from: "2026-01-01", to: "2026-12-31" });

    expect(invoices.summary).toHaveBeenCalledWith("some.token", "2026-01-01", "2026-12-31");
    expect(result.revenue).toBe("1234.50");
    expect(result.outstanding).toBe("0.00");
    expect(result.overdue).toBe("99.50");
    expect(result.countsByStatus).toEqual({
      [InvoiceStatus.DRAFT]: 0,
      [InvoiceStatus.SENT]: 0,
      [InvoiceStatus.PAID]: 3,
      [InvoiceStatus.CANCELLED]: 0,
    });
    expect(result.recentInvoices).toHaveLength(1);
    expect(result.monthlyRevenue).toEqual([
      { month: "2026-06", revenue: "500.00" },
      { month: "2026-07", revenue: "1234.50" },
    ]);
  });
});
