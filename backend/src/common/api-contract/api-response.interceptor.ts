import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope, PaginationMeta } from './api-contract.types';

interface PaginatedResult<T> {
  items: T;
  meta: PaginationMeta;
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessEnvelope<T>> {
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();

    return next
      .handle()
      .pipe(
        map((data) =>
          response.statusCode === 204 ? (undefined as never) : this.wrap(data),
        ),
      );
  }

  private wrap(data: T): ApiSuccessEnvelope<T> {
    if (this.isSuccessEnvelope(data)) {
      return data;
    }

    if (this.isPaginatedResult(data)) {
      return {
        success: true,
        data: data.items,
        meta: data.meta,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private isSuccessEnvelope(value: unknown): value is ApiSuccessEnvelope<T> {
    return (
      this.isRecord(value) &&
      value.success === true &&
      'data' in value &&
      typeof value.timestamp === 'string'
    );
  }

  private isPaginatedResult(value: unknown): value is PaginatedResult<T> {
    return (
      this.isRecord(value) &&
      'items' in value &&
      this.isRecord(value.meta) &&
      typeof value.meta.page === 'number' &&
      typeof value.meta.limit === 'number' &&
      typeof value.meta.totalItems === 'number' &&
      typeof value.meta.totalPages === 'number'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
