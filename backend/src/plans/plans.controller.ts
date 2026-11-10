import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { PlansService } from './plans.service.js';

@Controller('api/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async getAllPlans() {
    return this.plansService.getAllPlans();
  }

  @Get('tenant/:tenantId')
  async getTenantPlan(@Param('tenantId') tenantId: string) {
    return this.plansService.getTenantPlanAndUsage(tenantId);
  }

  @Put('tenant/:tenantId')
  async assignTenantPlan(
    @Param('tenantId') tenantId: string,
    @Body('planCode') planCode: string,
  ) {
    return this.plansService.assignPlanToTenant(tenantId, planCode);
  }
}

