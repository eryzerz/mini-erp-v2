import { Module } from "@nestjs/common";

import { CustomersInternalController } from "./customers.internal.controller";

@Module({
  controllers: [CustomersInternalController],
})
export class InternalModule {}
