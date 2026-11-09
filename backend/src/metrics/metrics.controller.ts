import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';

@ApiTags('Platform Metrics & Reports')
@Controller(['api/metrics', 'metrics'])
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen consolidado global de métricas' })
  async getSummary() {
    return this.metricsService.getGlobalSummary();
  }

  @Get('orders-report')
  @ApiOperation({ summary: 'Reporte detallado de pedidos filtrable por comercio, fechas y estados' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'fulfillmentType', required: false, type: String })
  async getOrdersReport(
    @Query('tenantId') tenantId?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('fulfillmentType') fulfillmentType?: string,
  ) {
    return this.metricsService.getOrdersReport({
      tenantId,
      branchId,
      startDate,
      endDate,
      status,
      fulfillmentType,
    });
  }

  @Get('login-activity')
  @ApiOperation({ summary: 'Historial de inicios de sesión en App Móvil, Comercios, Repartidores y Super Admin' })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getLoginActivity(
    @Query('role') role?: string,
    @Query('platform') platform?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.metricsService.getLoginActivity({
      role,
      platform,
      startDate,
      endDate,
      search,
    });
  }

  @Post('log-login')
  @ApiOperation({ summary: 'Registrar un evento de inicio de sesión de usuario en la plataforma' })
  async recordLogin(@Body() payload: any) {
    return this.metricsService.recordLogin(payload);
  }

  @Get('decision-insights')
  @ApiOperation({ summary: 'Métricas analíticas avanzadas para la toma de decisiones estratégicas' })
  async getDecisionInsights() {
    return this.metricsService.getDecisionInsights();
  }
}
