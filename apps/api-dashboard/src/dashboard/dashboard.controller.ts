import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { DashboardSummary } from "@repo/contracts";
import { RequestWithUser } from "@repo/common";

import { DashboardQueryDto } from "./dashboard.dto";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @ApiOperation({ summary: "Dashboard summary metrics" })
  summary(@Req() req: RequestWithUser, @Query() query: DashboardQueryDto): Promise<DashboardSummary> {
    return this.dashboardService.summary(req.token, query);
  }
}
