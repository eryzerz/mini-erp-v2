import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@repo/contracts";
import { PaginationDto } from "@repo/common";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "accountant@slm.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Dewi Lestari" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "accountant123", minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "Dewi L. Rahayu" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class ListUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
