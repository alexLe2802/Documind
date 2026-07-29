import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    firebaseLogin: jest.fn(),
    register: jest.fn(),
    getCurrentUser: jest.fn(),
  };
  const controller = new AuthController(authService as unknown as AuthService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function requestWithAuthorization(authorization?: string): Request {
    return {
      headers: { authorization },
    } as Request;
  }

  it('uses the Firebase ID token from the authorization header', async () => {
    authService.firebaseLogin.mockResolvedValue({ user: { id: 'user-1' } });

    await controller.firebaseLogin(
      requestWithAuthorization('Bearer header-token'),
    );

    expect(authService.firebaseLogin).toHaveBeenCalledWith('header-token');
  });

  it('rejects login when no Firebase ID token is provided', () => {
    expect(() => controller.firebaseLogin(requestWithAuthorization())).toThrow(
      UnauthorizedException,
    );
  });

  it('registers with the Firebase token and validated form data', async () => {
    const payload = { fullName: 'Nguyen Van A', acceptedTerms: true };
    authService.register.mockResolvedValue({ user: { id: 'user-1' } });

    await controller.register(
      requestWithAuthorization('Bearer register-token'),
      payload,
    );

    expect(authService.register).toHaveBeenCalledWith(
      'register-token',
      payload,
    );
  });
});
