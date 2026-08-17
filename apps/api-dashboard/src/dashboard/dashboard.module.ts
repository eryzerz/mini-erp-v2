import { Module } from "@nestjs/common";

import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { InvoicesClient } from "./invoices.client";

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, InvoicesClient],
})
export class DashboardModule {}
