import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const prismaErrorCode = (error: Prisma.PrismaClientKnownRequestError): { code: string; status: number; message: string } => {
  switch (error.code) {
    case "P2002":
      return { code: "CONFLICT", status: HttpStatus.CONFLICT, message: "A record with the same unique value already exists" };
    case "P2025":
      return { code: "NOT_FOUND", status: HttpStatus.NOT_FOUND, message: "Record not found" };
    case "P2003":
      return { code: "INVALID_REFERENCE", status: HttpStatus.BAD_REQUEST, message: "Referenced record does not exist" };
    default:
      return { code: "DATABASE_ERROR", status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Database error" };
  }
};

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

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = prismaErrorCode(exception);
      response.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } });
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
