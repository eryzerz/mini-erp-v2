import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class InternalSummaryQueryDto {
  @ApiPropertyOptional({ example: "2026-01-01", description: "Inclusive window start (date)" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-12-31", description: "Inclusive window end (date)" })
  @IsOptional()
  @IsDateString()
  to?: string;
}
