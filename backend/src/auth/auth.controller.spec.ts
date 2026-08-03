import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    firebaseLogin: jest.fn(),
    createSessionCookie: jest.fn(),
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

  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  it('uses the Firebase ID token from the authorization header', async () => {
    authService.firebaseLogin.mockResolvedValue({ user: { id: 'user-1' } });
    authService.createSessionCookie.mockResolvedValue('session-cookie');

    await controller.firebaseLogin(
      requestWithAuthorization('Bearer header-token'),
      response,
    );

    expect(authService.firebaseLogin).toHaveBeenCalledWith('header-token');
    expect(authService.createSessionCookie).toHaveBeenCalledWith(
      'header-token',
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'documind_session',
      'session-cookie',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
  });

  it('rejects login when no Firebase ID token is provided', async () => {
    await expect(
      controller.firebaseLogin(requestWithAuthorization(), response),
    ).rejects.toBeInstanceOf(
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

  it('clears the secure session cookie on logout', () => {
    controller.logout(response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'documind_session',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
  });
});
