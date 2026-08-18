import { createHash } from "node:crypto";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { computeInvoiceTotals, SEED_COMPANY_ID, SEED_USER_ADMIN_ID } from "@repo/common";
import { InvoiceStatus } from "@repo/contracts";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_INVOICES! }),
});

// Deterministic id so every seeded row upserts instead of duplicating. The
// customer ids reuse the exact derivation the customers service seed uses.
const keyedId = (key: string): string => {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex.slice(16, 18), 16) & 0x3f | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
};

// Deterministic PRNG so re-runs produce identical data.
const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rand = mulberry32(20260814);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number): number => min + rand() * (max - min);

const customers = [
  { slug: "maju-jaya", name: "PT Maju Jaya", taxId: "01.234.567.8-901.000" },
  { slug: "sentosa-abadi", name: "CV Sentosa Abadi", taxId: "02.345.678.9-012.000" },
  { slug: "berkah-makmur", name: "UD Berkah Makmur", taxId: "03.456.789.0-123.000" },
  { slug: "nusantara-tek", name: "PT Nusantara Teknologi", taxId: "04.567.890.1-234.000" },
  { slug: "karya-mandiri", name: "CV Karya Mandiri", taxId: "05.678.901.2-345.000" },
  { slug: "sinar-kencana", name: "PT Sinar Kencana", taxId: "06.789.012.3-456.000" },
  { slug: "bumi-sejahtera", name: "PT Bumi Sejahtera", taxId: "07.890.123.4-567.000" },
  { slug: "angkasa-raya", name: "CV Angkasa Raya", taxId: "08.901.234.5-678.000" },
  { slug: "kopi-senja", name: "Warung Kopi Senja", taxId: null },
  { slug: "studio-loka", name: "Studio Desain Loka", taxId: null },
  { slug: "elektronik-prima", name: "Toko Elektronik Prima", taxId: null },
  { slug: "bengkel-jaya", name: "Bengkel Motor Jaya", taxId: null },
] as const;

const itemsPool = [
  { description: "Konsultasi pengembangan perangkat lunak", unitPrice: 750000 },
  { description: "Perawatan server bulanan", unitPrice: 1500000 },
  { description: "Lisensi perangkat lunak (tahunan)", unitPrice: 8500000 },
  { description: "Pelatihan karyawan (per sesi)", unitPrice: 3500000 },
  { description: "Dukungan teknis (per jam)", unitPrice: 450000 },
  { description: "Penyimpanan cloud (per bulan)", unitPrice: 750000 },
  { description: "Desain logo dan brand", unitPrice: 6200000 },
] as const;

const VAT = "11.00";
const NONE = "0.00";

const invoiceItems = (): { description: string; quantity: string; unitPrice: string; taxRate: string }[] => {
  const count = 1 + Math.floor(rand() * 4);
  const used = new Set<number>();
  return Array.from({ length: count }, () => {
    let idx = Math.floor(rand() * itemsPool.length);
    while (used.has(idx)) {
      idx = Math.floor(rand() * itemsPool.length);
    }
    used.add(idx);
    const item = itemsPool[idx]!;
    return {
      description: item.description,
      quantity: (rand() < 0.3 ? between(1, 12) : 1).toFixed(4),
      unitPrice: item.unitPrice.toFixed(4),
      taxRate: rand() < 0.65 ? VAT : NONE,
    };
  });
};

const dateAt = (daysAgo: number, hour = 9): Date => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, Math.floor(rand() * 59), 0, 0);
  return d;
};

async function main(): Promise<void> {
  const statuses: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.CANCELLED];
  const year = new Date().getFullYear();
  let numberSequence = 1;
  let totalInvoices = 0;

  // Oldest month first so invoice numbers rise with recency (a real SEND today
  // continues after the most recent seeded invoice).
  for (let monthIndex = 5; monthIndex >= 0; monthIndex--) {
    for (let position = 0; position < statuses.length; position++) {
      const status = statuses[position]!;
      const invoiceId = keyedId(`invoice:${monthIndex}:${position}`);
      const customer = pick(customers);
      const issuedAt = dateAt(monthIndex * 30 + 2 + Math.floor(between(2, 25)));
      const dueDays = rand() < 0.5 ? 14 : 30;
      const dueDate = new Date(issuedAt.getTime() + dueDays * 24 * 60 * 60 * 1000);
      const items = invoiceItems();
      const totals = computeInvoiceTotals(items);
      const paidAt = status === InvoiceStatus.PAID
        ? new Date(issuedAt.getTime() + between(3, 20) * 24 * 60 * 60 * 1000)
        : null;
      const isDraft = status === InvoiceStatus.DRAFT;
      const invoiceNumber = isDraft ? null : `INV-${year}-${String(numberSequence++).padStart(4, "0")}`;

      await prisma.invoice.upsert({
        where: { id: invoiceId },
        update: {
          status,
          number: invoiceNumber,
          issueDate: isDraft ? null : issuedAt,
          dueDate,
          paidAt,
          customerId: keyedId(`customer:${customer.slug}`),
          customerName: customer.name,
          customerTaxId: customer.taxId,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
        },
        create: {
          id: invoiceId,
          companyId: SEED_COMPANY_ID,
          customerId: keyedId(`customer:${customer.slug}`),
          createdById: SEED_USER_ADMIN_ID,
          status,
          number: invoiceNumber,
          issueDate: isDraft ? null : issuedAt,
          dueDate,
          paidAt,
          currency: "IDR",
          customerName: customer.name,
          customerTaxId: customer.taxId,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
        },
      });

      await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
      await prisma.invoiceItem.createMany({
        data: items.map((item, index) => ({
          invoiceId,
          position: index + 1,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      });

      if (!isDraft) {
        const history: { fromStatus: InvoiceStatus | null; toStatus: InvoiceStatus; at: Date }[] = [
          { fromStatus: InvoiceStatus.DRAFT, toStatus: InvoiceStatus.SENT, at: issuedAt },
        ];
        if (status === InvoiceStatus.PAID && paidAt) {
          history.push({ fromStatus: InvoiceStatus.SENT, toStatus: InvoiceStatus.PAID, at: paidAt });
        }
        if (status === InvoiceStatus.CANCELLED) {
          history.push({
            fromStatus: rand() < 0.5 ? InvoiceStatus.SENT : InvoiceStatus.DRAFT,
            toStatus: InvoiceStatus.CANCELLED,
            at: new Date(issuedAt.getTime() + between(2, 10) * 24 * 60 * 60 * 1000),
          });
        }
        for (const entry of history) {
          await prisma.invoiceStatusChange.upsert({
            where: { id: keyedId(`history:${invoiceId}:${entry.toStatus}`) },
            update: {
              fromStatus: entry.fromStatus,
              toStatus: entry.toStatus,
              at: entry.at,
            },
            create: {
              id: keyedId(`history:${invoiceId}:${entry.toStatus}`),
              invoiceId,
              changedById: SEED_USER_ADMIN_ID,
              fromStatus: entry.fromStatus,
              toStatus: entry.toStatus,
              at: entry.at,
            },
          });
        }
      }

      totalInvoices++;
    }
  }
  console.log(`Invoices seed complete: ${totalInvoices} invoices.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
