import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { InvoiceDto } from "@repo/contracts";
import type { PaginatedResult } from "@repo/common";
import { RequestWithUser, Roles } from "@repo/common";
import { UserRole } from "@repo/contracts";

import { CreateInvoiceDto, ListInvoicesQueryDto, UpdateInvoiceDto } from "./invoices.dto";
import { InvoicesService } from "./invoices.service";

@ApiTags("invoices")
@ApiBearerAuth()
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: "List invoices with filters" })
  findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedResult<InvoiceDto>> {
    return this.invoicesService.findAll(req.user, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an invoice with items and status history" })
  findOne(@Req() req: RequestWithUser, @Param("id") id: string): Promise<InvoiceDto> {
    return this.invoicesService.findOne(req.user, id);
  }

  @Post()
  @ApiOperation({ summary: "Create a draft invoice" })
  create(@Req() req: RequestWithUser, @Body() dto: CreateInvoiceDto): Promise<InvoiceDto> {
    return this.invoicesService.create(req.user, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a draft invoice" })
  update(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<InvoiceDto> {
    return this.invoicesService.update(req.user, id, dto);
  }

  @Post(":id/send")
  @ApiOperation({ summary: "Send a draft invoice (DRAFT → SENT, assigns number)" })
  send(@Req() req: RequestWithUser, @Param("id") id: string): Promise<InvoiceDto> {
    return this.invoicesService.send(req.user, id);
  }

  @Post(":id/mark-paid")
  @ApiOperation({ summary: "Mark an invoice paid (SENT → PAID)" })
  markPaid(@Req() req: RequestWithUser, @Param("id") id: string): Promise<InvoiceDto> {
    return this.invoicesService.markPaid(req.user, id);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel an invoice (DRAFT|SENT → CANCELLED)" })
  cancel(@Req() req: RequestWithUser, @Param("id") id: string): Promise<InvoiceDto> {
    return this.invoicesService.cancel(req.user, id);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Delete a draft invoice (ADMIN only)" })
  remove(@Req() req: RequestWithUser, @Param("id") id: string): Promise<{ success: true }> {
    return this.invoicesService.remove(req.user, id);
  }
}
