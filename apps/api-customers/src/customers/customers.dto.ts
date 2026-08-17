import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { formatPhone, formatTaxId } from "@repo/common";
import { PaginationDto } from "@repo/common";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * The customer module stores phone numbers and NPWP in one canonical,
 * display-formatted shape (the same shape the seed data uses). Any write —
 * dialog, curl, Swagger, future clients — is normalized through the shared
 * formatters here, and values with no digits are rejected outright.
 */
const normalizeOptional =
  (formatter: (value: string) => string) =>
  ({ value }: { value: unknown }): unknown => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return formatter(trimmed);
  };

export class CreateCustomerDto {
  @ApiProperty({ example: "PT Maju Jaya" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "hello@majujaya.co.id" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+62 21 555 0134" })
  @IsOptional()
  @IsString()
  @Matches(/\d/, { message: "phone must contain digits" })
  @Transform(normalizeOptional(formatPhone))
  phone?: string;

  @ApiPropertyOptional({ example: "01.234.567.8-901.000" })
  @IsOptional()
  @IsString()
  @Matches(/\d/, { message: "taxId must contain digits" })
  @Transform(normalizeOptional(formatTaxId))
  taxId?: string;

  @ApiPropertyOptional({ example: "Jl. Sudirman Kav. 52, Jakarta" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateCustomerDto extends CreateCustomerDto {}

export class ListCustomersQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ["name", "createdAt"] })
  @IsOptional()
  @IsIn(["name", "createdAt"])
  @IsString()
  sort?: "name" | "createdAt";
}
