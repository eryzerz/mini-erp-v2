import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { UserRole } from "@repo/contracts";

import { IS_PUBLIC_KEY } from "./public.decorator";

export interface AuthUser {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string;
}

export interface RequestWithUser {
  user: AuthUser;
  // The raw bearer token, for services that forward the caller's JWT on an
  // S2S leg (wayfinder ticket 05) — e.g. the dashboard to the invoices service.
  token: string;
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers["authorization"];
    const token = Array.isArray(authorization)
      ? authorization[0]
      : authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthUser>(token);
      request.user = payload;
      request.token = token;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
