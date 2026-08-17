import { Module } from "@nestjs/common";

import { CustomersClient } from "./customers.client";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, CustomersClient],
})
export class InvoicesModule {}
