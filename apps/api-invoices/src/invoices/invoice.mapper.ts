import type { CurrencyCode, InvoiceDto } from "@repo/contracts";
import { InvoiceStatus } from "@repo/contracts";
import { computeLineSubtotal, trimTrailingZeros } from "@repo/common";
import type { Invoice, InvoiceItem, InvoiceStatusChange } from "../generated/prisma/client";

export const moneyString = (value: { toFixed: (digits: number) => string }): string => value.toFixed(2);

export type InvoiceWithRelations = Invoice & {
  items?: InvoiceItem[];
  history?: InvoiceStatusChange[];
};

export const toInvoiceDto = (invoice: InvoiceWithRelations): InvoiceDto => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // A draft has no snapshot yet (captured at SEND from the customers service),
  // so the customer summary is only emitted once the invoice is sent.
  const customer = invoice.customerName
    ? { id: invoice.customerId, name: invoice.customerName }
    : undefined;
  return {
    id: invoice.id,
    number: invoice.number,
    customerId: invoice.customerId,
    customer,
    status: invoice.status,
    issueDate: invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : null,
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    currency: invoice.currency as CurrencyCode,
    subtotal: moneyString(invoice.subtotal),
    taxTotal: moneyString(invoice.taxTotal),
    total: moneyString(invoice.total),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    overdue:
      invoice.status === InvoiceStatus.SENT && invoice.dueDate.getTime() < today.getTime(),
    items: invoice.items
      ?.sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        description: item.description,
        quantity: trimTrailingZeros(item.quantity.toFixed(4)),
        unitPrice: trimTrailingZeros(item.unitPrice.toFixed(4)),
        taxRate: item.taxRate.toFixed(2),
        // Lines are rounded to 2 dp before summing, so the displayed line
        // totals always add up to the invoice total.
        lineTotal: moneyString(computeLineSubtotal(Number(item.quantity), Number(item.unitPrice))),
      })),
    history: invoice.history?.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      changedById: entry.changedById,
      at: entry.at.toISOString(),
    })),
  };
};
