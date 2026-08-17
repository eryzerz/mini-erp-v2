import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: "VALIDATION_FAILED",
          message: "Request validation failed",
          details: errors.map((error) => ({
            field: error.property,
            messages: Object.values(error.constraints ?? {}),
          })),
        }),
    }),
  );
  // No CORS: the browser only talks to the Vercel origin; edge + S2S legs are
  // server-side (wayfinder ticket 10 — CORS_ORIGIN is removed from services).

  const document = new DocumentBuilder()
    .setTitle("SLM ERP — Invoices service")
    .setDescription("Invoice lifecycle (draft → sent → paid / cancelled) for the fleet")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, document), {
    useGlobalPrefix: true,
  });

  const port = Number(config.get<string>("PORT") ?? 10000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
