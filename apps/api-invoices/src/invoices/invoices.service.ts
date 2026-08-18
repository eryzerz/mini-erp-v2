import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { InvoiceDto } from "@repo/contracts";
import type { PaginatedResult } from "@repo/common";
import { InvoiceStatus } from "@repo/contracts";
import { computeInvoiceTotals, paginate } from "@repo/common";
import type { Invoice } from "../generated/prisma/client";

import { PrismaService } from "../prisma.service";
import { CustomersClient, CustomerSnapshot } from "./customers.client";
import {
  CreateInvoiceDto,
  ListInvoicesQueryDto,
  UpdateInvoiceDto,
} from "./invoices.dto";
import { toInvoiceDto } from "./invoice.mapper";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersClient,
  ) {}

  private async getOwnedInvoice(companyId: string, id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, companyId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  private assertStatus(invoice: Invoice, allowed: InvoiceStatus[]): void {
    if (!allowed.includes(invoice.status)) {
      throw new ConflictException(
        `Invoice status ${invoice.status} does not allow this operation`,
      );
    }
  }

  /**
   * Resolve and validate a customer's snapshot over S2S. Run at draft create
   * and whenever a draft's customer changes, so the invoices database carries
   * the name/taxId locally and drafts display their customer without further
   * cross-service reads (previously only SEND snapshotted, leaving draft lists
   * blank). A missing or foreign customer surfaces here as a domain error.
   */
  private async snapshotCustomer(companyId: string, customerId: string): Promise<CustomerSnapshot> {
    const snapshot = await this.customers.getSnapshot(customerId);
    if (!snapshot) {
      throw new NotFoundException("Customer not found");
    }
    if (snapshot.companyId !== companyId) {
      throw new ForbiddenException("Customer does not belong to this company");
    }
    return snapshot;
  }

  private async nextNumber(companyId: string, year: number): Promise<string> {
    const prefix = `INV-${year}-`;
    const existing = await this.prisma.invoice.findMany({
      where: { companyId, number: { startsWith: prefix } },
      select: { number: true },
      orderBy: { number: "desc" },
    });
    const maxSeq = existing.reduce((max, invoice) => {
      const seq = Number.parseInt((invoice.number ?? "").slice(prefix.length), 10);
      return Number.isFinite(seq) ? Math.max(max, seq) : max;
    }, 0);
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  }

  /**
   * Apply a status transition inside a transaction: update the invoice, append
   * the audit entry, and return the updated invoice.
   */
  private async transition(
    invoiceId: string,
    actor: { companyId: string; sub: string },
    invoice: Invoice,
    toStatus: InvoiceStatus,
    data: {
      number?: string;
      issueDate?: Date;
      paidAt?: Date;
      customerName?: string;
      customerTaxId?: string | null;
    } = {},
  ): Promise<InvoiceDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: toStatus, ...data },
      });
      await tx.invoiceStatusChange.create({
        data: {
          invoiceId,
          changedById: actor.sub,
          fromStatus: invoice.status,
          toStatus,
        },
      });
      return result;
    });

    return toInvoiceDto(updated);
  }

  async create(actor: { companyId: string; sub: string }, dto: CreateInvoiceDto): Promise<InvoiceDto> {
    // Resolve the customer snapshot up front so the draft carries the name and
    // taxId locally (a draft whose customer vanished, or belongs to another
    // company, is rejected here rather than silently left blank).
    const snapshot = await this.snapshotCustomer(actor.companyId, dto.customerId);

    const totals = computeInvoiceTotals(
      dto.items.map((item) => ({ ...item, taxRate: item.taxRate ?? "0" })),
    );

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          companyId: actor.companyId,
          customerId: dto.customerId,
          createdById: actor.sub,
          dueDate: new Date(dto.dueDate),
          customerName: snapshot.name,
          customerTaxId: snapshot.taxId,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          items: {
            create: dto.items.map((item, index) => ({
              position: index + 1,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate ?? "0",
            })),
          },
        },
      });
      return created;
    });

    return toInvoiceDto(invoice);
  }

  async findAll(
    actor: { companyId: string },
    query: ListInvoicesQueryDto,
  ): Promise<PaginatedResult<InvoiceDto>> {
    const { page, pageSize, status, search, from, to, sort } = query;

    const where = {
      companyId: actor.companyId,
      ...(status ? { status } : {}),
      ...(search ? { number: { contains: search, mode: "insensitive" as const } } : {}),
      ...(from || to
        ? {
            issueDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const sortable = sort ?? "issueDate";

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: sortable === "total" ? { total: "desc" } : { [sortable]: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginate(invoices.map(toInvoiceDto), total, page, pageSize);
  }

  async findOne(actor: { companyId: string }, id: string): Promise<InvoiceDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        items: true,
        history: { orderBy: { at: "desc" } },
      },
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return toInvoiceDto(invoice);
  }

  async update(
    actor: { companyId: string; sub: string },
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<InvoiceDto> {
    const invoice = await this.getOwnedInvoice(actor.companyId, id);
    this.assertStatus(invoice, [InvoiceStatus.DRAFT]);

    const items = dto.items ?? [];
    const totals =
      items.length > 0
        ? computeInvoiceTotals(items.map((item) => ({ ...item, taxRate: item.taxRate ?? "0" })))
        : undefined;

    // If the draft's customer changes, refresh the local name/taxId snapshot so
    // the stored summary always matches the customer the draft is billed to.
    const customerSnapshot =
      dto.customerId && dto.customerId !== invoice.customerId
        ? await this.snapshotCustomer(actor.companyId, dto.customerId)
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (items.length > 0) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }
      const result = await tx.invoice.update({
        where: { id },
        data: {
          ...(dto.customerId ? { customerId: dto.customerId } : {}),
          ...(customerSnapshot
            ? { customerName: customerSnapshot.name, customerTaxId: customerSnapshot.taxId }
            : {}),
          ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
          ...(totals
            ? {
                subtotal: totals.subtotal,
                taxTotal: totals.taxTotal,
                total: totals.total,
              }
            : {}),
          ...(items.length > 0
            ? {
                items: {
                  create: items.map((item, index) => ({
                    position: index + 1,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    taxRate: item.taxRate ?? "0",
                  })),
                },
              }
            : {}),
        },
      });
      return result;
    });

    return toInvoiceDto(updated);
  }

  async send(actor: { companyId: string; sub: string }, id: string): Promise<InvoiceDto> {
    const invoice = await this.getOwnedInvoice(actor.companyId, id);
    this.assertStatus(invoice, [InvoiceStatus.DRAFT]);

    // Re-resolve the customer snapshot at first SEND (the fleet's original
    // cross-service leg): guards against a customer deleted since the draft was
    // saved, and refreshes the stored name/taxId for the issued invoice.
    const snapshot = await this.snapshotCustomer(actor.companyId, invoice.customerId);

    const number = await this.nextNumber(actor.companyId, new Date().getFullYear());
    // nextNumber reads outside the transaction, so two concurrent SENDs could
    // pick the same number; the @@unique([companyId, number]) constraint
    // backstops the collision.
    return this.transition(id, actor, invoice, InvoiceStatus.SENT, {
      number,
      issueDate: new Date(),
      customerName: snapshot.name,
      customerTaxId: snapshot.taxId,
    });
  }

  async markPaid(actor: { companyId: string; sub: string }, id: string): Promise<InvoiceDto> {
    const invoice = await this.getOwnedInvoice(actor.companyId, id);
    this.assertStatus(invoice, [InvoiceStatus.SENT]);

    return this.transition(id, actor, invoice, InvoiceStatus.PAID, {
      paidAt: new Date(),
    });
  }

  async cancel(actor: { companyId: string; sub: string }, id: string): Promise<InvoiceDto> {
    const invoice = await this.getOwnedInvoice(actor.companyId, id);
    this.assertStatus(invoice, [InvoiceStatus.DRAFT, InvoiceStatus.SENT]);

    return this.transition(id, actor, invoice, InvoiceStatus.CANCELLED);
  }

  async remove(actor: { companyId: string }, id: string): Promise<{ success: true }> {
    const invoice = await this.getOwnedInvoice(actor.companyId, id);
    this.assertStatus(invoice, [InvoiceStatus.DRAFT]);
    await this.prisma.invoice.delete({ where: { id } });
    return { success: true };
  }
}
