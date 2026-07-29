import { INestApplication } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';
import { ApiResponseInterceptor } from './api-response.interceptor';
import { requestIdMiddleware } from './request-id.middleware';

export function configureApiContract(app: INestApplication): void {
  app.use(requestIdMiddleware);
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
}
