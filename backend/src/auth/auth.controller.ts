import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiWrappedOkResponse } from '../common/swagger/api-wrapped-response.decorator';
import {
  AuthLoginResponseDto,
  AuthMeResponseDto,
} from './dto/auth-response.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { AuthLoginResponse, AuthMeResponse, AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { RegisterUserDto } from './dto/register-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('firebase-login')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify a Firebase ID token and synchronize the local user',
  })
  @ApiWrappedOkResponse(
    AuthLoginResponseDto,
    'Firebase token verified and user loaded.',
  )
  @ApiUnauthorizedResponse({ description: 'Invalid Firebase ID token.' })
  firebaseLogin(@Req() request: Request): Promise<AuthLoginResponse> {
    const authorization = request.headers.authorization;
    const token = this.extractBearerToken(authorization);
    if (!token) {
      throw new UnauthorizedException('Missing Firebase bearer token');
    }
    return this.authService.firebaseLogin(token);
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register an inactive account pending email verification',
  })
  @ApiWrappedOkResponse(
    AuthLoginResponseDto,
    'Registration recorded. Email verification is required before login.',
  )
  register(
    @Req() request: Request,
    @Body() payload: RegisterUserDto,
  ): Promise<AuthLoginResponse> {
    const authorization = request.headers.authorization;
    const token = this.extractBearerToken(authorization);
    if (!token) {
      throw new UnauthorizedException('Missing Firebase bearer token');
    }
    return this.authService.register(token, payload);
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiWrappedOkResponse(
    AuthMeResponseDto,
    'Current authenticated user profile.',
  )
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid Firebase token.',
  })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthMeResponse> {
    return this.authService.getCurrentUser(user);
  }

  private extractBearerToken(authorization?: string): string | undefined {
    const [scheme, token] = authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
