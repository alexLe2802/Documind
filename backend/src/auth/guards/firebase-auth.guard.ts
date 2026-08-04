import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { Prisma, UserStatus } from '../../generated/prisma/client';
import { FIREBASE_AUTH } from '../../firebase/firebase.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { getAuthSessionCookie } from '../auth-session';
import { AuthenticatedRequest, AuthenticatedUser } from '../auth.types';
import { createMockAdminUser, isMockAuthEnabled } from '../mock-auth';

const AUTHENTICATED_USER_SELECT = {
  id: true,
  firebaseUid: true,
  email: true,
  fullName: true,
  status: true,
  role: { select: { name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (isMockAuthEnabled()) {
      request.user = createMockAdminUser();
      return true;
    }

    const bearerToken = this.extractBearerToken(
      request.headers.authorization,
    );
    const sessionCookie = getAuthSessionCookie(request);

    if (!bearerToken && !sessionCookie) {
      throw new UnauthorizedException('Missing authentication session');
    }

    try {
      const decodedToken = await this.verifyCredential(
        bearerToken,
        sessionCookie,
      );
      const dbUser = await this.prisma.user.findUnique({
        where: { firebaseUid: decodedToken.uid },
        select: AUTHENTICATED_USER_SELECT,
      });

      let user: AuthenticatedUser | null = dbUser;

      if (!user) {
        const syncResult =
          await this.authService.findOrCreateFirebaseUser(decodedToken);
        user = syncResult.user;
      }

      if (!user) {
        throw new UnauthorizedException('User account not found');
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('User is inactive or blocked');
      }

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Firebase ID token');
    }
  }

  private extractBearerToken(authorization?: string): string | undefined {
    const [scheme, token] = authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && token ? token : undefined;
  }

  private verifyCredential(
    bearerToken?: string,
    sessionCookie?: string,
  ): Promise<DecodedIdToken> {
    if (bearerToken) {
      return this.firebaseAuth.verifyIdToken(bearerToken);
    }

    return this.firebaseAuth.verifySessionCookie(sessionCookie!, true);
  }
}
