import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { InternalCustomerDto } from "@repo/contracts";
import { S2SClient, createS2SClient } from "@repo/common";

export type CustomerSnapshot = InternalCustomerDto;

/**
 * The customers service is the invoices service's only cross-service
 * dependency. Reached over the internal API key; a missing customer surfaces
 * as null so the caller can translate it into a domain error.
 */
@Injectable()
export class CustomersClient {
  private readonly client: S2SClient;

  constructor(config: ConfigService) {
    this.client = createS2SClient(config.getOrThrow<string>("CUSTOMERS_SERVICE_URL"));
  }

  getSnapshot(customerId: string): Promise<CustomerSnapshot | null> {
    return this.client.getOrNull<CustomerSnapshot>(`/api/v1/internal/customers/${customerId}`);
  }
}
