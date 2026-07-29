import { RoleName, UserStatus } from '../generated/prisma/client';
import { AuthenticatedUser } from './auth.types';

export function isMockAuthEnabled(): boolean {
  return (
    process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production'
  );
}

export function createMockAdminUser(): AuthenticatedUser {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    firebaseUid: 'mock-firebase-admin-uid',
    email: 'admin.mock@documind.local',
    fullName: 'Mock Admin',
    role: { name: RoleName.ADMIN },
    status: UserStatus.ACTIVE,
  };
}
