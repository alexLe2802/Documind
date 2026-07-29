import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const requestId = request.header('x-request-id')?.trim() || randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
