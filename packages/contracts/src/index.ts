export const InvoiceStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const UserRole = {
  ADMIN: "ADMIN",
  ACCOUNTANT: "ACCOUNTANT",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const CurrencyCode = "IDR" as const;
export type CurrencyCode = typeof CurrencyCode;

/** Tax rates offered on invoice lines, as decimal strings (percent). */
export const TAX_RATES = ["0.00", "11.00"] as const;
export type TaxRate = (typeof TAX_RATES)[number];

/** ISO date string (YYYY-MM-DD). */
export type DateString = string;
/** Money serialized as a decimal string, e.g. "1500000.00". */
export type MoneyString = string;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface CustomerDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummaryDto {
  id: string;
  name: string;
}

/**
 * S2S boundary fact: typed contracts are the cross-service check. The
 * customers service returns this over the internal endpoint; the invoices
 * service consumes it to snapshot a customer.
 */
export interface InternalCustomerDto {
  id: string;
  name: string;
  taxId: string | null;
  companyId: string;
}

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: string;
  unitPrice: MoneyString;
  taxRate: string;
  lineTotal: MoneyString;
}

export interface InvoiceStatusChangeDto {
  id: string;
  fromStatus: InvoiceStatus | null;
  toStatus: InvoiceStatus;
  changedById: string;
  at: string;
}

export interface InvoiceDto {
  id: string;
  number: string | null;
  customerId: string;
  customer?: CustomerSummaryDto;
  status: InvoiceStatus;
  issueDate: DateString | null;
  dueDate: DateString;
  paidAt: string | null;
  currency: CurrencyCode;
  subtotal: MoneyString;
  taxTotal: MoneyString;
  total: MoneyString;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  items?: InvoiceItemDto[];
  history?: InvoiceStatusChangeDto[];
}

export interface InvoiceCreateInput {
  customerId: string;
  dueDate: DateString;
  items: {
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate?: string;
  }[];
}

export interface InvoiceUpdateInput {
  customerId?: string;
  dueDate?: DateString;
  items?: InvoiceCreateInput["items"];
}

/**
 * S2S boundary contract. The invoices service computes these raw aggregates
 * over its own database; the dashboard service re-shapes them into
 * DashboardSummary. Money values are unformatted numbers — formatting is the
 * dashboard's job.
 */
export interface InvoicesSummaryDto {
  revenue: number;
  outstanding: number;
  overdue: number;
  countsByStatus: Partial<Record<InvoiceStatus, number>>;
  recentInvoices: InvoiceDto[];
  monthlyRevenue: { month: string; revenue: number }[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface DashboardSummary {
  revenue: MoneyString;
  outstanding: MoneyString;
  overdue: MoneyString;
  countsByStatus: Record<InvoiceStatus, number>;
  recentInvoices: InvoiceDto[];
  monthlyRevenue: { month: string; revenue: MoneyString }[];
}
