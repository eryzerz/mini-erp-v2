import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { UserDto } from "@repo/contracts";
import type { PaginatedResult } from "@repo/common";
import { RequestWithUser, Roles } from "@repo/common";
import { UserRole } from "@repo/contracts";

import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from "./users.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List users (ADMIN only)" })
  findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserDto>> {
    return this.usersService.findAll(req.user.companyId, query);
  }

  @Post()
  @ApiOperation({ summary: "Create a user (ADMIN only)" })
  create(@Req() req: RequestWithUser, @Body() dto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(req.user.companyId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a user (ADMIN only)" })
  update(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.update(req.user.companyId, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a user (ADMIN only)" })
  remove(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    return this.usersService.remove(req.user.companyId, id, req.user.sub);
  }
}
