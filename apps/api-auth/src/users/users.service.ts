import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import type { UserDto } from "@repo/contracts";
import { PaginatedResult, paginate } from "@repo/common";

import { PrismaService } from "../prisma.service";

import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from "./users.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(user: {
    id: string;
    email: string;
    name: string;
    role: UserDto["role"];
    createdAt: Date;
  }): UserDto {
    return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() };
  }

  async findAll(
    companyId: string,
    query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserDto>> {
    const where = {
      companyId,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" as const } },
              { name: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(users.map((user) => this.toDto(user)), total, query.page, query.pageSize);
  }

  async create(companyId: string, dto: CreateUserDto): Promise<UserDto> {
    const passwordHash = await hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        companyId,
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
      },
    });
    return this.toDto(user);
  }

  async update(companyId: string, id: string, dto: UpdateUserDto): Promise<UserDto> {
    const existing = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        passwordHash: dto.password ? await hash(dto.password) : undefined,
      },
    });
    return this.toDto(user);
  }

  async remove(companyId: string, id: string, actorId: string): Promise<{ success: true }> {
    if (id === actorId) {
      throw new BadRequestException("You cannot delete your own account");
    }
    const existing = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
