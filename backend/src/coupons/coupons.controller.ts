import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { CouponsService } from './coupons.service.js';

@Controller(['api/coupons', 'coupons'])
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async getAllCoupons() {
    return this.couponsService.findAll();
  }

  @Get('tenant/:tenantId')
  async getByTenant(@Param('tenantId') tenantId: string) {
    return this.couponsService.findByTenant(tenantId);
  }

  @Post()
  async createCoupon(@Body() payload: any) {
    return this.couponsService.create(payload);
  }

  @Patch(':id')
  async updateCoupon(@Param('id') id: string, @Body() payload: any) {
    return this.couponsService.update(id, payload);
  }

  @Delete(':id')
  async deleteCoupon(@Param('id') id: string) {
    return { success: await this.couponsService.delete(id) };
  }

  @Post(':id/notify')
  async notifyCustomers(
    @Param('id') id: string,
    @Body() body: { condition?: string; tenantName?: string }
  ) {
    return this.couponsService.notifyCustomers(id, body?.condition, body?.tenantName);
  }

  @Post('validate')
  async validateCoupon(@Body() body: { tenantId: string; code: string; orderAmount: number }) {
    return this.couponsService.validate(body.tenantId, body.code, Number(body.orderAmount) || 0);
  }
}
