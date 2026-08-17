import { createHash } from "node:crypto";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { SEED_COMPANY_ID } from "@repo/common";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_CUSTOMERS! }),
});

// The auth service seeds this company with this exact id (see SEED_COMPANY_ID
// in @repo/common); customers reference it as a logical cross-service id.
const COMPANY_ID = SEED_COMPANY_ID;

// Deterministic id so every seeded row upserts instead of duplicating. The same
// derivation is used by the invoices service seed for its customer snapshots.
const keyedId = (key: string): string => {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex.slice(16, 18), 16) & 0x3f | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
};

const customers = [
  { slug: "maju-jaya", name: "PT Maju Jaya", email: "hello@majujaya.co.id", phone: "+62 21 555 0134", taxId: "01.234.567.8-901.000", address: "Jl. Sudirman Kav. 52, Jakarta Selatan" },
  { slug: "sentosa-abadi", name: "CV Sentosa Abadi", email: "admin@sentosaabadi.com", phone: "+62 31 555 0887", taxId: "02.345.678.9-012.000", address: "Jl. Raya Darmo 88, Surabaya" },
  { slug: "berkah-makmur", name: "UD Berkah Makmur", email: "berkah@makmur.co.id", phone: "+62 22 555 1729", taxId: "03.456.789.0-123.000", address: "Jl. Braga 21, Bandung" },
  { slug: "nusantara-tek", name: "PT Nusantara Teknologi", email: "finance@nustek.id", phone: "+62 21 555 4021", taxId: "04.567.890.1-234.000", address: "Jl. Rasuna Said Kav. B-2, Jakarta Selatan" },
  { slug: "karya-mandiri", name: "CV Karya Mandiri", email: "info@karyamandiri.co.id", phone: "+62 361 555 660", taxId: "05.678.901.2-345.000", address: "Jl. Teuku Umar 45, Denpasar" },
  { slug: "sinar-kencana", name: "PT Sinar Kencana", email: "ap@sinarkencana.com", phone: "+62 24 555 8831", taxId: "06.789.012.3-456.000", address: "Jl. Pandanaran 110, Semarang" },
  { slug: "bumi-sejahtera", name: "PT Bumi Sejahtera", email: "keuangan@bumisejahtera.co.id", phone: "+62 21 555 9094", taxId: "07.890.123.4-567.000", address: "Jl. Thamrin 28, Jakarta Pusat" },
  { slug: "angkasa-raya", name: "CV Angkasa Raya", email: "contact@angkasaraya.com", phone: "+62 274 555 412", taxId: "08.901.234.5-678.000", address: "Jl. Malioboro 15, Yogyakarta" },
  { slug: "kopi-senja", name: "Warung Kopi Senja", email: null, phone: "+62 812 3456 7890", taxId: null, address: "Jl. Kayumanis 7, Jakarta Timur" },
  { slug: "studio-loka", name: "Studio Desain Loka", email: "loka@studio.id", phone: "+62 813 9876 5432", taxId: null, address: "Jl. Cihampelas 102, Bandung" },
  { slug: "elektronik-prima", name: "Toko Elektronik Prima", email: null, phone: "+62 811 2233 4455", taxId: null, address: "Jl. Ahmad Yani 300, Surabaya" },
  { slug: "bengkel-jaya", name: "Bengkel Motor Jaya", email: "bengkeljaya@gmail.com", phone: "+62 857 1122 3344", taxId: null, address: "Jl. Gajah Mada 61, Malang" },
] as const;

async function main(): Promise<void> {
  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: keyedId(`customer:${customer.slug}`) },
      update: { name: customer.name },
      create: {
        id: keyedId(`customer:${customer.slug}`),
        companyId: COMPANY_ID,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        taxId: customer.taxId,
        address: customer.address,
      },
    });
  }
  console.log(`Customers seed complete: ${customers.length} customers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
