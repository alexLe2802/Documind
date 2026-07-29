import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Prisma, RoleName, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
} satisfies Prisma.UserSelect;

type UserWithRole = Prisma.UserGetPayload<{
  select: typeof PROFILE_USER_SELECT;
}>;

export type UserProfileResponse = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: RoleName;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.findUser(userId);
    return this.toProfileResponse(user);
  }

  async updateProfile(
    userId: string,
    payload: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    if (payload.fullName === undefined && payload.avatarUrl === undefined) {
      throw new BadRequestException(
        'At least one profile field must be provided',
      );
    }

    await this.findUser(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: payload.fullName,
        avatarUrl: payload.avatarUrl,
      },
      select: PROFILE_USER_SELECT,
    });

    await this.auditLogService.create({
      userId,
      action: 'user.profile_updated',
      targetType: 'User',
      targetId: userId,
      metadata: {
        updatedFields: Object.keys(payload),
      },
    });

    return this.toProfileResponse(user);
  }

  private async findUser(userId: string): Promise<UserWithRole> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toProfileResponse(user: UserWithRole): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
