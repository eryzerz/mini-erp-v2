import { BadRequestException } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { JwtAuthGuard, RolesGuard } from "@repo/common";

import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET") ?? "dev-secret",
        signOptions: { expiresIn: "15m" },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
    HealthModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {
  constructor(config: ConfigService) {
    // No database (ticket 06: the dashboard is a read-aggregate over S2S).
    const required = ["JWT_ACCESS_SECRET", "INTERNAL_API_KEY", "INVOICES_SERVICE_URL"];
    const missing = required.filter((key) => !config.get<string>(key));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required env vars: ${missing.join(", ")}`);
    }
  }
}
