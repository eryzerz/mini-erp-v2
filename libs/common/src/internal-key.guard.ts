import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_INTERNAL_KEY } from "./internal.decorator";
import type { RequestWithUser } from "./jwt-auth.guard";

/**
 * Enforces the machine-to-machine key on endpoints marked @Internal() (S2S
 * calls carry a shared JWT plus the internal API key, never bare network
 * trust). Register it as a global APP_GUARD; it passes everything except
 * @Internal() routes, which must present the shared x-internal-key header.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isInternal = this.reflector.getAllAndOverride<boolean>(IS_INTERNAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isInternal) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers["x-internal-key"];
    const presented = Array.isArray(header) ? header[0] : header;
    if (!presented || presented !== process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException("Invalid internal key");
    }
    return true;
  }
}
