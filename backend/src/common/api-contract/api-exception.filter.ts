import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorEnvelope } from './api-contract.types';

interface ErrorPayload {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

interface RequestWithId extends Request {
  requestId?: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.getPayload(exception);
    const requestId = request.requestId ?? 'unknown';

    const body: ApiErrorEnvelope = {
      success: false,
      error: {
        code: payload.code ?? this.defaultCode(status),
        message: this.message(payload.message, status),
        ...(payload.details !== undefined
          ? { details: payload.details }
          : this.validationDetails(payload.message)),
      },
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId,
    };

    response.setHeader('x-request-id', requestId);
    response.status(status).json(body);
  }

  private getPayload(exception: unknown): ErrorPayload {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const response = exception.getResponse();
    return typeof response === 'string' ? { message: response } : response;
  }

  private message(
    message: string | string[] | undefined,
    status: number,
  ): string {
    if (Array.isArray(message)) {
      return 'Validation failed';
    }
    if (message) {
      return message;
    }
    return status === 500
      ? 'Internal server error'
      : HttpStatus[status].replaceAll('_', ' ').toLowerCase();
  }

  private validationDetails(message: string | string[] | undefined): {
    details?: { message: string }[];
  } {
    return Array.isArray(message)
      ? { details: message.map((item) => ({ message: item })) }
      : {};
  }

  private defaultCode(status: number): string {
    return HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR';
  }
}
