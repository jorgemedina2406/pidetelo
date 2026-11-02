import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';

@Controller(['api/metrics', 'metrics'])
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  async getSummary() {
    return this.metricsService.getGlobalSummary();
  }
}

