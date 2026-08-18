import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { InvoicesSummaryDto } from "@repo/contracts";
import { S2SClient, createS2SClient } from "@repo/common";

/**
 * The dashboard forwards the caller's user JWT to the invoices service, so its
 * JwtAuthGuard scopes to the caller's company; the shared internal key rides
 * along as the machine credential. The dashboard has no database, so this leg
 * is its only data source.
 */
@Injectable()
export class InvoicesClient {
  private readonly client: S2SClient;

  constructor(config: ConfigService) {
    this.client = createS2SClient(config.getOrThrow<string>("INVOICES_SERVICE_URL"));
  }

  summary(token: string, from?: string, to?: string): Promise<InvoicesSummaryDto> {
    const params = new URLSearchParams();
    if (from) {
      params.set("from", from);
    }
    if (to) {
      params.set("to", to);
    }
    const queryString = params.toString();
    return this.client.get(
      `/api/v1/internal/invoices/summary${queryString ? `?${queryString}` : ""}`,
      token,
    );
  }
}
