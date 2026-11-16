import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { PlansService, PlatformSettings, TenantAddons } from './plans.service.js';

@Controller('api/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async getAllPlans() {
    return this.plansService.getAllPlans();
  }

  // --- Platform Settings (Rider Commission Mode & Add-on Prices) ---
  @Get('platform-settings')
  async getPlatformSettings() {
    return this.plansService.getPlatformSettings();
  }

  @Put('platform-settings')
  async updatePlatformSettings(@Body() body: Partial<PlatformSettings>) {
    return this.plansService.updatePlatformSettings(body);
  }

  // --- Tenant Usage & Plan ---
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

  // --- Tenant Add-ons (Extra branches & Mass catalog) ---
  @Get('tenant/:tenantId/addons')
  async getTenantAddons(@Param('tenantId') tenantId: string) {
    return this.plansService.getTenantAddons(tenantId);
  }

  @Put('tenant/:tenantId/addons')
  async updateTenantAddons(
    @Param('tenantId') tenantId: string,
    @Body() body: Partial<TenantAddons>,
  ) {
    return this.plansService.updateTenantAddons(tenantId, body);
  }
}
