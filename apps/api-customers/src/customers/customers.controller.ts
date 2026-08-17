import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CustomerDto } from "@repo/contracts";
import type { PaginatedResult } from "@repo/common";
import { RequestWithUser, Roles } from "@repo/common";
import { UserRole } from "@repo/contracts";

import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from "./customers.dto";
import { CustomersService } from "./customers.service";

@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: "List customers" })
  findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListCustomersQueryDto,
  ): Promise<PaginatedResult<CustomerDto>> {
    return this.customersService.findAll(req.user.companyId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a customer" })
  findOne(@Req() req: RequestWithUser, @Param("id") id: string): Promise<CustomerDto> {
    return this.customersService.findOne(req.user.companyId, id);
  }

  @Post()
  @ApiOperation({ summary: "Create a customer" })
  create(@Req() req: RequestWithUser, @Body() dto: CreateCustomerDto): Promise<CustomerDto> {
    return this.customersService.create(req.user.companyId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a customer" })
  update(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    return this.customersService.update(req.user.companyId, id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Delete a customer (ADMIN only)" })
  remove(@Req() req: RequestWithUser, @Param("id") id: string): Promise<{ success: true }> {
    return this.customersService.remove(req.user.companyId, id);
  }
}
