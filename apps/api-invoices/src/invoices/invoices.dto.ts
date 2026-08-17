import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvoiceStatus } from "@repo/contracts";
import { PaginationDto } from "@repo/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";

export class InvoiceItemInputDto {
  @ApiProperty({ example: "Konsultasi pengembangan perangkat lunak" })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: "12.5000" })
  @Matches(/^\d+(\.\d+)?$/, { message: "quantity must be a decimal string" })
  quantity!: string;

  @ApiProperty({ example: "350000.0000" })
  @Matches(/^\d+(\.\d+)?$/, { message: "unitPrice must be a decimal string" })
  unitPrice!: string;

  @ApiPropertyOptional({ example: "11.00" })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, { message: "taxRate must be a decimal string" })
  taxRate?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: "32f1b3f2-...-uuid" })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: "2026-09-15" })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ type: [InvoiceItemInputDto], minItems: 1 })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  @IsNotEmpty({ message: "at least one item is required" })
  items!: InvoiceItemInputDto[];
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: "2026-09-30" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ type: [InvoiceItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items?: InvoiceItemInputDto[];
}

export class ListInvoicesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: "Search by invoice number" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-12-31" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ["issueDate", "dueDate", "total", "number", "createdAt"] })
  @IsOptional()
  @IsIn(["issueDate", "dueDate", "total", "number", "createdAt"])
  @IsString()
  sort?: "issueDate" | "dueDate" | "total" | "number" | "createdAt";
}
