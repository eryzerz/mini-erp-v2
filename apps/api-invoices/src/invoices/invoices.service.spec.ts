import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InvoiceStatus } from "@repo/contracts";

import { PrismaService } from "../prisma.service";
import { CustomersClient, CustomerSnapshot } from "./customers.client";
import { InvoicesService } from "./invoices.service";

describe("InvoicesService (lifecycle)", () => {
  let service: InvoicesService;
  let prisma: {
    invoice: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    invoiceItem: { deleteMany: jest.Mock };
    invoiceStatusChange: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let customers: { getSnapshot: jest.Mock };

  const actor = { companyId: "company-1", sub: "user-1" };
  const snapshot: CustomerSnapshot = {
    id: "cust-1",
    name: "PT Maju Jaya",
    taxId: "01.234.567.8-901.000",
    companyId: "company-1",
  };

  const baseInvoice = {
    id: "inv-1",
    companyId: "company-1",
    customerId: "cust-1",
    createdById: "user-1",
    status: InvoiceStatus.DRAFT,
    number: null,
    issueDate: null,
    dueDate: new Date("2026-09-15"),
    paidAt: null,
    currency: "IDR",
    subtotal: 1000,
    taxTotal: 110,
    total: 1110,
    customerName: null,
    customerTaxId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const draftInvoice = baseInvoice;
  const sentInvoice = {
    ...baseInvoice,
    status: InvoiceStatus.SENT,
    number: "INV-2026-0001",
    issueDate: new Date(),
    customerName: snapshot.name,
    customerTaxId: snapshot.taxId,
  };
  const paidInvoice = {
    ...sentInvoice,
    status: InvoiceStatus.PAID,
    paidAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      invoiceItem: { deleteMany: jest.fn() },
      invoiceStatusChange: { create: jest.fn() },
      $transaction: jest.fn((fn: (client: unknown) => unknown) => fn(prisma)),
    };
    customers = { getSnapshot: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersClient, useValue: customers },
      ],
    }).compile();

    service = module.get(InvoicesService);
  });

  describe("send", () => {
    it("fetches the customer snapshot, assigns the next number, and records history", async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      customers.getSnapshot.mockResolvedValue(snapshot);
      prisma.invoice.findMany.mockResolvedValue([{ number: "INV-2026-0001" }]);
      prisma.invoice.update.mockResolvedValue({
        ...draftInvoice,
        status: InvoiceStatus.SENT,
        number: "INV-2026-0002",
        issueDate: new Date("2026-08-15"),
        customerName: snapshot.name,
        customerTaxId: snapshot.taxId,
      });

      const result = await service.send(actor, "inv-1");

      expect(customers.getSnapshot).toHaveBeenCalledWith("cust-1");
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: "INV-2026-0002",
            customerName: snapshot.name,
            customerTaxId: snapshot.taxId,
          }),
        }),
      );
      expect(prisma.invoiceStatusChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: InvoiceStatus.DRAFT,
          toStatus: InvoiceStatus.SENT,
        }),
      });
      expect(result.status).toBe(InvoiceStatus.SENT);
      expect(result.number).toBe("INV-2026-0002");
      expect(result.customer).toEqual({ id: "cust-1", name: snapshot.name });
    });

    it("rejects sending a non-draft invoice", async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);

      await expect(service.send(actor, "inv-1")).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it("rejects sending when the customer no longer exists", async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      customers.getSnapshot.mockResolvedValue(null);

      await expect(service.send(actor, "inv-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects sending a customer that belongs to another company", async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      customers.getSnapshot.mockResolvedValue({ ...snapshot, companyId: "company-2" });

      await expect(service.send(actor, "inv-1")).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe("markPaid", () => {
    it("marks a sent invoice paid and records history", async () => {
      prisma.invoice.findFirst.mockResolvedValue(sentInvoice);
      prisma.invoice.update.mockResolvedValue({
        ...sentInvoice,
        status: InvoiceStatus.PAID,
        paidAt: new Date("2026-08-15T10:00:00Z"),
      });

      const result = await service.markPaid(actor, "inv-1");

      expect(prisma.invoiceStatusChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: InvoiceStatus.SENT,
          toStatus: InvoiceStatus.PAID,
        }),
      });
      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(result.paidAt).not.toBeNull();
    });

    it("rejects marking a draft paid", async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);

      await expect(service.markPaid(actor, "inv-1")).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("cancel", () => {
    it("cancels a draft", async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      prisma.invoice.update.mockResolvedValue({ ...draftInvoice, status: InvoiceStatus.CANCELLED });

      const result = await service.cancel(actor, "inv-1");

      expect(prisma.invoiceStatusChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ toStatus: InvoiceStatus.CANCELLED }),
      });
      expect(result.status).toBe(InvoiceStatus.CANCELLED);
    });

    it("cancels a sent invoice", async () => {
      prisma.invoice.findFirst.mockResolvedValue(sentInvoice);
      prisma.invoice.update.mockResolvedValue({ ...sentInvoice, status: InvoiceStatus.CANCELLED });

      await expect(service.cancel(actor, "inv-1")).resolves.toMatchObject({
        status: InvoiceStatus.CANCELLED,
      });
    });

    it("rejects cancelling a paid invoice", async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);

      await expect(service.cancel(actor, "inv-1")).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("remove", () => {
    it("deletes a draft", async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      prisma.invoice.delete.mockResolvedValue(draftInvoice);

      await expect(service.remove(actor, "inv-1")).resolves.toEqual({ success: true });
      expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    });

    it("rejects deleting a sent invoice", async () => {
      prisma.invoice.findFirst.mockResolvedValue(sentInvoice);

      await expect(service.remove(actor, "inv-1")).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
