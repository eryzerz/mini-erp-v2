import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { InvoicesSummaryDto } from "@repo/contracts";
import { Internal, RequestWithUser } from "@repo/common";

import { InternalSummaryQueryDto } from "./invoices-summary.dto";
import { InvoicesSummaryService } from "./invoices-summary.service";

/**
 * S2S surface for the dashboard service: the dashboard has no database, so it
 * forwards the caller's user JWT here; JwtAuthGuard scopes to the caller's
 * company and InternalKeyGuard supplies the machine credential. Not
 * @Public() — a valid user token is required on this leg.
 */
@ApiTags("internal")
@Controller("internal/invoices")
export class InvoicesInternalController {
  constructor(private readonly summaryService: InvoicesSummaryService) {}

  @Internal()
  @Get("summary")
  @ApiOperation({ summary: "Dashboard aggregates scoped to the forwarded JWT's company (S2S)" })
  summary(@Req() req: RequestWithUser, @Query() query: InternalSummaryQueryDto): Promise<InvoicesSummaryDto> {
    const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined;
    const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined;
    return this.summaryService.summarize(req.user.companyId, from, to);
  }
}
