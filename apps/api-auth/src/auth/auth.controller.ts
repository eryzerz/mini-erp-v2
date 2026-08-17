import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public, RequestWithUser } from "@repo/common";
import type { LoginResponse, UserDto } from "@repo/contracts";

import { LoginDto, LogoutDto, RefreshDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post("login")
  @ApiOperation({ summary: "Log in with email and password" })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post("refresh")
  @ApiOperation({ summary: "Rotate a refresh token into a new token pair" })
  refresh(@Body() dto: RefreshDto): Promise<LoginResponse> {
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth()
  @Post("logout")
  @ApiOperation({ summary: "Revoke a refresh token" })
  logout(@Body() dto: LogoutDto): Promise<{ success: true }> {
    return this.authService.logout(dto);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "Return the current authenticated user" })
  me(@Req() req: RequestWithUser): Promise<UserDto> {
    return this.authService.me(req.user.sub);
  }
}
