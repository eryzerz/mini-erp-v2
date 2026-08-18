import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Dashboard has no database, so there is no Prisma error branch.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const statusLabel = String(HttpStatus[status] ?? status);
      const body = exception.getResponse();
      let payload: ErrorBody;
      if (typeof body === "string") {
        payload = { error: { code: statusLabel, message: body } };
      } else if (typeof body === "object" && body !== null && "message" in body) {
        const message = (body as { message: unknown }).message;
        payload = {
          error: {
            code: (body as { error?: string }).error ?? statusLabel,
            message: Array.isArray(message) ? message.join(", ") : String(message),
            details: Array.isArray(message) ? message : undefined,
          },
        };
      } else {
        payload = { error: { code: statusLabel, message: JSON.stringify(body) } };
      }
      response.status(status).json(payload);
      return;
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: exception instanceof Error ? exception.message : "Unexpected error",
      },
    });
  }
}
