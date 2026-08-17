import { Module } from "@nestjs/common";

import { CustomersClient } from "./customers.client";
import { InvoicesController } from "./invoices.controller";
import { InvoicesInternalController } from "./invoices-summary.controller";
import { InvoicesSummaryService } from "./invoices-summary.service";
import { InvoicesService } from "./invoices.service";

@Module({
  controllers: [InvoicesController, InvoicesInternalController],
  providers: [InvoicesService, CustomersClient, InvoicesSummaryService],
})
export class InvoicesModule {}
