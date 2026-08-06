import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  check(): ReturnType<HealthService['liveness']> {
    return this.healthService.liveness();
  }

  @Get('live')
  liveness(): ReturnType<HealthService['liveness']> {
    return this.healthService.liveness();
  }

  @Get('ready')
  readiness(): ReturnType<HealthService['readiness']> {
    return this.healthService.readiness();
  }
}
