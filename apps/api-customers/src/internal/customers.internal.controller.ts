import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { InternalCustomerDto } from "@repo/contracts";
import { Internal, Public } from "@repo/common";

import { PrismaService } from "../prisma.service";

/**
 * S2S surface (wayfinder ticket 05/06): other services fetch a customer fact
 * over the internal key when they must — the invoices service snapshots a
 * customer at SEND. Guards the same rows the authenticated API does, but the
 * caller (not this service) is responsible for company scoping; companyId is
 * returned so the caller can assert it.
 */
@ApiTags("internal")
@Controller("internal/customers")
export class CustomersInternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Internal()
  @Get(":id")
  @ApiOperation({ summary: "Fetch a customer for another fleet service (S2S)" })
  async findOne(@Param("id") id: string): Promise<InternalCustomerDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, taxId: true, companyId: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }
}
