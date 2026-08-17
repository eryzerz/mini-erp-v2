import { createHash, randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { verify } from "@node-rs/argon2";
import type { LoginResponse, UserDto } from "@repo/contracts";
import { UserRole } from "@repo/contracts";

import { PrismaService } from "../prisma.service";

import type { LoginDto, LogoutDto, RefreshDto } from "./auth.dto";

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private toUserDto(user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
  }): UserDto {
    return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() };
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    companyId: string;
    createdAt: Date;
  }): Promise<LoginResponse> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, companyId: user.companyId },
      { expiresIn: ACCESS_TTL },
    );
    const refreshToken = await this.jwt.signAsync(
      // jti makes every refresh token unique even when issued within the same
      // second as another (the DB stores the hash, and uniqueness is enforced).
      { sub: user.id, jti: randomUUID() },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: `${REFRESH_TTL_MS / 1000}s`,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    return { accessToken, refreshToken, user: this.toUserDto(user) };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<LoginResponse> {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Rotation: the presented token is single-use. Revoke it atomically so a
    // concurrent replay of the same token can't both win the race.
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    return this.issueTokens(stored.user);
  }

  async logout(dto: LogoutDto): Promise<{ success: true }> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(dto.refreshToken) },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toUserDto(user);
  }
}
